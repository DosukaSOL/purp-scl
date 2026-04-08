# Changelog

All notable changes to Purp SCL will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2024-01-01

### Added

#### Compiler
- Lexer with ~100 token types including Solana-native keywords (program, instruction, account, signer, PDA, CPI, token, mint, NFT, etc.)
- Recursive descent parser with precedence climbing for expressions
- Complete AST type definitions for all language constructs
- Semantic analyzer with scope tracking, duplicate detection, and signer validation
- Rust code generator producing Pinocchio-powered output (entrypoint!, process_instruction, AccountView, Borsh serialization)
- TypeScript code generator producing SDK client classes
- Error system with categorized codes (1xxx-5xxx) and formatted diagnostics

#### CLI
- `purp init` — Initialize new projects with optional template selection
- `purp build` — Compile .purp files to Rust and TypeScript
- `purp check` — Type-check without generating output
- `purp deploy` — Deploy to Solana networks (devnet, testnet, mainnet-beta, localnet)
- `purp dev` — Watch mode with automatic recompilation
- `purp generate` — Generate instruction, account, event, error, token, and NFT boilerplate
- `purp doctor` — Check system dependencies (Node, Rust, Solana CLI, cargo-build-sbf, Git)
- `purp test` — Run test suite
- `purp audit` — Security scanning for hardcoded keys and unsafe patterns
- `purp clean` — Remove build artifacts
- `purp run` — Execute scripts from purp.toml

#### Standard Library
- accounts — Account lifecycle management
- tokens — SPL Token operations (create, mint, transfer, burn)
- nfts — Metaplex NFT operations (mint, update, verify)
- pdas — PDA derivation utilities
- cpi — Cross-Program Invocation helpers
- events — Event emission and logging
- math — Safe arithmetic (checked operations, sqrt, pow)
- serialization — Borsh-compatible serialize/deserialize
- wallet — Wallet adapter abstraction
- frontend — UI component primitives
- game — Game development helpers
- web — HTTP, JSON, WebSocket utilities
- ai — AI model integration helpers

#### Runtime
- TransactionBuilder with fluent API
- AccountSerializer and AccountDeserializer (Borsh-compatible)
- PDAHelper for deterministic address derivation
- SimulationEngine for local transaction testing

#### Templates (11)
- hello-world, memecoin-launcher, nft-mint, cnft-mint, staking-rewards, game-contract, fullstack-dapp, website-wallet, analytics-dashboard, bot, ai-solana-app

#### Examples (7)
- token-creation, nft-mint, pda-usage, frontend-interaction, wallet-flow, simple-game, rewards-system

#### Documentation
- README with project overview and quickstart
- Installation guide
- Quick start tutorial
- Language reference
- CLI reference
- Architecture documentation
- FAQ
- "Why Purp" explainer
- "Purp vs Hand-Written Rust" comparison

#### Infrastructure
- GitHub Actions CI (lint, build, test, security audit)
- Release workflow
- Issue and PR templates
- Contributing guidelines
- Code of Conduct
- Governance document
- Security policy
- Roadmap
