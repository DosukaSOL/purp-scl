# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ Current |

## Reporting a Vulnerability

If you discover a security vulnerability in Purp SCL, please report it responsibly.

### Do NOT

- Open a public GitHub issue for security vulnerabilities
- Post about the vulnerability publicly before it's patched

### Do

1. **Email**: Send details to the maintainers (see GOVERNANCE.md for contacts)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Timeline**: We aim to acknowledge within 48 hours and patch within 7 days for critical issues

## Security Practices

### Compiler Security
- The Purp compiler runs locally and does not make network requests
- Generated Rust code uses Anchor's safety primitives
- Semantic analysis checks for missing signer validation

### CLI Security  
- `purp audit` scans for hardcoded keys, secrets, and unsafe patterns
- No telemetry or data collection
- All operations are local unless explicitly deploying

### Code Generation Safety
- Generated Rust uses `#[account]` derive macro for safe serialization
- Owner checks are generated when account ownership is verified in Purp source
- System program and rent accounts are auto-included where needed

### What We Scan For (purp audit)
- Private keys or seed phrases in source files
- Hardcoded secret strings
- Missing signer checks on state-changing instructions
- Unsafe arithmetic (overflow/underflow potential)
- Unvalidated account ownership

## Dependencies

Purp SCL has minimal runtime dependencies:
- TypeScript compiler (build-time only)
- Node.js standard library

The compiled output depends on:
- `anchor-lang` (Rust)
- `@solana/web3.js` (TypeScript)
- `@coral-xyz/anchor` (TypeScript)

## Security Updates

Security patches are released as point versions (e.g., 0.1.1) and announced through GitHub releases.
