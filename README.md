<p align="center">
  <img src="./logo.png" alt="Purp Logo" width="200" />
</p>

<h1 align="center">Purp — Solana Coding Language (SCL)</h1>

<p align="center">
  <strong>Write Solana programs in a language that feels like home.</strong><br/>
  Purp compiles to Anchor-compatible Rust + TypeScript SDK. One language for on-chain, client, and frontend.
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> •
  <a href="#features">Features</a> •
  <a href="#language-overview">Language</a> •
  <a href="#cli">CLI</a> •
  <a href="#templates">Templates</a> •
  <a href="#examples">Examples</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## What is Purp?

**Purp** is a high-level programming language purpose-built for the Solana blockchain. It compiles (transpiles) `.purp` source files into:

- **Anchor-compatible Rust** — ready to deploy as Solana programs
- **TypeScript SDK** — auto-generated client code for interacting with your program

Purp eliminates the boilerplate of writing Solana programs by hand. Instead of juggling Rust, TypeScript, and IDL files separately, you write one `.purp` file that covers **on-chain logic**, **client SDK**, and even **frontend UI**.

### Why Purp?

| Pain Point | Purp Solution |
|---|---|
| Rust is hard for beginners | Purp uses familiar, readable syntax |
| Anchor boilerplate is verbose | Purp auto-generates derive macros, account structs, IDL |
| Client code is separate from program | `client {}` block in the same file |
| Frontend needs a separate project | `frontend {}` block with built-in components |
| No standard way to handle tokens/NFTs | `@purp/stdlib` provides Token, NFT, PDA, CPI helpers |

## Quickstart

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Rust** & **Cargo** (for deploying compiled output)
- **Solana CLI** & **Anchor** (for deployment)

### Install

```bash
# Clone the repo
git clone https://github.com/user/purp-scl.git
cd purp-scl

# Install dependencies
npm install

# Build the compiler & CLI
npm run build

# Link the CLI globally
npm link
```

### Create a New Project

```bash
# Initialize a new Purp project
purp init my-project
cd my-project

# Or use a template
purp init my-token --template memecoin-launcher
```

### Write Your First Program

Create `src/main.purp`:

```
program HelloSolana {

  account Greeting {
    message: string,
    author: pubkey
  }

  pub instruction create_greeting(
    #[mut] signer author,
    #[init] account greeting,
    message: string
  ) {
    greeting.message = message;
    greeting.author = author;
    emit GreetingCreated(author, message);
  }

  event GreetingCreated { author: pubkey, message: string }
}
```

### Build & Deploy

```bash
# Check for errors
purp check

# Build to Rust + TypeScript
purp build

# Deploy (requires Solana CLI + Anchor)
purp deploy --network devnet
```

## Features

### 🔮 Solana-Native Language
- `program`, `instruction`, `account`, `signer`, `PDA`, `token`, `mint`, `NFT` — all first-class keywords
- Events, errors, and CPI built into the syntax

### ⚡ Hybrid Compiler
- Lexer → Parser → AST → Semantic Analysis → Code Generation
- Outputs Anchor-compatible Rust with proper `#[program]`, `#[derive(Accounts)]`, events, errors
- Auto-generates TypeScript client SDK

### 🛠 Powerful CLI
- `purp init` / `purp new` — scaffold projects from templates
- `purp build` — compile `.purp` to Rust + TypeScript
- `purp check` — type-check without building
- `purp deploy` — deploy to Solana network (via Anchor)
- `purp install` — install Purp packages
- `purp publish` — publish a Purp package
- `purp generate` — scaffold instructions, accounts, events, tokens, NFTs
- `purp doctor` — check system dependencies
- `purp dev` — watch mode with live recompilation
- `purp audit` — security scanning
- `purp test` — run tests
- `purp lint` — lint Purp source files
- `purp format` — format Purp source files
- `purp clean` — remove build artifacts

