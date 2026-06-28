#![no_std]
//! # Crowdfunding (Soroban smart contract)
//!
//! A minimal, security-conscious crowdfunding campaign:
//! - The campaign accepts contributions in a single SEP-41 token (e.g. the
//!   native XLM Stellar Asset Contract) until a deadline.
//! - If the goal is reached by the deadline, the admin can withdraw the funds.
//! - If the goal is *not* reached, contributors can reclaim (refund) their funds.
//!
//! Security properties intentionally enforced:
//! - `require_auth` on every state-changing entrypoint.
//! - Checked arithmetic (no silent overflow) on all balance math.
//! - Checks-Effects-Interactions ordering: internal state is updated *before*
//!   any outbound `transfer`, so a malicious token contract cannot reenter and
//!   drain funds (e.g. double-withdraw / double-refund).
//! - Strict input validation (positive amounts, future deadline, etc.).
//! - Instance/persistent TTL extension so live campaigns are not archived.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, Symbol,
};

// ----------------------------------------------------------------------------
// Storage TTL configuration (in ledgers). ~5s per ledger on Stellar.
// ----------------------------------------------------------------------------
const DAY_IN_LEDGERS: u32 = 17_280; // ~1 day
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const PERSISTENT_BUMP_AMOUNT: u32 = 60 * DAY_IN_LEDGERS;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = PERSISTENT_BUMP_AMOUNT - DAY_IN_LEDGERS;

// ----------------------------------------------------------------------------
// Errors — each maps to a distinct, frontend-friendly failure reason.
// ----------------------------------------------------------------------------
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    InvalidDeadline = 4,
    DeadlinePassed = 5,
    DeadlineNotReached = 6,
    GoalNotReached = 7,
    GoalAlreadyReached = 8,
    NothingToRefund = 9,
    AlreadyWithdrawn = 10,
    MathOverflow = 11,
}

// ----------------------------------------------------------------------------
// Storage keys.
// ----------------------------------------------------------------------------
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    Goal,
    Deadline,
    TotalRaised,
    Withdrawn,
    Contribution(Address),
}

/// Aggregated, read-only campaign view returned to the frontend in a single
/// RPC simulation (cheaper than 6 separate getters).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub admin: Address,
    pub token: Address,
    pub goal: i128,
    pub deadline: u64,
    pub total_raised: i128,
    pub withdrawn: bool,
}

#[contract]
pub struct CrowdfundingContract;

// We intentionally use `env.events().publish(topics, data)` rather than the
// newer `#[contractevent]` macro: the (topics, data) shape maps 1:1 onto what
// the Soroban RPC `getEvents` endpoint returns, keeping the frontend event
// parser simple and explicit.
#[allow(deprecated)]
#[contractimpl]
impl CrowdfundingContract {
    /// Initialize the campaign. Callable exactly once.
    ///
    /// * `admin` — receives the funds on a successful campaign.
    /// * `token` — SEP-41 token accepted for contributions (e.g. native SAC).
    /// * `goal` — funding target, in the token's smallest unit (stroops for XLM).
    /// * `deadline` — UNIX timestamp (seconds) after which contributions close.
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        goal: i128,
        deadline: u64,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        // Only the campaign owner may create their own campaign.
        admin.require_auth();

        if goal <= 0 {
            return Err(Error::InvalidAmount);
        }
        if deadline <= env.ledger().timestamp() {
            return Err(Error::InvalidDeadline);
        }

