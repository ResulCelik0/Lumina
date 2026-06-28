# StellarFund — Soroban crowdfunding dApp
# Run `make` or `make help` to list available targets.

SHELL := /bin/bash
WEB := web
COMPOSE := docker compose
CONTRACT_WASM := target/wasm32v1-none/release/crowdfunding.wasm
NETWORK ?= testnet
WEB_PORT ?= 3000

.DEFAULT_GOAL := help

# ===== Docker (production) ====================================================

.PHONY: up
up: ## Build & start the app in Docker (detached)
	$(COMPOSE) up -d --build
	@echo "✅ StellarFund running at http://localhost:$(WEB_PORT)"

.PHONY: start
start: up ## Alias for `up`

.PHONY: run
run: ## Build & start the app in Docker (foreground, Ctrl-C to stop)
	$(COMPOSE) up --build

.PHONY: down
down: ## Stop and remove the container
	$(COMPOSE) down

.PHONY: restart
restart: down up ## Restart the container

.PHONY: logs
logs: ## Follow container logs
	$(COMPOSE) logs -f

.PHONY: ps
ps: ## Show container status
	$(COMPOSE) ps

.PHONY: docker-build
docker-build: ## Build the Docker image without starting it
	$(COMPOSE) build

.PHONY: clean
clean: ## Stop the container and remove the built image
	-$(COMPOSE) down --rmi local

# ===== Frontend (local, no Docker) ===========================================

.PHONY: install
install: ## Install frontend dependencies
	cd $(WEB) && npm install

.PHONY: dev
dev: ## Run the frontend dev server (http://localhost:3000)
	cd $(WEB) && npm run dev

.PHONY: web-build
web-build: ## Production build of the frontend (also typechecks)
	cd $(WEB) && npm run build

.PHONY: lint
lint: ## Lint the frontend
	cd $(WEB) && npm run lint

.PHONY: check
check: ## RPC sanity check against testnet
	cd $(WEB) && node --experimental-strip-types scripts/check.ts

# ===== Smart contract ========================================================

.PHONY: contract-test
contract-test: ## Run the contract unit tests
	cargo test

.PHONY: contract-build
contract-build: ## Build the contract to wasm
	stellar contract build

.PHONY: deploy
deploy: contract-build ## Deploy the contract to testnet (needs a funded `deployer` identity)
	stellar contract deploy --wasm $(CONTRACT_WASM) --source deployer --network $(NETWORK)

# ===== Help ==================================================================

.PHONY: help
help: ## Show this help
	@echo "StellarFund — available targets:"
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick start:  make up   (then open http://localhost:$(WEB_PORT))"
