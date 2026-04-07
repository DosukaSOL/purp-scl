<p align="center">
  <img src="./logo.png" alt="Purp Logo" width="180" />
</p>

<h1 align="center">Purp</h1>
<h3 align="center">The Solana Coding Language</h3>

<p align="center">
  Write Solana programs in a language that feels like home.<br/>
  One <code>.purp</code> file → Anchor Rust + TypeScript SDK + Frontend — ready to deploy.
</p>

<br/>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.2.1-7C3AED?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/tests-166%20passing-22C55E?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#features">Features</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#language-overview">Language</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#templates">Templates</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#roadmap">Roadmap</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#contributing">Contributing</a>
</p>

<br/>

<p align="center">
  <a href="https://solana.com">
    <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="Built for Solana" width="28" style="vertical-align: middle;" />
  </a>
  &nbsp;&nbsp;
  <strong>Built for <a href="https://solana.com">Solana</a></strong>
</p>

---

## What is Purp?

**Purp** is a high-level programming language purpose-built for [Solana](https://solana.com). It compiles `.purp` source files into:

- **[Anchor](https://www.anchor-lang.com)-compatible Rust** — ready to deploy as Solana programs
- **TypeScript SDK** — auto-generated client code using [`@solana/web3.js`](https://solana.com/docs/clients/javascript)
- **Frontend UI** — optional component output for dApp interfaces

Instead of juggling Rust, TypeScript, and IDL files separately, you write one `.purp` file that covers **on-chain logic**, **client SDK**, and **frontend UI**.

### Why Purp?

| Pain Point | Purp Solution |
|---|---|
| Rust is hard for beginners | Purp uses familiar, readable syntax |
| Anchor boilerplate is verbose | Auto-generates derive macros, account structs, IDL |
| Client code is separate from program | `client {}` block in the same file |
| Frontend needs a separate project | `frontend {}` block with built-in components |
| No standard way to handle tokens/NFTs | `@purp/stdlib` — Token, NFT, PDA, CPI helpers |
| AI agents need on-chain programs | Powers [PAW Agents](https://github.com/DosukaSOL/paw-agents) for autonomous AI on Solana |

## Quickstart

> **Prerequisites:** [Node.js](https://nodejs.org) 18+, [Rust & Cargo](https://rustup.rs), [Solana CLI](https://solana.com/docs/intro/installation), [Anchor](https://www.anchor-lang.com/docs/installation)

```bash
git clone https://github.com/DosukaSOL/purp-scl.git && cd purp-scl
npm install && npm run build && npm link
```

Create a project and start coding:

```bash
purp init my-project && cd my-project
```

Write your first program in `src/main.purp`:

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

Build and deploy:

```bash
purp check          # Type-check
purp build          # Compile → Anchor Rust + TypeScript SDK
purp deploy --network devnet
```

## Features

### Solana-Native Language
`program`, `instruction`, `account`, `signer`, `PDA`, `token`, `mint`, `NFT` — all first-class keywords. Events, errors, and [CPI](https://solana.com/docs/core/cpi) are built into the syntax.

### Hybrid Compiler
Lexer → Parser → AST → Semantic Analysis → Code Generation. Outputs [Anchor](https://www.anchor-lang.com)-compatible Rust with proper `#[program]`, `#[derive(Accounts)]`, events, and errors. Auto-generates a TypeScript client SDK.

### CLI — 14 Commands

| Command | Description |
|---|---|
| `purp init` / `purp new` | Scaffold from 11 templates |
| `purp build` | Compile `.purp` → Rust + TypeScript |
| `purp check` | Type-check without building |
| `purp deploy` | Deploy to [Solana](https://solana.com/docs/intro/installation) via Anchor |
| `purp test` | Run tests (AST → JS execution) |
| `purp dev` | Watch mode with live recompilation |
| `purp lint` | Lint with 13 Solana-specific rules |
| `purp format` | Auto-format `.purp` source |
| `purp install` / `purp publish` | Package manager |
| `purp generate` | Scaffold accounts, instructions, tokens, NFTs |
| `purp audit` | Security scanning |
| `purp doctor` | Check system dependencies |
| `purp clean` | Remove build artifacts |

### Standard Library — `@purp/stdlib`

| Module | Description |
|---|---|
| `accounts` | Account creation, validation, closing |
| `tokens` | [SPL Token](https://spl.solana.com/token) — create, mint, transfer, burn |
| `nfts` | [Metaplex](https://developers.metaplex.com) NFT — mint, update, verify |
| `pdas` | [PDA](https://solana.com/docs/core/pda) derivation and validation |
| `cpi` | [Cross-Program Invocation](https://solana.com/docs/core/cpi) helpers |
| `events` | Event emission and logging |
| `math` | Safe math with Solana constants (fees, CU limits, rent) |
| `serialization` | Borsh-compatible serialize / deserialize |
| `wallet` | Wallet connection and signing |
| `frontend` | UI components for Solana dApps |
| `defi` | DeFi primitives — AMM, staking, lending, IL calculation |
| `governance` | DAO proposals, voting, treasury, multisig |
| `game` | Game state, inventory, leaderboard helpers |
| `web` | HTTP client, JSON, WebSocket utilities |
| `token-extensions` | [Token-2022](https://solana.com/docs/core/tokens#token-extensions-program) extension size & rent calculation |

### Runtime
- `TransactionBuilder` — fluent API for building [Solana transactions](https://solana.com/docs/core/transactions)
- `AccountSerializer` / `AccountDeserializer` — Borsh-compatible serialization
- `PDAHelper` — deterministic [PDA derivation](https://solana.com/docs/core/pda)
- `SimulationEngine` — local transaction simulation

## Language Overview

<details>
<summary><strong>Program Declaration</strong></summary>

```
program MyProgram {
  // accounts, instructions, events, errors
}
```
</details>

<details>
<summary><strong>Accounts</strong></summary>

```
account UserProfile {
  owner: pubkey,
  name: string,
  balance: u64,
  is_active: bool
}
```
</details>

<details>
<summary><strong>Instructions</strong></summary>

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
</details>

<details>
<summary><strong>Events & Errors</strong></summary>

```
event Transferred { from: pubkey, amount: u64 }

error Errors {
  InsufficientFunds = "Not enough balance",
  Unauthorized = "You are not authorized"
}
```
</details>

<details>
<summary><strong>Client Block</strong></summary>

```
client {
  async fn getProfile(program, wallet: pubkey): UserProfile {
    return await program.account.UserProfile.fetch(wallet);
  }
}
```
</details>

<details>
<summary><strong>Frontend Block</strong></summary>

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
</details>

<details>
<summary><strong>Type System</strong></summary>

| Purp Type | Rust Equivalent | TypeScript Equivalent |
|---|---|---|
| `u8` … `u128` | `u8` … `u128` | `number` / `BN` |
| `i8` … `i128` | `i8` … `i128` | `number` / `BN` |
| `f32`, `f64` | `f32`, `f64` | `number` |
| `bool` | `bool` | `boolean` |
| `string` | `String` | `string` |
| `pubkey` | `Pubkey` | `PublicKey` |
| `bytes` | `Vec<u8>` | `Buffer` |
</details>

## Templates

Get started instantly with `purp init my-project --template <name>`:

| Template | Description |
|---|---|
| `hello-world` | Minimal program with one instruction |
| `memecoin-launcher` | SPL token launch with liquidity pool |
| `nft-mint` | NFT collection with minting & metadata |
| `cnft-mint` | Compressed NFT minting with Merkle tree |
| `staking-rewards` | Staking pool with reward distribution |
| `game-contract` | On-chain game with players, rounds, prizes |
| `fullstack-dapp` | Complete dApp — program + client + frontend |
| `website-wallet` | Website with wallet integration |
| `analytics-dashboard` | On-chain analytics with dashboard UI |
| `bot` | Trading / utility bot with config |
| `ai-solana-app` | AI model registry with on-chain inference |

## Examples

The `examples/` directory contains standalone `.purp` files:

| Example | What it demonstrates |
|---|---|
| `token-creation` | Creating and managing [SPL tokens](https://spl.solana.com/token) |
| `nft-mint` | Minting NFTs with collections |
| `pda-usage` | [Program Derived Addresses](https://solana.com/docs/core/pda) |
| `frontend-interaction` | Connecting frontend to on-chain program |
| `wallet-flow` | Wallet connect, sign, send |
| `simple-game` | Rock-Paper-Scissors on-chain |
| `rewards-system` | Staking and reward distribution |

## Project Structure

<details>
<summary>Click to expand</summary>

```
purp-scl/
├── compiler/           # Lexer, Parser, AST, Semantic, TypeChecker, Codegen
│   └── src/
│       ├── lexer/
│       ├── parser/
│       ├── ast/
│       ├── semantic/
│       ├── typechecker/
│       ├── codegen/    # → Anchor Rust, TypeScript, IDL, Frontend
│       ├── formatter/
│       ├── linter/
│       ├── sourcemap/
│       ├── plugins/
│       └── errors/
├── cli/                # 14 CLI commands
├── lsp/                # Language Server Protocol (diagnostics, completion, hover)
├── editor/             # VS Code extension + TextMate grammar
├── runtime/            # TransactionBuilder, PDA, Simulation
├── stdlib/             # Standard library (15 modules)
├── templates/          # 11 project templates
├── examples/           # 7 example programs
├── tests/              # 166 tests across 9 suites
├── docs/
├── spec/
└── website/
```
</details>

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full roadmap.

| Version | Highlights | Status |
|---|---|---|
| **v0.1.0** | Core compiler, Rust codegen, CLI, stdlib, 11 templates | ✅ |
| **v0.2.0** | LSP, VS Code extension, type checker, formatter, linter, source maps | ✅ |
| **v0.3.0** | Package manager, plugin system, deploy pipeline, dev watch, simulation | ✅ |
| **v1.0.0** | Hardened type checker, expanded linter (13 rules), `purp test` + `purp run`, 136 tests | ✅ |
| **v1.2.0** | DeFi, DAO, Token-2022, game & serialization modules, 3 new templates, 166 tests | ✅ |
| **v1.2.1** | Audit-driven fixes — 15 bugs resolved from official Solana doc review | ✅ Current |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
git checkout -b feature/amazing
# Write code + tests
purp check && npm test
# Submit a PR
```

## License

MIT — see [LICENSE](./LICENSE) for details.

## See Also

- **[PAW Agents](https://github.com/DosukaSOL/paw-agents)** — The operating system for autonomous AI workers. Purp writes the on-chain programs that PAW Agents interact with.

---

<p align="center">
  <br/>
  <a href="https://solana.com">
    <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="Solana" width="20" style="vertical-align: middle;" />
  </a>
  &nbsp;
  <strong>Solana Resources</strong>
  <br/><br/>
  <a href="https://solana.com">Solana</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://solana.com/docs">Solana Docs</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://www.anchor-lang.com">Anchor</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://spl.solana.com">SPL</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://explorer.solana.com">Explorer</a>
  <br/><br/>
  <strong>Purp SCL v1.2.1</strong>&nbsp;&nbsp;—&nbsp;&nbsp;Built for the Solana ecosystem
  <br/><br/>
</p>
