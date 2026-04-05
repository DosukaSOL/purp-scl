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
- `purp deploy` — deploy to Solana network
- `purp generate` — scaffold instructions, accounts, events, tokens, NFTs
- `purp doctor` — check system dependencies
- `purp dev` — watch mode with live recompilation
- `purp audit` — security scanning
- `purp test` — run tests
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

error InsufficientFunds = "Not enough balance"
error Unauthorized = "You are not authorized"
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
│       ├── semantic/   # Semantic analysis & validation
│       ├── codegen/    # Code generation
│       │   ├── rust/   # → Anchor-compatible Rust
│       │   └── typescript/ # → TypeScript SDK
│       └── errors/     # Error types & diagnostics
├── cli/                # Command-line interface
│   └── src/
│       ├── commands/   # All CLI commands
│       └── utils/      # CLI utilities
├── runtime/            # Runtime helpers (transaction builder, PDA, simulation)
├── stdlib/             # Standard library modules
├── templates/          # Project templates (11 templates)
├── examples/           # Example .purp files (7 examples)
├── docs/               # Documentation
├── spec/               # Language specification
├── tests/              # Test suite
├── website/            # Documentation website
├── scripts/            # Build & utility scripts
└── .github/            # CI/CD workflows & templates
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full roadmap.

### v0.1.0 (Current)
- [x] Core compiler (lexer, parser, AST, codegen)
- [x] Rust code generation (Anchor-compatible)
- [x] TypeScript SDK generation
- [x] CLI with 15+ commands
- [x] Standard library (13 modules)
- [x] Runtime layer
- [x] 11 project templates
- [x] 7 examples
- [x] Documentation

### v0.2.0 (Planned)
- [ ] LSP (Language Server Protocol) for IDE support
- [ ] VS Code extension with syntax highlighting
- [ ] Improved error messages with suggestions
- [ ] Frontend compilation to React/Next.js

### v0.3.0 (Future)
- [ ] Package manager (`purp install`)
- [ ] Plugin system
- [ ] Debugger integration
- [ ] Formal verification tools

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
  <strong>Purp SCL v0.1.0</strong> — Built for the Solana ecosystem 💜
</p>
