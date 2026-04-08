# Purp SCL — Quick Start Guide

Get your first Purp program running in under 5 minutes.

## Step 1: Initialize a Project

```bash
purp init my-first-program
cd my-first-program
```

This creates:
```
my-first-program/
├── purp.toml         # Project configuration
├── src/
│   └── main.purp     # Your program
├── .gitignore
└── .env.example
```

## Step 2: Write a Program

Open `src/main.purp` — it contains a hello world:

```
program HelloPurp {

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

  pub instruction update_greeting(
    #[mut] signer author,
    #[mut] account greeting,
    message: string
  ) {
    assert(greeting.author == author, "Not the author");
    greeting.message = message;
    emit GreetingUpdated(author, message);
  }

  event GreetingCreated { author: pubkey, message: string }
  event GreetingUpdated { author: pubkey, message: string }
}
```

## Step 3: Check for Errors

```bash
purp check
```

Output:
```
✓ src/main.purp — no errors
```

## Step 4: Build

```bash
purp build
```

This generates:
- `target/rust/hello_purp.rs` — Pinocchio-powered Rust program
- `target/typescript/hello_purp.ts` — TypeScript client SDK

## Step 5: Review Generated Code

### Rust Output (simplified)
```rust
use pinocchio::{AccountView, Address, entrypoint, ProgramResult};

declare_id!("...");

#[program]
pub mod hello_purp {
    use super::*;

    pub fn create_greeting(ctx: Context<CreateGreeting>, message: String) -> Result<()> {
        let greeting = &mut ctx.accounts.greeting;
        greeting.message = message.clone();
        greeting.author = ctx.accounts.author.key();
        emit!(GreetingCreated {
            author: ctx.accounts.author.key(),
            message,
        });
        Ok(())
    }
}
```

### TypeScript Output (simplified)
```typescript
export class HelloPurpClient {
  async createGreeting(author: PublicKey, message: string) {
    // ... auto-generated transaction code
  }
}
```

## Step 6: Deploy (Optional)

Requires Solana CLI and cargo-build-sbf:

```bash
# Deploy to devnet
purp deploy --network devnet

# Deploy to mainnet
purp deploy --network mainnet-beta
```

## Next Steps

- Explore [Templates](../templates/) for more complex examples
- Read the [Language Reference](./language-reference.md)
- Check the [CLI Reference](./cli-reference.md)
- Browse [Examples](../examples/) for specific patterns
