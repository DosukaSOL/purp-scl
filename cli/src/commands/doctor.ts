// ============================================================================
// purp doctor — Check system dependencies
// ============================================================================

import { execSync } from 'node:child_process';

interface CheckResult {
  name: string;
  found: boolean;
  version?: string;
  required: boolean;
  hint?: string;
}

export async function doctorCommand(): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Doctor\x1b[0m');
  console.log('  Checking system dependencies...');
  console.log('');

  const checks: CheckResult[] = [
    checkCommand('node', 'node --version', true, 'Install Node.js 18+ from https://nodejs.org'),
    checkCommand('npm', 'npm --version', true),
    checkCommand('Rust', 'rustc --version', false, 'Install from https://rustup.rs'),
    checkCommand('Cargo', 'cargo --version', false),
    checkCommand('Solana CLI', 'solana --version', false, 'Install from https://docs.solana.com/cli/install-solana-cli-tools'),
    checkCommand('Anchor', 'anchor --version', false, 'Install from https://www.anchor-lang.com/docs/installation'),
    checkCommand('Git', 'git --version', true),
  ];

  let allGood = true;

  for (const check of checks) {
    const icon = check.found ? '\x1b[32m✓\x1b[0m' : (check.required ? '\x1b[31m✖\x1b[0m' : '\x1b[33m○\x1b[0m');
    const version = check.version ? ` (${check.version})` : '';
    const status = check.found ? 'found' : (check.required ? 'MISSING' : 'not found (optional)');
    console.log(`  ${icon} ${check.name}: ${status}${version}`);
    if (!check.found && check.hint) {
      console.log(`     → ${check.hint}`);
    }
    if (!check.found && check.required) allGood = false;
  }

  console.log('');
  if (allGood) {
    console.log('\x1b[32m✓ All required dependencies found\x1b[0m');
  } else {
    console.log('\x1b[31m✖ Some required dependencies are missing\x1b[0m');
  }
}

function checkCommand(name: string, cmd: string, required: boolean, hint?: string): CheckResult {
  try {
    const version = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return { name, found: true, version, required, hint };
  } catch {
    return { name, found: false, required, hint };
  }
}
