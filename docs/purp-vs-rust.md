# Purp vs Hand-Written Rust

A comparison between Purp SCL and writing Solana programs manually in Rust.

## Overview

| | **Purp** | **Hand-Written Rust** |
|---|---|---|
| **Language** | Purp (.purp) | Rust (.rs) |
| **Learning Curve** | Low — familiar syntax | High — requires Rust expertise |
| **Boilerplate** | Minimal — auto-generated | High — manual dispatch, validation, serialization |
| **Client Code** | Auto-generated from same file | Separate TypeScript project |
| **Frontend** | Built-in `frontend {}` block | Not included |
| **Type Safety** | Static typing + semantic analysis | Rust's type system |
| **Output** | Pinocchio-powered Rust + TypeScript SDK | Native Rust |

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

**Rust (Pinocchio):**
```rust
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct UserProfile {
    pub owner: Address,
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

**Rust (Pinocchio):**
```rust
pub fn create_profile(program_id: &Address, accounts: &[AccountView], data: &[u8]) -> ProgramResult {
    let user = &accounts[0];
    let profile = &accounts[1];
    if !user.is_signer() { return Err(ProgramError::MissingRequiredSignature); }
    // deserialize and set fields...
    Ok(())
}
```

### Emitting Events

**Purp:**
```
event ProfileCreated { user: pubkey, name: string }
emit ProfileCreated(user, name);
```

**Rust (Pinocchio):**
```rust
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct ProfileCreated {
    pub user: Address,
    pub name: String,
}
msg!("event:ProfileCreated");
```

## Key Differences

### 1. Lines of Code
Purp typically requires **60-80% fewer lines** than equivalent hand-written Rust because:
- No Context structs needed
- No space calculations
- No explicit system_program accounts
- No explicit Result<()> wrapping
- Client code is auto-generated

### 2. Learning Path
- **Purp**: Learn one language → write programs, clients, and frontends
- **Hand-written Rust**: Learn Rust → write programs, then learn TypeScript → write clients, then learn React → write frontend

### 3. Client Generation
- **Purp**: `client {}` block in the same file auto-generates TypeScript SDK
- **Hand-written Rust**: Build IDL separately, then write TypeScript client manually

### 4. Frontend Support
- **Purp**: Native `frontend {}` block with components, state, and wallet integration
- **Hand-written Rust**: No frontend support — use a separate framework (React, Next.js, etc.)

## When to Use What

**Use Purp when:**
- You want rapid prototyping
- You're new to Solana development
- You want one codebase for program + client + frontend
- You prefer high-level abstractions

**Use hand-written Rust when:**
- You need fine-grained control over Rust code
- You're building complex programs with advanced Rust patterns
- You need the mature ecosystem and tooling
- You're already proficient in Rust

## Compatibility

Purp compiles to Pinocchio-powered Rust, which means:
- Purp-generated programs use Pinocchio's zero-dependency `AccountView`, `Address`, and manual dispatch
- You can deploy Purp programs alongside any Solana program
- Purp programs can CPI into other programs and vice versa
- IDLs are compatible