### 📦 Standard Library (`@purp/stdlib`)
| Module | Description |
|---|---|
| `accounts` | Account creation, validation, closing |
| `tokens` | SPL Token: create, mint, transfer, burn |
| `nfts` | Metaplex NFT: mint, update, verify |
| `pdas` | PDA derivation and validation |
| `cpi` | Cross-Program Invocation helpers |
| `events` | Event emission and logging |
| `math` | Safe math (checked add, sub, mul, div, pow, sqrt) |
| `serialization` | Borsh-compatible serialize/deserialize |
| `wallet` | Wallet connection and signing |
| `frontend` | UI components for Solana dApps |
| `game` | Game state, player, leaderboard helpers |
| `web` | HTTP client, JSON, WebSocket utilities |
| `ai` | AI model registry and inference helpers |

### 🏗 Runtime
- `TransactionBuilder` — fluent API for building Solana transactions
- `AccountSerializer` / `AccountDeserializer` — Borsh-compatible serialization
- `PDAHelper` — deterministic PDA derivation
- `SimulationEngine` — local transaction simulation

## Language Overview

### Program Declaration
```
program MyProgram {
  // accounts, instructions, events, errors
}
```

### Accounts
```
account UserProfile {
  owner: pubkey,
  name: string,
  balance: u64,
  is_active: bool
}
```

### Instructions
```
pub instruction transfer(
  #[mut] signer from,
  #[mut] account from_account,
  #[mut] account to_account,
  amount: u64
) {
  assert(from_account.owner == from, "Not owner");
  from_account.balance -= amount;
  to_account.balance += amount;
  emit Transferred(from, amount);
}
```

### Events & Errors
```
event Transferred { from: pubkey, amount: u64 }

error Errors {
  InsufficientFunds = "Not enough balance",
  Unauthorized = "You are not authorized"
}
```

### Client Block
```
client {
  async fn getProfile(program, wallet: pubkey): UserProfile {
    return await program.account.UserProfile.fetch(wallet);
  }
}
```

### Frontend Block
```
frontend {
  page "/" {
    component App {
      state data = [];
      on_mount { data = await client.getData(program); }
      render {
        <div>
          <h1>"My dApp"</h1>
          <WalletButton />
          {data.map(d => <Card item={d} />)}
        </div>
      }
    }
  }
}
```

### Types
| Purp Type | Rust Equivalent | TypeScript Equivalent |
|---|---|---|
| `u8`, `u16`, `u32`, `u64`, `u128` | `u8`, `u16`, `u32`, `u64`, `u128` | `number`, `BN` |
| `i8`, `i16`, `i32`, `i64`, `i128` | `i8`, `i16`, `i32`, `i64`, `i128` | `number`, `BN` |
| `f32`, `f64` | `f32`, `f64` | `number` |
| `bool` | `bool` | `boolean` |
| `string` | `String` | `string` |
| `pubkey` | `Pubkey` | `PublicKey` |
| `bytes` | `Vec<u8>` | `Buffer` |

## Templates

| Template | Description |
|---|---|
| `hello-world` | Minimal Purp program with one instruction |
| `memecoin-launcher` | Full SPL token launch with liquidity pool |
| `nft-mint` | NFT collection with minting and metadata |
| `cnft-mint` | Compressed NFT minting with Merkle tree |
| `staking-rewards` | Staking pool with reward distribution |
| `game-contract` | On-chain game with players, rounds, prizes |
| `fullstack-dapp` | Complete dApp with program + client + frontend |
| `website-wallet` | Website with wallet integration |
| `analytics-dashboard` | On-chain analytics with dashboard UI |
| `bot` | Trading/utility bot with config and trade logging |
| `ai-solana-app` | AI model registry with on-chain inference |

```bash
purp init my-project --template memecoin-launcher
```

## Examples

The `examples/` directory contains standalone `.purp` files demonstrating specific features:

- **token-creation** — Creating and managing SPL tokens
- **nft-mint** — Minting NFTs with collections
- **pda-usage** — Program Derived Addresses
- **frontend-interaction** — Connecting frontend to on-chain program
- **wallet-flow** — Wallet connect, sign, send
- **simple-game** — Rock-Paper-Scissors on-chain
- **rewards-system** — Staking and reward distribution

## Project Structure

