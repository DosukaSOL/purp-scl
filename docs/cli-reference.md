# Purp SCL — CLI Reference

## Usage

```bash
purp <command> [options]
```

## Commands

### `purp init <name> [--template <template>]`

Initialize a new Purp project.

```bash
purp init my-project
purp init my-token --template memecoin-launcher
```

**Options:**
- `--template <name>` — Use a project template (see Templates section)

**Creates:**
- `purp.toml` — Project configuration
- `src/main.purp` — Main program file
- `.gitignore` — Git ignore rules
- `.env.example` — Environment variables template

---

### `purp build`

Compile `.purp` files to Rust and TypeScript.

```bash
purp build
```

**Output:**
- `target/rust/` — Anchor-compatible Rust files
- `target/typescript/` — TypeScript SDK files

---

### `purp check`

Type-check and validate `.purp` files without generating output.

```bash
purp check
```

---

### `purp deploy [--network <network>]`

Deploy the compiled program to Solana.

```bash
purp deploy                      # Default: devnet
purp deploy --network mainnet-beta
purp deploy --network localnet
```

**Options:**
- `--network <network>` — Target network (`devnet`, `testnet`, `mainnet-beta`, `localnet`)

---

### `purp dev`

Start development mode with file watching and auto-recompilation.

```bash
purp dev
```

Watches `src/` for `.purp` file changes and recompiles automatically.

---

### `purp test`

Run the project's test suite.

```bash
purp test
```

---

### `purp generate <type> <name>`

Generate boilerplate code for common patterns.

```bash
purp generate instruction transfer
purp generate account UserProfile
purp generate event Transfer
purp generate error InsufficientFunds
purp generate token MyToken
purp generate nft MyCollection
```

**Types:**
| Type | Description |
|---|---|
| `instruction` | New instruction with signer and accounts |
| `account` | New account struct |
| `event` | New event definition |
| `error` | New error definition |
| `token` | SPL Token boilerplate |
| `nft` | NFT collection boilerplate |

---

### `purp doctor`

Check system dependencies and their versions.

```bash
purp doctor
```

**Checks:**
- Node.js, npm
- Rust, Cargo
- Solana CLI
- Anchor
- Git

---

### `purp clean`

Remove build artifacts.

```bash
purp clean
```

Deletes the `target/` directory.

---

### `purp audit`

Scan the project for security issues.

```bash
purp audit
```

**Checks for:**
- Hardcoded private keys
- Exposed secrets
- Unsafe patterns
- Missing signer validation

---

### `purp run <script>`

Run a script defined in `purp.toml`.

```bash
purp run setup
purp run migrate
```

---

### `purp --version`

Print the Purp version.

```bash
purp --version
# Purp SCL v0.1.0
```

---

### `purp --help`

Show help information.

```bash
purp --help
```

## Available Templates

| Template | Command |
|---|---|
| Hello World | `purp init name --template hello-world` |
| Memecoin Launcher | `purp init name --template memecoin-launcher` |
| NFT Mint | `purp init name --template nft-mint` |
| Compressed NFT | `purp init name --template cnft-mint` |
| Staking Rewards | `purp init name --template staking-rewards` |
| Game Contract | `purp init name --template game-contract` |
| Fullstack dApp | `purp init name --template fullstack-dapp` |
| Website + Wallet | `purp init name --template website-wallet` |
| Analytics Dashboard | `purp init name --template analytics-dashboard` |
| Bot | `purp init name --template bot` |
| AI + Solana | `purp init name --template ai-solana-app` |

## Configuration (purp.toml)

```toml
[project]
name = "my-project"
version = "0.1.0"
description = "My Purp project"

[solana]
network = "devnet"
program_id = ""

[build]
output = "./target"

[scripts]
setup = "npm install"
```
