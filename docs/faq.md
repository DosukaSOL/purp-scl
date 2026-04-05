# Frequently Asked Questions

## General

### What is Purp?
Purp is a programming language (Solana Coding Language) that compiles to Anchor-compatible Rust and TypeScript. It's designed to make Solana development faster and more accessible.

### Is Purp free and open source?
Yes. Purp is MIT licensed and fully open source.

### What version is Purp?
v0.1.0 — the initial MVP release.

### Does Purp replace Anchor?
No. Purp **compiles to** Anchor-compatible Rust. Think of it as a higher-level language that produces Anchor output. You can use both in the same project.

## Language

### What does a `.purp` file look like?
```
program MyProgram {
  account Data { value: u64 }
  pub instruction set_value(#[mut] signer auth, #[mut] account data, value: u64) {
    data.value = value;
  }
}
```

### Can I use Purp with existing Anchor programs?
Yes. Purp-generated programs are standard Anchor programs. They can CPI into other Anchor programs and vice versa.

### Does Purp support all Solana features?
v0.1.0 covers: programs, instructions, accounts, events, errors, PDAs, tokens, NFTs, CPI, and basic frontend. Advanced features (versioned transactions, address lookup tables, etc.) are planned for future releases.

### What types does Purp support?
All Solana-relevant types: `u8`-`u128`, `i8`-`i128`, `f32`, `f64`, `bool`, `string`, `pubkey`, `bytes`, arrays, structs, enums.

## CLI

### How do I install Purp?
```bash
git clone https://github.com/user/purp-scl.git
cd purp-scl && npm install && npm run build && npm link
```

### How do I create a new project?
```bash
purp init my-project
# or with a template:
purp init my-project --template memecoin-launcher
```

### How do I build my project?
```bash
purp build
```

### How do I deploy?
```bash
purp deploy --network devnet
```

## Technical

### What does Purp compile to?
Two targets:
1. **Rust** — Anchor-compatible Rust with `#[program]`, `#[derive(Accounts)]`, `#[account]` macros
2. **TypeScript** — Client SDK with async methods, proper types, and @solana/web3.js imports

### Is the compiled Rust code readable?
Yes. The Rust output is formatted and uses standard Anchor patterns. You can inspect, modify, and deploy it directly.

### Does Purp have a type system?
Yes. Purp is statically typed with semantic analysis that catches errors before compilation.

### Can I debug Purp programs?
In v0.1.0, debugging is done via the generated Rust and TypeScript code. A Purp-native debugger is planned for future releases.

### Does Purp support testing?
Yes. `purp test` runs tests. You can also test the generated Rust code with Anchor's testing framework.

## Frontend

### Does Purp really support frontend code?
Yes. The `frontend {}` block defines UI components with state, events, and wallet integration. In v0.1.0 this is a specification — full compilation to React/Next.js is planned for v0.2.0.

### What frontend framework does Purp use?
The frontend block is framework-agnostic in syntax. Compilation targets React/Next.js are planned.

## Roadmap

### What's coming next?
- v0.2.0: LSP, VS Code extension, improved errors, frontend compilation
- v0.3.0: Package manager, plugin system, debugger
- See [ROADMAP.md](../ROADMAP.md) for details.

### How can I contribute?
See [CONTRIBUTING.md](../CONTRIBUTING.md). We welcome PRs for compiler improvements, new stdlib modules, templates, and documentation.
