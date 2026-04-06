// ============================================================================
// purp run — Compile and execute a Purp script
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { compile } from '../../../compiler/src/index.js';

export async function runCommand(args: string[]): Promise<void> {
  const file = args.find(a => !a.startsWith('-')) ?? 'src/main.purp';
  const debug = args.includes('--debug');
  const showOutput = args.includes('--show');

  if (!fs.existsSync(file)) {
    console.error(`\x1b[31m✖ File not found: ${file}\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[35m⟡\x1b[0m Running ${file}...`);
  console.log('');

  const source = fs.readFileSync(file, 'utf-8');
  const result = compile(source, { file, target: 'typescript', debug });

  if (!result.success) {
    console.error(result.diagnostics.format());
    process.exit(1);
  }

  if (!result.typescript) {
    console.error('\x1b[31m✖ No TypeScript output generated\x1b[0m');
    process.exit(1);
  }

  if (showOutput) {
    console.log('Generated TypeScript:');
    console.log('─'.repeat(60));
    console.log(result.typescript);
    console.log('─'.repeat(60));
    console.log('');
  }

  // Write to temp file and execute
  const tmpDir = path.join(os.tmpdir(), 'purp-run');
  fs.mkdirSync(tmpDir, { recursive: true });
  const baseName = path.basename(file, '.purp');
  const tmpFile = path.join(tmpDir, `${baseName}.mjs`);

  // Transform TS to runnable JS (strip type annotations, add mock imports)
  const jsCode = transformToRunnable(result.typescript);
  fs.writeFileSync(tmpFile, jsCode, 'utf-8');

  try {
    const { execSync } = await import('node:child_process');
    execSync(`node "${tmpFile}"`, { stdio: 'inherit', cwd: process.cwd() });
  } catch (err: any) {
    if (err.status) process.exit(err.status);
    console.error('\x1b[31m✖ Execution failed\x1b[0m');
    process.exit(1);
  } finally {
    // Clean up
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Transform generated TypeScript to executable JavaScript.
 * Strips type annotations and provides Solana mocks for local execution.
 */
function transformToRunnable(ts: string): string {
  const preamble = `
// Purp Runtime Mocks for local execution
const PublicKey = class PublicKey { constructor(v) { this.value = v; } toString() { return this.value; } };
const LAMPORTS_PER_SOL = 1000000000;
const web3 = { PublicKey, LAMPORTS_PER_SOL };
function msg(...args) { console.log('[msg]', ...args); }
function print(...args) { console.log(...args); }
function log(...args) { console.log(...args); }
`;

  // Strip import statements and type annotations (basic transform)
  let js = ts
    .replace(/^import\s+.*$/gm, '// (import stripped)')
    .replace(/:\s*[A-Z]\w*(?:<[^>]+>)?(?:\[\])?/g, '') // strip type annotations
    .replace(/as\s+\w+/g, '')
    .replace(/export\s+/g, '');

  return preamble + '\n' + js;
}
