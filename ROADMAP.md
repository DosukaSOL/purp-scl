# Roadmap

## v0.1.0 — MVP ✅

### Compiler
- [x] Lexer with ~100 token types including Solana-native keywords
- [x] Recursive descent parser with precedence climbing
- [x] Full AST type definitions
- [x] Semantic analysis (scope tracking, duplicate detection, signer validation)
- [x] Rust code generation (Anchor-compatible)
- [x] TypeScript SDK code generation
- [x] Error system with categorized error codes

### CLI
- [x] `purp init` — project scaffolding with templates
- [x] `purp build` — compile .purp to Rust + TypeScript
- [x] `purp check` — type-checking without building
- [x] `purp generate` — code generation for common patterns
- [x] `purp doctor` — system dependency checker
- [x] `purp audit` — security scanning
- [x] `purp clean` — build artifact cleanup

### Standard Library
- [x] 13 modules: accounts, tokens, nfts, pdas, cpi, events, math, serialization, wallet, frontend, game, web, ai

### Templates & Examples
- [x] 11 project templates
- [x] 7 examples

### Documentation
- [x] README with quickstart
- [x] Language reference
- [x] CLI reference
- [x] Architecture docs
- [x] FAQ

---

## v0.2.0 — Developer Experience ✅

### Language Server Protocol (LSP)
- [x] Diagnostics (errors/warnings in editor)
- [x] Go-to-definition
- [x] Hover information
- [x] Auto-completion
- [x] Signature help

### VS Code Extension
- [x] TextMate grammar syntax highlighting for .purp files
- [x] Snippets for common patterns
- [x] Integrated error messages
- [x] Build/deploy commands from command palette

### Compiler Improvements
- [x] Full type checker with type inference
- [x] Better error messages with suggestions ("Did you mean...?")
- [x] Source maps for debugging
- [x] Code formatter (`purp format`)
- [x] Linter with configurable rules (`purp lint`)

### Testing
- [x] 55+ tests (28 lexer + 17 parser + 10 compiler)

---

## v0.3.0 — Ecosystem ✅

### Package Manager
- [x] `purp install <package>` — install Purp packages
- [x] `purp publish` — publish to Purp registry
- [x] Purp.toml for dependency management
- [x] Purp.lock file generation
- [x] Built-in @purp/* package resolution
- [x] npm backing package integration

### Plugin System
- [x] PurpPlugin interface (setup, preBuild, postBuild, codegen, lintRules, transform)
- [x] PluginManager with config loading from Purp.toml
- [x] Dynamic plugin loading via import()
- [x] Custom codegen targets
- [x] Pre/post build hooks
- [x] Custom lint rules

### CLI Upgrades
- [x] Real `purp deploy` — Anchor build + deploy pipeline with cluster config
- [x] Real `purp dev` — native file watching with debounced rebuilds
- [x] Real `purp test` — AST-based test block extraction and execution
- [x] `purp install` / `purp publish` — package management commands

### Runtime Upgrades
- [x] Full simulation engine with account state management
- [x] System Program instruction simulation (Transfer, CreateAccount)
- [x] Compute unit estimation and fee calculation
- [x] Multi-instruction transaction simulation

### Standard Library Upgrades
- [x] **tokens**: Full SPL Token instruction builders (InitializeMint, Transfer, MintTo, Burn, CloseAccount), ATA derivation, validation
- [x] **nfts**: Metaplex metadata, off-chain metadata generation, compressed NFT configs, Merkle tree sizing, royalty calculation
- [x] **pdas**: Real PDA derivation with SHA-256, findProgramAddress, createProgramAddress, Base58 encoding, common PDA patterns (metadata, edition, vault)
- [x] **cpi**: CPIBuilder fluent API, AccountMeta helpers, System/Token/Memo CPI constructors, validation
- [x] **wallet**: 7 wallet adapters (Phantom, Solflare, Backpack, etc.), cluster endpoints, wallet setup code generation, SOL/lamport conversion
- [x] **frontend**: Full dApp HTML scaffold, React component generators, transaction forms, NFT gallery, notification area, theme system
- [x] **web**: HTTP client with retries/timeout, Solana JSON-RPC helper, OpenAPI spec generation, WebSocket client, CORS/security headers
- [x] **ai**: AI agent config, tool definitions for Solana (transfer, balance, swap, etc.), system prompt generation, conversation management, capability-based tool filtering

---

## v1.0.0 — Production Release ✅ (Current)

### Compiler Hardening
- [x] TypeChecker covers all statement/expression types (break, continue, emit, throw, CPI, SPL, block)
- [x] TypeChecker registers functions and instructions with full parameter/return types
- [x] TypeChecker supports array and string method return type inference
- [x] SemanticAnalyzer validates all top-level and nested node types
- [x] Source map generator uses real Base64 VLQ encoding with delta tracking
- [x] Import resolver handles relative, package, and search path imports

### Linter Expansion
- [x] 13 built-in lint rules (up from 6)
- [x] `no-unused-accounts` — detects declared but unreferenced instruction accounts
- [x] `no-hardcoded-amounts` — warns on large SOL literal amounts
- [x] `enum-naming` — enforces PascalCase for enums
- [x] `account-naming` — enforces PascalCase for accounts
- [x] `init-needs-space` — init accounts should specify space
- [x] `no-unguarded-mutation` — mutable accounts need signer authorization
- [x] Full expression tree walker (traverses all nested AST children)

### CLI Completion
- [x] `purp test` — real execution via AST-to-JS compilation with Solana mocks
- [x] `purp run` — compiles, writes temp file, executes via Node.js
- [x] `purp docs` — full 15-command CLI reference
- [x] `purp example` — 4 real Purp code examples (hello-world, token, nft, counter)

### LSP Improvements
- [x] 35+ hover info entries (all types, keywords, Solana concepts)
- [x] Symbol collection for ErrorDeclaration, TraitDeclaration, TypeAlias, ImportDeclaration
- [x] Full diagnostic integration with type checker and semantic analyzer

### Test Coverage
- [x] 136 tests across 9 test suites
- [x] Lexer: 28 tests
- [x] Parser: 17 tests
- [x] Compiler integration: 10 tests
- [x] Codegen (Rust + TypeScript): 22 tests
- [x] Formatter: 14 tests
- [x] Linter: 12 tests
- [x] TypeChecker: 15 tests
- [x] Semantic Analyzer: 14 tests
- [x] Source Map: 14 tests

---

## Future Vision

- Frontend compilation (`frontend {}` → React/Next.js)
- Visual debugger with step-through and breakpoints
- Formal verification integration
- Dead code elimination and optimization passes
- Multi-program deployment and upgrade management
- Incremental compilation for large projects
- Purp becomes the standard entry point for Solana development
- Rich ecosystem of packages and plugins
- Full IDE support on par with TypeScript/Rust
- Supported by the Solana Foundation
- Used in production by major Solana projects
