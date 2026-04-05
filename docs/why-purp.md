# Why Purp?

## The Problem

Building on Solana today requires mastering multiple languages and tools:

1. **Rust** for on-chain programs
2. **Anchor framework** for reduced boilerplate (still Rust)
3. **TypeScript** for client SDKs
4. **React/Next.js** for frontends
5. **@solana/web3.js** for transaction construction
6. **Metaplex SDKs** for NFTs
7. **SPL Token libraries** for token operations

Each layer has its own learning curve, configuration, and failure modes. A simple "create token and display it on a website" requires:
- A Rust program with Anchor macros
- A TypeScript client with web3.js
- A React frontend with wallet adapter
- IDL generation and linking
- Multiple `package.json`, `Cargo.toml`, and config files

## The Solution

**Purp** collapses all of these into a single language:

```
program TokenApp {
  account MyToken { ... }
  pub instruction create_token(...) { ... }
  event TokenCreated { ... }
}

client {
  async fn getToken(program): MyToken { ... }
}

frontend {
  page "/" {
    component App {
      render { <WalletButton /> ... }
    }
  }
}
```

One file. One language. One build step.

## Design Goals

### 1. Solana-Native
Every keyword maps to a Solana concept. No generic blockchain abstractions — Purp is built specifically for Solana's account model, Program Derived Addresses, and transaction architecture.

### 2. Beginner-Friendly
If you know JavaScript or Python, you can read Purp. The syntax is deliberately familiar:
- `let` and `const` for variables
- `if/else`, `for`, `while` for control flow
- `fn` for functions
- Curly braces for blocks

### 3. Production-Ready Output
Purp doesn't interpret code — it **compiles** to:
- Anchor-compatible Rust (industry standard)
- TypeScript SDK (ready for integration)

This means your deployed program is identical to what you'd write by hand in Anchor.

### 4. Zero Boilerplate
Purp auto-generates:
- Context structs (`#[derive(Accounts)]`)
- Account space calculations
- System program account declarations
- IDL generation
- Client SDK classes

### 5. Full-Stack in One Language
The `client {}` and `frontend {}` blocks mean you can prototype an entire dApp without leaving Purp.

## Who is Purp For?

- **Web developers** who want to build on Solana without learning Rust
- **Hackathon participants** who need to ship fast
- **Educators** teaching Solana development
- **Prototypers** who want to validate ideas quickly
- **Teams** who want a unified language across their stack
- **Solo developers** who don't want to maintain separate Rust, TS, and React codebases

## What Purp is NOT

- **Not a replacement for Rust** — complex programs may still benefit from hand-written Rust
- **Not an interpreter** — Purp compiles to real Anchor code that deploys normally
- **Not a framework** — it's a language with its own compiler
- **Not chain-agnostic** — Purp is Solana-only by design

## The Vision

Purp aims to be the **TypeScript of Solana** — a developer-friendly language that compiles to the platform's native format, making blockchain development accessible to millions of developers who already know how to code but haven't yet built on Solana.
