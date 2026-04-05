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

## v0.3.0 — Ecosystem ✅ (Current Release)

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

## v0.4.0 — Production (Next)

### Frontend Compilation
- [ ] Compile `frontend {}` blocks to React components
- [ ] Compile `client {}` blocks to working TypeScript SDK
- [ ] Compile `style {}` blocks to CSS
- [ ] Next.js project generation
- [ ] Wallet adapter integration in generated output

### Optimization
- [ ] Dead code elimination
- [ ] Account space optimization
- [ ] Instruction batching suggestions
- [ ] Incremental compilation

### Multi-File Support
- [ ] Import resolution across .purp files
- [ ] Module system (mod, use)
- [ ] Re-exports and barrel files

### Testing Framework
- [ ] Native Purp test syntax (`test "name" { ... }`)
- [ ] Mocking framework for accounts and programs
- [ ] Coverage reporting
- [ ] Fuzzing support

### Debugger
- [ ] Step-through debugging of .purp files
- [ ] Breakpoints
- [ ] Variable inspection
- [ ] Call stack navigation

### Deployment
- [ ] Multi-program deployment
- [ ] Upgrade management with versioning
- [ ] Rollback support
- [ ] Environment management (dev/staging/prod)

### Advanced Features
- [ ] Formal verification integration
- [ ] Compute unit estimation in the editor
- [ ] Account size calculator
- [ ] Migration tooling between program versions

---

## Long-Term Vision

- Purp becomes the standard entry point for Solana development
- Rich ecosystem of packages and plugins
- Full IDE support on par with TypeScript/Rust
- Supported by the Solana Foundation
- Used in production by major Solana projects
