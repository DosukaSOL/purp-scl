// ============================================================================
// purp audit — Security audit
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { findPurpFiles } from '../utils/index.js';

const SENSITIVE_PATTERNS = [
  { pattern: /[1-9A-HJ-NP-Za-km-z]{32,44}/, name: 'Possible Solana private key' },
  { pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, name: 'Private key file' },
  { pattern: /sk_live_[a-zA-Z0-9]+/, name: 'Stripe secret key' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS access key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub personal access token' },
  { pattern: /\b(secret|password|token|api_key|apikey)\s*[:=]\s*["'][^"']+["']/i, name: 'Hardcoded secret' },
];

export async function auditCommand(args: string[]): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Security Audit\x1b[0m');
  console.log('');

  let issues = 0;

  // Check .gitignore
  if (!fs.existsSync('.gitignore')) {
    console.log('  \x1b[31m✖\x1b[0m Missing .gitignore');
    issues++;
  } else {
    const gitignore = fs.readFileSync('.gitignore', 'utf-8');
    if (!gitignore.includes('.env')) {
      console.log('  \x1b[33m⚠\x1b[0m .gitignore does not exclude .env files');
      issues++;
    } else {
      console.log('  \x1b[32m✓\x1b[0m .gitignore properly configured');
    }
  }

  // Check for .env with real secrets
  if (fs.existsSync('.env')) {
    console.log('  \x1b[33m⚠\x1b[0m .env file exists — ensure it is in .gitignore');
  }

  // Check for .env.example
  if (fs.existsSync('.env.example')) {
    console.log('  \x1b[32m✓\x1b[0m .env.example present');
  } else {
    console.log('  \x1b[33m⚠\x1b[0m Missing .env.example — recommended for team onboarding');
  }

  // Scan source files for sensitive patterns
  console.log('');
  console.log('  Scanning source files...');

  const extensions = ['.purp', '.ts', '.js', '.json', '.toml', '.yaml', '.yml'];
  const scanDirs = ['src', 'tests', 'scripts', '.'];

  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    scanDir(dir, extensions, (file, line, lineNum, finding) => {
      console.log(`  \x1b[31m✖\x1b[0m ${file}:${lineNum} — ${finding}`);
      issues++;
    });
  }

  // Check for wallet JSON files
  const walletFiles = findFilesRecursive('.', f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json' && f !== 'tsconfig.json');
  for (const wf of walletFiles) {
    try {
      const content = fs.readFileSync(wf, 'utf-8');
      if (content.includes('"keypair"') || (content.startsWith('[') && content.includes(','))) {
        console.log(`  \x1b[31m✖\x1b[0m ${wf} — Possible wallet/keypair file`);
        issues++;
      }
    } catch { /* skip */ }
  }

  console.log('');
  if (issues === 0) {
    console.log('\x1b[32m✓ No security issues found\x1b[0m');
  } else {
    console.log(`\x1b[31m✖ Found ${issues} potential issue(s)\x1b[0m`);
    console.log('  Review and fix before committing.');
  }
}

function scanDir(dir: string, extensions: string[], onFinding: (file: string, line: string, lineNum: number, finding: string) => void): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'target', 'dist'].includes(entry.name)) {
        scanDir(fullPath, extensions, onFinding);
      }
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          for (const { pattern, name } of SENSITIVE_PATTERNS) {
            if (pattern.test(lines[i])) {
              onFinding(fullPath, lines[i], i + 1, name);
            }
          }
        }
      } catch { /* skip binary files */ }
    }
  }
}

function findFilesRecursive(dir: string, filter: (f: string) => boolean): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', '.git', 'target'].includes(entry.name)) {
        results.push(...findFilesRecursive(fullPath, filter));
      } else if (entry.isFile() && filter(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch { /* skip */ }
  return results;
}
