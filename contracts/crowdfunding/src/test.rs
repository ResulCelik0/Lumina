#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    token, Address, Env,
};

const ONE_XLM: i128 = 10_000_000; // 1 XLM = 1e7 stroops

struct Harness<'a> {
    env: Env,
    client: CrowdfundingContractClient<'a>,
    token: token::TokenClient<'a>,
    token_admin: token::StellarAssetClient<'a>,
    admin: Address,
    alice: Address,
    bob: Address,
}

fn setup(goal: i128, deadline: u64) -> Harness<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    // Deploy a Stellar Asset Contract to act as the campaign token.
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = token::TokenClient::new(&env, &sac.address());
    let token_admin = token::StellarAssetClient::new(&env, &sac.address());
    token_admin.mint(&alice, &(1_000 * ONE_XLM));
    token_admin.mint(&bob, &(1_000 * ONE_XLM));

    let contract_id = env.register(CrowdfundingContract, ());
    let client = CrowdfundingContractClient::new(&env, &contract_id);
    client.initialize(&admin, &sac.address(), &goal, &deadline);

    Harness {
        env,
        client,
        token,
        token_admin,
        admin,
        alice,
        bob,
    }
}

#[test]
fn initialize_sets_campaign_state() {
    let h = setup(100 * ONE_XLM, 10_000);
    let c = h.client.get_campaign();
    assert_eq!(c.admin, h.admin);
    assert_eq!(c.goal, 100 * ONE_XLM);
    assert_eq!(c.deadline, 10_000);
    assert_eq!(c.total_raised, 0);
    assert!(!c.withdrawn);
}

#[test]
fn contribute_moves_funds_and_tracks_totals() {
    let h = setup(100 * ONE_XLM, 10_000);

    let new_total = h.client.contribute(&h.alice, &(30 * ONE_XLM));
    assert_eq!(new_total, 30 * ONE_XLM);
    h.client.contribute(&h.bob, &(20 * ONE_XLM));

    assert_eq!(h.client.get_total_raised(), 50 * ONE_XLM);
    assert_eq!(h.client.get_contribution(&h.alice), 30 * ONE_XLM);
    assert_eq!(h.client.get_contribution(&h.bob), 20 * ONE_XLM);
    // Funds actually held by the contract.
    assert_eq!(h.token.balance(&h.client.address), 50 * ONE_XLM);
    assert_eq!(h.token.balance(&h.alice), 970 * ONE_XLM);
}

#[test]
fn contribute_emits_event() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(30 * ONE_XLM));
    // At least the contribute event was published.
    assert!(!h.env.events().all().events().is_empty());
}

#[test]
fn successful_campaign_allows_admin_withdraw() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(60 * ONE_XLM));
    h.client.contribute(&h.bob, &(40 * ONE_XLM));

    // Move past the deadline.
    h.env.ledger().set_timestamp(10_001);
    let withdrawn = h.client.withdraw();
    assert_eq!(withdrawn, 100 * ONE_XLM);
    assert_eq!(h.token.balance(&h.admin), 100 * ONE_XLM);
    assert!(h.client.get_campaign().withdrawn);
}

#[test]
fn failed_campaign_allows_contributor_refund() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(30 * ONE_XLM));

    h.env.ledger().set_timestamp(10_001); // deadline passed, goal NOT met
    let refunded = h.client.refund(&h.alice);
    assert_eq!(refunded, 30 * ONE_XLM);
    assert_eq!(h.token.balance(&h.alice), 1_000 * ONE_XLM); // made whole
    assert_eq!(h.client.get_contribution(&h.alice), 0);
}

// ----------------------------- Error paths -----------------------------------

#[test]
fn cannot_initialize_twice() {
    let h = setup(100 * ONE_XLM, 10_000);
    let res = h.client.try_initialize(&h.admin, &h.token.address, &(50 * ONE_XLM), &20_000);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn rejects_non_positive_contribution() {
    let h = setup(100 * ONE_XLM, 10_000);
    let res = h.client.try_contribute(&h.alice, &0);
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn rejects_contribution_after_deadline() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.env.ledger().set_timestamp(10_001);
    let res = h.client.try_contribute(&h.alice, &(10 * ONE_XLM));
    assert_eq!(res, Err(Ok(Error::DeadlinePassed)));
}

#[test]
fn withdraw_blocked_before_deadline() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(100 * ONE_XLM));
    let res = h.client.try_withdraw();
    assert_eq!(res, Err(Ok(Error::DeadlineNotReached)));
}

#[test]
fn withdraw_blocked_when_goal_not_reached() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(10 * ONE_XLM));
    h.env.ledger().set_timestamp(10_001);
    let res = h.client.try_withdraw();
    assert_eq!(res, Err(Ok(Error::GoalNotReached)));
}

#[test]
fn no_double_withdraw() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(100 * ONE_XLM));
    h.env.ledger().set_timestamp(10_001);
    h.client.withdraw();
    let res = h.client.try_withdraw();
    assert_eq!(res, Err(Ok(Error::AlreadyWithdrawn)));
}

#[test]
fn refund_blocked_when_goal_reached() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(100 * ONE_XLM));
    h.env.ledger().set_timestamp(10_001);
    let res = h.client.try_refund(&h.alice);
    assert_eq!(res, Err(Ok(Error::GoalAlreadyReached)));
}

#[test]
fn refund_blocked_before_deadline() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(10 * ONE_XLM));
    let res = h.client.try_refund(&h.alice);
    assert_eq!(res, Err(Ok(Error::DeadlineNotReached)));
}

#[test]
fn refund_nothing_to_refund() {
    let h = setup(100 * ONE_XLM, 10_000);
    h.client.contribute(&h.alice, &(10 * ONE_XLM));
    h.env.ledger().set_timestamp(10_001);
    let res = h.client.try_refund(&h.bob); // bob never contributed
    assert_eq!(res, Err(Ok(Error::NothingToRefund)));
    // silence unused warning for token_admin in this path
    let _ = &h.token_admin;
}
