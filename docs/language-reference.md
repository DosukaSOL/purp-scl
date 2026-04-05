# Purp SCL — Language Reference

## Overview

Purp is a statically-typed, compiled language designed for the Solana blockchain. Source files use the `.purp` extension and compile to Anchor-compatible Rust and TypeScript.

## Program Declaration

Every Purp file starts with a `program` declaration:

```
program MyProgram {
  // accounts, instructions, events, errors, functions
}
```

A program maps 1:1 to a Solana on-chain program (smart contract).

## Imports

```
import { Token, NFT } from "@purp/stdlib";
import { MyHelper } from "./utils.purp";
```

## Data Types

### Primitive Types

| Type | Description | Size |
|---|---|---|
| `u8` | Unsigned 8-bit integer | 1 byte |
| `u16` | Unsigned 16-bit integer | 2 bytes |
| `u32` | Unsigned 32-bit integer | 4 bytes |
| `u64` | Unsigned 64-bit integer | 8 bytes |
| `u128` | Unsigned 128-bit integer | 16 bytes |
| `i8` | Signed 8-bit integer | 1 byte |
| `i16` | Signed 16-bit integer | 2 bytes |
| `i32` | Signed 32-bit integer | 4 bytes |
| `i64` | Signed 64-bit integer | 8 bytes |
| `i128` | Signed 128-bit integer | 16 bytes |
| `f32` | 32-bit float | 4 bytes |
| `f64` | 64-bit float | 8 bytes |
| `bool` | Boolean | 1 byte |
| `string` | UTF-8 string | Variable |
| `pubkey` | Solana public key (32 bytes) | 32 bytes |
| `bytes` | Raw byte array | Variable |

### Composite Types

```
// Arrays
let numbers: u64[] = [1, 2, 3];

// Structs (via account or inline struct)
struct Point {
  x: f64,
  y: f64
}

// Enums
enum Status {
  Active,
  Paused,
  Closed
}

// Option
let maybe_name: string? = null;

// Tuples (via struct)
```

## Accounts

Accounts define on-chain data structures:

```
account UserProfile {
  owner: pubkey,
  name: string,
  balance: u64,
  is_active: bool,
  created_at: i64
}
```

Each account compiles to a Rust struct with `#[account]` derive and Borsh serialization.

## Instructions

Instructions are the entry points of a Solana program:

```
pub instruction transfer(
  #[mut] signer sender,        // Mutable signer (pays for tx)
  #[mut] account from_account,  // Mutable account
  #[mut] account to_account,    // Mutable account
  amount: u64                   // Instruction data
) {
  assert(from_account.owner == sender, "Not owner");
  assert(from_account.balance >= amount, "Insufficient");
  from_account.balance -= amount;
  to_account.balance += amount;
  emit Transferred(sender, amount);
}
```

### Parameter Attributes

| Attribute | Meaning |
|---|---|
| `signer` | Account must sign the transaction |
| `#[mut]` | Account is mutable |
| `#[init]` | Account will be initialized (created) |
| `account` | Read-only account reference |

## Events

```
event Transferred {
  from: pubkey,
  to: pubkey,
  amount: u64
}
```

Emit events inside instructions:
```
emit Transferred(sender, recipient, amount);
```

## Errors

```
error InsufficientFunds = "Not enough balance"
error Unauthorized = "You are not authorized"
error InvalidInput = "Invalid input provided"
```

## Functions

Internal helper functions:

```
fn calculate_fee(amount: u64, bps: u16): u64 {
  return amount * bps as u64 / 10000;
}
```

## Control Flow

### If/Else
```
if balance > 0 {
  // ...
} else if balance == 0 {
  // ...
} else {
  // ...
}
```

### For Loops
```
for item in items {
  // ...
}

for i in 0..10 {
  // ...
}
```

### While Loops
```
while condition {
  // ...
}
```

### Match
```
match status {
  Status::Active => { /* ... */ },
  Status::Paused => { /* ... */ },
  Status::Closed => { /* ... */ }
}
```

## Variables

```
let name = "hello";           // Immutable (inferred type)
let mut counter: u64 = 0;     // Mutable with explicit type
const MAX_SIZE: u64 = 1000;   // Compile-time constant
```

## Operators

| Category | Operators |
|---|---|
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Comparison | `==`, `!=`, `<`, `<=`, `>`, `>=` |
| Logical | `&&`, `\|\|`, `!` |
| Bitwise | `&`, `\|`, `^`, `<<`, `>>` |
| Assignment | `=`, `+=`, `-=`, `*=`, `/=` |
| Type Cast | `as` |

## Client Block

Define client-side SDK methods:

```
client {
  async fn getProfile(program, wallet: pubkey): UserProfile {
    return await program.account.UserProfile.fetch(wallet);
  }

  async fn createProfile(program, signer, name: string) {
    return await program.rpc.createProfile(name, { signer });
  }
}
```

## Frontend Block

Define frontend UI:

```
frontend {
  page "/" {
    component App {
      state items = [];

      on_mount {
        items = await client.getItems(program);
      }

      render {
        <div>
          <h1>"My App"</h1>
          <WalletButton />
          {items.map(item => <Card item={item} />)}
        </div>
      }
    }
  }

  style {
    .card { padding: "1rem"; }
  }
}
```

## Config Block

```
config {
  name = "my-project"
  version = "0.1.0"
  network = "devnet"
}
```

## Comments

```
// Single-line comment

/* 
  Multi-line 
  comment 
*/
```

## Reserved Keywords

`program`, `instruction`, `account`, `signer`, `pub`, `fn`, `let`, `mut`, `const`,
`if`, `else`, `for`, `while`, `match`, `return`, `import`, `from`, `struct`, `enum`,
`impl`, `trait`, `type`, `as`, `in`, `true`, `false`, `null`, `event`, `error`,
`emit`, `assert`, `client`, `frontend`, `config`, `page`, `component`, `state`,
`render`, `style`, `on_mount`, `async`, `await`, `PDA`, `CPI`, `token`, `mint`,
`NFT`, `spl`
