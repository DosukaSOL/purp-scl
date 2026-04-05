# Purp SCL — Architecture

## High-Level Overview

```
  .purp source file
        │
        ▼
  ┌─────────────┐
  │    Lexer     │  → Tokens
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │   Parser     │  → AST (Abstract Syntax Tree)
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Semantic    │  → Validated AST + Diagnostics
  │  Analyzer    │
  └──────┬──────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│  Rust  │ │TypeScript│
│Codegen │ │ Codegen  │
└────┬───┘ └────┬─────┘
     │          │
     ▼          ▼
  .rs files  .ts files
  (Anchor)   (SDK)
```

## Components

### 1. Lexer (`compiler/src/lexer/`)

The lexer (tokenizer) converts raw `.purp` source text into a stream of typed tokens.

**Key features:**
- ~100 token types including all Solana-native keywords
- String literal support with escape sequences
- Number literals (integer and float)
- Single-line (`//`) and multi-line (`/* */`) comments
- Tracks line and column for error reporting

**Token categories:**
- **Keywords**: `program`, `instruction`, `account`, `signer`, `pub`, `fn`, `let`, `mut`, `const`, etc.
- **Solana-specific**: `PDA`, `CPI`, `token`, `mint`, `NFT`, `spl`, `emit`, `assert`
- **Literals**: numbers, strings, booleans, `null`
- **Operators**: arithmetic, comparison, logical, bitwise, assignment
- **Delimiters**: braces, parentheses, brackets, commas, semicolons

### 2. Parser (`compiler/src/parser/`)

Recursive descent parser with precedence climbing for expressions.

**Produces** an Abstract Syntax Tree (AST) from the token stream.

**Handles:**
- Top-level declarations: `program`, `import`, `struct`, `enum`, `fn`, `const`, `type`, `impl`, `trait`
- Program members: `instruction`, `account`, `event`, `error`, `client`, `frontend`, `config`
- Statements: `let`, `const`, `if/else`, `for`, `while`, `match`, `return`, `emit`, `assert`
- Expressions: binary ops (with precedence), unary, member access, function calls, array/object literals, type casts

### 3. AST (`compiler/src/ast/`)

Full type definitions for every node in the tree:

- **Program nodes**: `ProgramNode`, `InstructionDeclaration`, `AccountDeclaration`
- **Declaration nodes**: `StructDeclaration`, `EnumDeclaration`, `FunctionDeclaration`, `ImportDeclaration`
- **Statement nodes**: `LetStatement`, `IfStatement`, `ForStatement`, `WhileStatement`, `MatchStatement`, `ReturnStatement`, `EmitStatement`, `AssertStatement`
- **Expression nodes**: `BinaryExpression`, `UnaryExpression`, `CallExpression`, `MemberExpression`, `ArrayLiteral`, `ObjectLiteral`, `CastExpression`

### 4. Semantic Analyzer (`compiler/src/semantic/`)

Validates the AST before code generation:

- **Scope tracking**: Manages nested scopes with symbol tables
- **Duplicate detection**: Prevents duplicate program, account, instruction names
- **Type registration**: Registers accounts, structs, enums in scope
- **Instruction validation**: Ensures instructions have at least one signer
- **Error reporting**: Produces typed diagnostics with source location

### 5. Code Generation (`compiler/src/codegen/`)

#### Rust Codegen (`codegen/rust/`)
Generates Anchor-compatible Rust:
- `declare_id!()` macro
- `#[program]` module with instruction handlers
- `#[derive(Accounts)]` context structs
- `#[account]` data structs with Borsh serialization
- `#[event]` and `#[error_code]` macros
- Proper type mapping (pubkey → Pubkey, string → String, etc.)

#### TypeScript Codegen (`codegen/typescript/`)
Generates SDK client code:
- Program client class with async methods
- TypeScript interfaces for all accounts
- Proper type mapping (u64 → BN, pubkey → PublicKey, etc.)
- @solana/web3.js and @coral-xyz/anchor imports

### 6. Error System (`compiler/src/errors/`)

- **Error codes**: Categorized by phase (1xxx = Lexer, 2xxx = Parser, 3xxx = Semantic, 4xxx = Codegen, 5xxx = Runtime)
- **PurpError class**: Rich error objects with code, message, source location, and `formatted()` method
- **PurpDiagnostics**: Collection class with error/warning tracking and `hasErrors()`/`summarize()` methods

## CLI Architecture

The CLI (`cli/src/`) uses a simple command router pattern:

```
purp <command> [args]
    │
    ▼
index.ts (entry point, banner, help)
    │
    ▼
commands/index.ts (router)
    │
    ├── build.ts    → Find .purp files, compile, write output
    ├── init.ts     → Scaffold new project
    ├── check.ts    → Type-check without build
    ├── deploy.ts   → Deploy to Solana
    ├── dev.ts      → Watch mode
    ├── test.ts     → Run tests
    ├── generate.ts → Code generation templates
    ├── doctor.ts   → Check dependencies
    ├── clean.ts    → Remove build artifacts
    ├── audit.ts    → Security scan
    └── run.ts      → Run scripts
```

## Runtime Architecture

The runtime (`runtime/src/`) provides:

- **TransactionBuilder**: Fluent API for constructing Solana transactions with instruction chaining
- **AccountSerializer/Deserializer**: Borsh-compatible binary serialization
- **PDAHelper**: Deterministic Program Derived Address computation
- **SimulationEngine**: Local transaction simulation for testing

## Standard Library

The stdlib (`stdlib/src/`) provides 13 modules covering common Solana operations:

| Module | Purpose |
|---|---|
| accounts | Account lifecycle management |
| tokens | SPL Token operations |
| nfts | Metaplex NFT operations |
| pdas | PDA derivation utilities |
| cpi | Cross-Program Invocation |
| events | Event emission |
| math | Safe arithmetic |
| serialization | Borsh encoding/decoding |
| wallet | Wallet adapter abstraction |
| frontend | UI component primitives |
| game | Game development helpers |
| web | HTTP/WebSocket client |
| ai | AI model integration |

## Design Principles

1. **Solana-first**: Every language feature maps to a Solana concept
2. **Zero boilerplate**: Auto-generate what can be auto-generated
3. **Single source of truth**: One `.purp` file covers program + client + frontend
4. **Familiar syntax**: Influenced by Rust, TypeScript, and Solidity
5. **Safe by default**: Semantic analysis catches errors before deployment
6. **Extensible**: Modular architecture allows new codegen targets
