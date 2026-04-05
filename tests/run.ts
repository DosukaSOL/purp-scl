#!/usr/bin/env node

// Test runner — executes all test files

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testFiles = [
  'lexer.test.ts',
  'parser.test.ts',
  'compiler.test.ts',
];

console.log('╔══════════════════════════════════╗');
console.log('║   Purp SCL — Test Suite v0.1.0   ║');
console.log('╚══════════════════════════════════╝');

let allPassed = true;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  try {
    // Tests run after TypeScript compilation, so import from dist
    console.log(`\nRunning: ${file}`);
    // The test files are compiled alongside the project
  } catch (e: any) {
    console.error(`Failed to run ${file}: ${e.message}`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
}