```
purp-scl/
├── compiler/           # Purp compiler (lexer, parser, AST, codegen)
│   └── src/
│       ├── lexer/      # Tokenizer
│       ├── parser/     # Recursive descent parser
│       ├── ast/        # Abstract Syntax Tree definitions
│       ├── semantic/   # Semantic analysis & type checking
│       ├── codegen/    # Code generation
│       │   ├── rust/   # → Anchor-compatible Rust
│       │   └── typescript/ # → TypeScript SDK
│       ├── typechecker/ # Full type checker with inference
│       ├── formatter/  # Code formatter (purp fmt)
│       ├── linter/     # Linter with configurable rules
│       ├── sourcemap/  # Source map generation for debugging
│       ├── plugins/    # Plugin system for custom codegen & lint rules
│       └── errors/     # Error types & diagnostics
├── cli/                # Command-line interface
│   └── src/
│       ├── commands/   # 18 CLI commands (init, build, deploy, install, ...)
│       └── utils/      # CLI utilities
├── lsp/                # Language Server Protocol implementation
│   └── src/
│       └── server.ts   # LSP server (diagnostics, completion, hover, go-to-def)
├── editor/             # Editor integrations
│   └── vscode/         # VS Code extension
│       └── syntaxes/   # TextMate grammar for .purp syntax highlighting
├── runtime/            # Runtime helpers (transaction builder, PDA, simulation)
├── stdlib/             # Standard library (13 modules)
├── templates/          # Project templates (11 templates)
├── examples/           # Example .purp files (7 examples)
├── docs/               # Documentation
├── spec/               # Language specification & grammar
├── tests/              # Test suite (136 tests across 9 suites)
├── website/            # Documentation website
├── scripts/            # Build & utility scripts
└── .github/            # CI/CD workflows & templates
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full roadmap.

### v0.1.0 ✅
- [x] Core compiler (lexer, parser, AST, codegen)
- [x] Rust code generation (Anchor-compatible)
- [x] TypeScript SDK generation
- [x] CLI with 15+ commands
- [x] Standard library (13 modules)
- [x] Runtime layer
- [x] 11 project templates
- [x] 7 examples
- [x] Documentation

### v0.2.0 ✅
- [x] LSP (Language Server Protocol) — diagnostics, completion, hover, go-to-def
- [x] VS Code extension with TextMate syntax highlighting
- [x] Full type checker with inference
- [x] Source map generation
- [x] Code formatter (`purp format`)
- [x] Linter with configurable rules (`purp lint`)
- [x] Improved error messages with suggestions

### v0.3.0 ✅
- [x] Package manager (`purp install` / `purp publish`) with Purp.toml + Purp.lock
- [x] Plugin system (custom codegen, lint rules, build hooks)
- [x] Real deployment pipeline (`purp deploy` → Anchor build + deploy)
- [x] Dev watch mode with file system watching (`purp dev`)
- [x] Real test runner with AST-based test extraction (`purp test`)
- [x] Local transaction simulation engine
- [x] Full stdlib: tokens (SPL instructions), NFTs (Metaplex/cNFTs), PDAs (SHA-256 derivation), CPI builder, wallet adapters, frontend components, web/HTTP client, AI agent tools

### v1.0.0 ✅ (Current)
- [x] TypeChecker hardened — covers all statement/expression types with full type inference
- [x] Linter expanded to 13 rules — Solana-specific best practices, full AST walker
- [x] LSP expanded — 35+ hover entries, all symbol types
- [x] Source map generator — real Base64 VLQ encoding
- [x] `purp test` — real execution via AST-to-JS compilation
- [x] `purp run` — compiles and executes via Node.js
- [x] `purp docs` / `purp example` — full CLI reference and real code examples
- [x] 136 tests across 9 suites (lexer, parser, compiler, codegen, formatter, linter, typechecker, semantic, sourcemap)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Write your code and tests
4. Run `purp check` and `npm test`
5. Submit a Pull Request

## License

MIT — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <strong>Purp SCL v1.0.0</strong> — Built for the Solana ecosystem 💜
</p>