        let storage = env.storage().instance();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::Token, &token);
        storage.set(&DataKey::Goal, &goal);
        storage.set(&DataKey::Deadline, &deadline);
        storage.set(&DataKey::TotalRaised, &0i128);
        storage.set(&DataKey::Withdrawn, &false);
        Self::extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "initialized"), admin.clone()),
            (token, goal, deadline),
        );
        Ok(())
    }

    /// Contribute `amount` of the campaign token. Requires the contributor's
    /// authorization (the token transfer is pulled from `from`).
    pub fn contribute(env: Env, from: Address, amount: i128) -> Result<i128, Error> {
        Self::require_initialized(&env)?;
        from.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() >= deadline {
            return Err(Error::DeadlinePassed);
        }

        // Interaction: pull funds in. Reverts the whole tx on failure
        // (e.g. insufficient balance / missing trustline).
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::TokenClient::new(&env, &token_addr);
        client.transfer(&from, &env.current_contract_address(), &amount);

        // Effects: update aggregate + per-contributor balances (checked).
        let total: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap();
        let new_total = total.checked_add(amount).ok_or(Error::MathOverflow)?;
        env.storage().instance().set(&DataKey::TotalRaised, &new_total);

        let key = DataKey::Contribution(from.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_contribution = prev.checked_add(amount).ok_or(Error::MathOverflow)?;
        env.storage().persistent().set(&key, &new_contribution);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );
        Self::extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "contribute"), from),
            (amount, new_total),
        );
        Ok(new_total)
    }

    /// Admin withdraws the raised funds. Allowed only once, only after the
    /// deadline, and only if the goal was reached.
    pub fn withdraw(env: Env) -> Result<i128, Error> {
        Self::require_initialized(&env)?;
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if env
            .storage()
            .instance()
            .get::<_, bool>(&DataKey::Withdrawn)
            .unwrap()
        {
            return Err(Error::AlreadyWithdrawn);
        }
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() < deadline {
            return Err(Error::DeadlineNotReached);
        }
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        let total: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap();
        if total < goal {
            return Err(Error::GoalNotReached);
        }

        // Effects before interaction (reentrancy-safe): mark withdrawn first.
        env.storage().instance().set(&DataKey::Withdrawn, &true);
        Self::extend_instance_ttl(&env);

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::TokenClient::new(&env, &token_addr);
        client.transfer(&env.current_contract_address(), &admin, &total);

        env.events()
            .publish((Symbol::new(&env, "withdraw"), admin), total);
        Ok(total)
    }

    /// Refund a contributor. Allowed only after the deadline and only if the
    /// goal was *not* reached. The caller can only refund their own balance.
    pub fn refund(env: Env, to: Address) -> Result<i128, Error> {
        Self::require_initialized(&env)?;
        to.require_auth();

        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() < deadline {
            return Err(Error::DeadlineNotReached);
        }
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        let total: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap();
        if total >= goal {
            // Goal met: funds belong to the admin, not refundable.
            return Err(Error::GoalAlreadyReached);
        }

        let key = DataKey::Contribution(to.clone());
        let contributed: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if contributed <= 0 {
            return Err(Error::NothingToRefund);
        }

        // Effects before interaction: zero the balance + decrement total first.
        env.storage().persistent().set(&key, &0i128);
        let new_total = total.checked_sub(contributed).ok_or(Error::MathOverflow)?;
        env.storage().instance().set(&DataKey::TotalRaised, &new_total);
        Self::extend_instance_ttl(&env);

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::TokenClient::new(&env, &token_addr);
        client.transfer(&env.current_contract_address(), &to, &contributed);

        env.events()
            .publish((Symbol::new(&env, "refund"), to), contributed);
        Ok(contributed)
    }

    // ---------------------------- Read-only views ---------------------------

    /// Single-call snapshot of the whole campaign (used by the frontend).
    pub fn get_campaign(env: Env) -> Result<Campaign, Error> {
        Self::require_initialized(&env)?;
        let s = env.storage().instance();
        Ok(Campaign {
            admin: s.get(&DataKey::Admin).unwrap(),
            token: s.get(&DataKey::Token).unwrap(),
            goal: s.get(&DataKey::Goal).unwrap(),
            deadline: s.get(&DataKey::Deadline).unwrap(),
            total_raised: s.get(&DataKey::TotalRaised).unwrap(),
            withdrawn: s.get(&DataKey::Withdrawn).unwrap(),
        })
    }

    pub fn get_total_raised(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalRaised)
            .unwrap_or(0)
    }

    pub fn get_goal(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Goal).unwrap_or(0)
    }

    pub fn get_deadline(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap_or(0)
    }

    /// How much `who` has contributed (and could reclaim on a failed campaign).
    pub fn get_contribution(env: Env, who: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(who))
            .unwrap_or(0)
    }

    // ------------------------------- Internals ------------------------------

    fn require_initialized(env: &Env) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }
        Ok(())
    }

    fn extend_instance_ttl(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    }
}

mod test;
