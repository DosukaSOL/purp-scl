# Purp vs Anchor

A comparison between Purp SCL and Anchor Framework for Solana development.

## Overview

| | **Purp** | **Anchor** |
|---|---|---|
| **Language** | Purp (.purp) | Rust (.rs) |
| **Learning Curve** | Low — familiar syntax | High — requires Rust expertise |
| **Boilerplate** | Minimal — auto-generated | Moderate — derive macros help but still verbose |
| **Client Code** | Auto-generated from same file | Separate TypeScript project |
| **Frontend** | Built-in `frontend {}` block | Not included |
| **Type Safety** | Static typing + semantic analysis | Rust's type system |
| **Output** | Anchor-compatible Rust + TypeScript SDK | Native Rust |

## Code Comparison

### Defining an Account

**Purp:**
```
account UserProfile {
  owner: pubkey,
  name: string,
  balance: u64
}
```

**Anchor (Rust):**
```rust
#[account]
pub struct UserProfile {
    pub owner: Pubkey,
    pub name: String,
    pub balance: u64,
}
```

### Writing an Instruction

**Purp:**
```
pub instruction create_profile(
  #[mut] signer user,
  #[init] account profile,
  name: string
) {
  profile.owner = user;
  profile.name = name;
  profile.balance = 0;
  emit ProfileCreated(user, name);
}
```

**Anchor (Rust):**
```rust
pub fn create_profile(ctx: Context<CreateProfile>, name: String) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    profile.owner = ctx.accounts.user.key();
    profile.name = name.clone();
    profile.balance = 0;
    emit!(ProfileCreated {
        user: ctx.accounts.user.key(),
        name,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(init, payer = user, space = 8 + 32 + 256 + 8)]
    pub profile: Account<'info, UserProfile>,
    pub system_program: Program<'info, System>,
}
```

### Emitting Events

**Purp:**
```
event ProfileCreated { user: pubkey, name: string }
emit ProfileCreated(user, name);
```

**Anchor (Rust):**
```rust
#[event]
pub struct ProfileCreated {
    pub user: Pubkey,
    pub name: String,
}
emit!(ProfileCreated { user: ctx.accounts.user.key(), name });
```

## Key Differences

### 1. Lines of Code
Purp typically requires **60-80% fewer lines** than equivalent Anchor code because:
- No Context structs needed
- No space calculations
- No explicit system_program accounts
- No explicit Result<()> wrapping
- Client code is auto-generated

### 2. Learning Path
- **Purp**: Learn one language → write programs, clients, and frontends
- **Anchor**: Learn Rust → write programs, then learn TypeScript → write clients, then learn React → write frontend

### 3. Client Generation
- **Purp**: `client {}` block in the same file auto-generates TypeScript SDK
- **Anchor**: Generate IDL, then use `@coral-xyz/anchor` to create client manually

### 4. Frontend Support
- **Purp**: Native `frontend {}` block with components, state, and wallet integration
- **Anchor**: No frontend support — use a separate framework (React, Next.js, etc.)

## When to Use What

**Use Purp when:**
- You want rapid prototyping
- You're new to Solana development
- You want one codebase for program + client + frontend
- You prefer high-level abstractions

**Use Anchor when:**
- You need fine-grained control over Rust code
- You're building complex programs with advanced Rust patterns
- You need the mature ecosystem and tooling
- You're already proficient in Rust

## Compatibility

Purp compiles to Anchor-compatible Rust, which means:
- Purp-generated programs use Anchor's `#[program]`, `#[derive(Accounts)]`, `#[account]` macros
- You can deploy Purp programs alongside Anchor programs
- Purp programs can CPI into Anchor programs and vice versa
- IDLs are compatible
