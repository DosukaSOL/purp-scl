// Purp SCL — Formatter Tests

import { formatPurpFile, PurpFormatter } from '../compiler/src/formatter/index.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

console.log('\n=== Formatter Tests ===\n');

test('format empty string', () => {
  const result = formatPurpFile('');
  assert(result.endsWith('\n'), 'Should end with newline');
});

test('ensure trailing newline', () => {
  const result = formatPurpFile('program Test { }');
  assert(result.endsWith('\n'), 'Should end with newline');
});

test('normalize operator spacing', () => {
  const result = formatPurpFile('let x=42;');
  assert(result.includes(' = '), 'Should have spaces around =');
});

test('normalize comma spacing', () => {
  const result = formatPurpFile('fn test(a,b,c) { }');
  assert(result.includes(', '), 'Should have space after comma');
});

test('normalize colon spacing', () => {
  const result = formatPurpFile('value:u64');
  assert(result.includes(': '), 'Should have space after colon');
});

test('indentation increases after opening brace', () => {
  const result = formatPurpFile('program Test {\nvalue: u64\n}');
  const lines = result.split('\n');
  const bodyLine = lines.find(l => l.includes('value'));
  assert(bodyLine !== undefined && bodyLine.startsWith('  '), 'Body should be indented');
});

test('indentation decreases on closing brace', () => {
  const result = formatPurpFile('program Test {\nvalue: u64\n}');
  const lines = result.split('\n');
  const closingLine = lines.find(l => l.trim() === '}');
  assert(closingLine !== undefined && !closingLine.startsWith('  '), 'Closing brace should be at base indent');
});

test('collapsed blank lines', () => {
  const result = formatPurpFile('a\n\n\n\n\nb');
  const emptyCount = result.split('\n').filter(l => l.trim() === '').length;
  assert(emptyCount <= 2, 'Should collapse 3+ blank lines to 2');
});

test('arrow spacing', () => {
  const result = formatPurpFile('fn test()->u64 { }');
  assert(result.includes(' -> '), 'Should have spaces around ->');
});

test('fat arrow spacing', () => {
  const result = formatPurpFile('let f=>42');
  assert(result.includes(' => '), 'Should have spaces around =>');
});

test('custom indent size', () => {
  const formatter = new PurpFormatter({ indentSize: 4 });
  const result = formatter.format('program Test {\nvalue: u64\n}');
  const lines = result.split('\n');
  const bodyLine = lines.find(l => l.includes('value'));
  assert(bodyLine !== undefined && bodyLine.startsWith('    '), 'Should use 4-space indent');
});

test('preserve comments', () => {
  const result = formatPurpFile('// this is a comment\nprogram Test { }');
  assert(result.includes('// this is a comment'), 'Should preserve single-line comments');
});

test('preserve multi-line comments', () => {
  const result = formatPurpFile('/* multi\nline\ncomment */\nprogram Test { }');
  assert(result.includes('multi'), 'Should preserve multi-line comments');
});

test('nested brace indentation', () => {
  const result = formatPurpFile('program Test {\naccount Data {\nvalue: u64\n}\n}');
  const lines = result.split('\n');
  const valueLine = lines.find(l => l.includes('value'));
  assert(valueLine !== undefined && valueLine.startsWith('    '), 'Nested body should have double indent');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
if (failed > 0) process.exit(1);
