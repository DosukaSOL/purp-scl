# Purp SCL — Installation Guide

## System Requirements

- **Node.js** 18.0 or later
- **npm** 9.0 or later (included with Node.js)
- **Git** (for cloning and version control)

### For Deployment (Optional)

- **Rust** 1.70+ with Cargo
- **Solana CLI** 1.16+
- **cargo-build-sbf** (for building Solana programs)

## Installation Methods

### Method 1: From Source (Recommended for v0.1.0)

```bash
# Clone the repository
git clone https://github.com/user/purp-scl.git
cd purp-scl

# Install Node.js dependencies
npm install

# Build the TypeScript compiler and CLI
npm run build

# Link the CLI globally so `purp` is available everywhere
npm link

# Verify the installation
purp --version
# → Purp SCL v0.1.0

# Run the doctor to check your environment
purp doctor
```

### Method 2: npm (Coming Soon)

```bash
# Not yet published — coming in v0.2.0
npm install -g purp-scl
```

## Verify Installation

Run `purp doctor` to verify all dependencies:

```
$ purp doctor

🔍 Checking system dependencies...

  ✓ Node.js     v20.10.0
  ✓ npm          v10.2.0
  ✓ Rust         v1.75.0
  ✓ Cargo        v1.75.0
  ✓ Solana CLI   v1.17.0
  ✓ cargo-build-sbf
  ✓ Git          v2.42.0

All checks passed!
```

## Troubleshooting

### Node.js not found
Install Node.js from [nodejs.org](https://nodejs.org) or use a version manager:
```bash
# Using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Rust not found
Install Rust via rustup:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Solana CLI not found
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

### cargo-build-sbf not found
```bash
cargo install --locked cargo-build-sbf
```

## Uninstall

```bash
# Remove global link
npm unlink -g purp-scl

# Remove the source directory
rm -rf purp-scl
```
