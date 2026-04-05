# Roadmap

## v0.1.0 — MVP (Current Release)

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
- [x] `purp deploy` — deploy to Solana network
- [x] `purp dev` — watch mode with auto-recompilation
- [x] `purp generate` — code generation for common patterns
- [x] `purp doctor` — system dependency checker
- [x] `purp test` — test runner
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

## v0.2.0 — Developer Experience (Planned)

### Language Server Protocol (LSP)
- [ ] Diagnostics (errors/warnings in editor)
- [ ] Go-to-definition
- [ ] Hover information
- [ ] Auto-completion
- [ ] Signature help

### VS Code Extension
- [ ] Syntax highlighting for .purp files
- [ ] Snippets for common patterns
- [ ] Integrated error messages
- [ ] Build/deploy commands from command palette

### Compiler Improvements
- [ ] Better error messages with suggestions ("Did you mean...?")
- [ ] Source maps for debugging
- [ ] Incremental compilation
- [ ] Import resolution across files

### Frontend Compilation
- [ ] Compile `frontend {}` blocks to React components
- [ ] Compile `style {}` blocks to CSS
- [ ] Next.js project generation
- [ ] Wallet adapter integration

---

## v0.3.0 — Ecosystem (Future)

### Package Manager
- [ ] `purp install <package>` — install Purp packages
- [ ] `purp publish` — publish to Purp registry
- [ ] Package resolution and dependency management
- [ ] purp.lock file

### Plugin System
- [ ] Custom codegen targets
- [ ] Pre/post build hooks
- [ ] Custom lint rules
- [ ] Third-party integrations

### Debugger
- [ ] Step-through debugging of .purp files
- [ ] Breakpoints
- [ ] Variable inspection
- [ ] Call stack navigation

### Advanced Features
- [ ] Formal verification integration
- [ ] Gas/compute unit estimation
- [ ] Account size calculator
- [ ] Migration tooling

---

## v0.4.0 — Production (Future)

### Optimization
- [ ] Dead code elimination
- [ ] Account space optimization
- [ ] Instruction batching suggestions

### Testing Framework
- [ ] Native Purp test syntax
- [ ] Mocking framework
- [ ] Coverage reporting
- [ ] Fuzzing support

### Deployment
- [ ] Multi-program deployment
- [ ] Upgrade management
- [ ] Rollback support
- [ ] Environment management

### Monitoring
- [ ] On-chain analytics integration
- [ ] Error tracking
- [ ] Performance monitoring

---

## Long-Term Vision

- Purp becomes the standard entry point for Solana development
- Rich ecosystem of packages and plugins
- Full IDE support on par with TypeScript/Rust
- Supported by the Solana Foundation
- Used in production by major Solana projects
