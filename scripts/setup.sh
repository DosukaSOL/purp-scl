#!/bin/bash
# Purp SCL — Setup script
# Run: ./scripts/setup.sh

set -e

echo "╔══════════════════════════════════╗"
echo "║   Purp SCL — Setup v0.1.0       ║"
echo "╚══════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "✗ Node.js is required but not installed."
  echo "  Install from: https://nodejs.org"
  exit 1
fi
echo "✓ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
  echo "✗ npm is required but not installed."
  exit 1
fi
echo "✓ npm $(npm --version)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Build
echo ""
echo "Building Purp compiler and CLI..."
npm run build

# Link CLI
echo ""
echo "Linking CLI globally..."
npm link

# Install pre-commit hook
if [ -d .git ]; then
  echo ""
  echo "Installing pre-commit hook..."
  cp scripts/pre-commit.sh .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✓ Pre-commit hook installed"
fi

echo ""
echo "╔══════════════════════════════════╗"
echo "║   Setup complete!                ║"
echo "║                                  ║"
echo "║   Try: purp --help               ║"
echo "║        purp init my-project      ║"
echo "╚══════════════════════════════════╝"
