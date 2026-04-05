#!/bin/bash
# Purp SCL — Pre-commit hook
# Install: cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

echo "🔍 Running pre-commit checks..."

# 1. Check for secrets
echo "  Checking for secrets..."
if grep -rn "private.*key\|secret.*key\|BEGIN.*PRIVATE" --include="*.ts" --include="*.purp" --include="*.js" compiler/ cli/ stdlib/ runtime/ templates/ examples/ 2>/dev/null; then
  echo "  ✗ Potential secrets found! Remove them before committing."
  exit 1
fi
echo "  ✓ No secrets detected"

# 2. Build check
echo "  Building project..."
npm run build 2>/dev/null
if [ $? -ne 0 ]; then
  echo "  ✗ Build failed! Fix errors before committing."
  exit 1
fi
echo "  ✓ Build passed"

echo "✓ All pre-commit checks passed"
