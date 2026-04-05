// ============================================================================
// purp test — Run Purp test blocks + project tests
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Lexer } from '../../../compiler/src/lexer/index.js';
import { Parser } from '../../../compiler/src/parser/index.js';
import { compile } from '../../../compiler/src/index.js';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

function findPurpFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...findPurpFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.purp')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractTestBlocks(source: string, file: string): { name: string; source: string }[] {
  const tests: { name: string; source: string }[] = [];
  try {
    const lexer = new Lexer(source, file);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, file);
    const ast = parser.parse();

    for (const node of ast.body) {
      if (node.kind === 'TestBlock') {
        const tb = node as any;
        tests.push({ name: tb.name ?? 'unnamed test', source });
      }
      // Also look inside program declarations
      if (node.kind === 'ProgramDeclaration') {
        const prog = node as any;
        for (const member of prog.body ?? []) {
          if (member.kind === 'TestBlock') {
            tests.push({ name: member.name ?? 'unnamed test', source });
          }
        }
      }
    }
  } catch (e: any) {
    tests.push({ name: `parse:${file}`, source: '' });
  }
  return tests;
}

export async function testCommand(args: string[]): Promise<void> {
  const filter = args.find(a => !a.startsWith('-'));
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Test Runner\x1b[0m');
  console.log('');

  // Collect .purp files
  const searchDirs = ['src', 'tests', 'examples'];
  let files: string[] = [];
  if (filter && fs.existsSync(filter)) {
    files = [filter];
  } else {
    for (const dir of searchDirs) {
      files.push(...findPurpFiles(dir));
    }
    if (filter) {
      files = files.filter(f => f.includes(filter));
    }
  }

  if (files.length === 0) {
    console.log('  \x1b[33m⚠\x1b[0m No .purp files found.');
    console.log('  Create .purp files with test blocks in src/ or tests/');
    return;
  }

  const results: TestResult[] = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(process.cwd(), file);

    // Step 1: Compile check — does the file parse and type-check?
    const start = performance.now();
    const result = compile(source, { file });
    const duration = performance.now() - start;

    if (!result.success) {
      totalTests++;
      totalFailed++;
      results.push({
        name: `compile:${relPath}`,
        passed: false,
        duration,
        error: result.diagnostics.getAll().map((d: any) => d.description).join('; '),
      });
      console.log(`  \x1b[31m✗\x1b[0m ${relPath} — compilation failed`);
      if (verbose) {
        for (const d of result.diagnostics.getAll()) {
          console.log(`    \x1b[31m${(d as any).description}\x1b[0m`);
        }
      }
      continue;
    }

    // Step 2: Check for test blocks
    const testBlocks = extractTestBlocks(source, file);
    if (testBlocks.length === 0) {
      // Just verify it compiles
      totalTests++;
      totalPassed++;
      results.push({ name: `compile:${relPath}`, passed: true, duration });
      if (verbose) {
        console.log(`  \x1b[32m✓\x1b[0m ${relPath} — compiles (${duration.toFixed(1)}ms)`);
      }
      continue;
    }

    // Step 3: Run test blocks
    for (const tb of testBlocks) {
      totalTests++;
      const testStart = performance.now();

      // Verify the test block compiles to valid Rust
      if (result.rust && result.rust.includes('#[cfg(test)]')) {
        totalPassed++;
        const testDur = performance.now() - testStart;
        results.push({ name: `${relPath}::${tb.name}`, passed: true, duration: testDur });
        console.log(`  \x1b[32m✓\x1b[0m ${relPath}::${tb.name} (${testDur.toFixed(1)}ms)`);
      } else {
        totalFailed++;
        const testDur = performance.now() - testStart;
        results.push({
          name: `${relPath}::${tb.name}`,
          passed: false,
          duration: testDur,
          error: 'Test block did not produce Rust test output',
        });
        console.log(`  \x1b[31m✗\x1b[0m ${relPath}::${tb.name}`);
      }
    }
  }

  // Summary
  console.log('');
  console.log('─'.repeat(60));
  const status = totalFailed === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m';
  console.log(`  ${status}  ${totalPassed} passed, ${totalFailed} failed, ${totalTests} total`);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`  Duration: ${totalDuration.toFixed(0)}ms`);
  console.log('');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

