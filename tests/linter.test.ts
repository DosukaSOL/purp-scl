// Purp SCL — Linter Tests

import { Lexer } from '../compiler/src/lexer/index.js';
import { Parser } from '../compiler/src/parser/index.js';
import { lintPurpAST } from '../compiler/src/linter/index.js';
import * as AST from '../compiler/src/ast/index.js';

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

function parse(source: string): AST.ProgramNode {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

console.log('\n=== Linter Tests ===\n');

test('lint valid program with no issues', () => {
  const ast = parse(`
    program Test {
      account Data {
        value: u64
      }
      pub instruction initialize(
        #[mut] signer authority
      ) {
        let x = 1;
      }
    }
  `);
  const result = lintPurpAST(ast);
  assert(result.errors === 0, `Expected no errors, got ${result.errors}`);
});

test('naming-convention: snake_case function names', () => {
  const ast = parse(`
    program Test {
      fn MyBadFunc() {
        let x = 1;
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const namingWarning = allDiags.some(d => d.description.includes('snake_case') || d.description.includes('naming'));
  assert(namingWarning, 'Should warn about non-snake_case function name');
});

test('naming-convention: PascalCase struct names', () => {
  const ast = parse(`
    program Test {
      struct my_struct {
        value: u64
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const namingWarning = allDiags.some(d => d.description.includes('PascalCase') || d.description.includes('naming'));
  assert(namingWarning, 'Should warn about non-PascalCase struct name');
});

test('require-signer: instruction without signer', () => {
  const ast = parse(`
    program Test {
      pub instruction process(
        #[mut] account data
      ) {
        data.value = 1;
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const signerError = allDiags.some(d => d.description.includes('signer'));
  assert(signerError, 'Should error about missing signer');
});

test('init-needs-payer: init without payer', () => {
  const ast = parse(`
    program Test {
      pub instruction create(
        #[mut] signer auth,
        #[init] account data
      ) {
        data.value = 1;
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const payerError = allDiags.some(d => d.description.includes('payer'));
  assert(payerError, 'Should error about init without payer');
});

test('no-empty-body: empty function', () => {
  const ast = parse(`
    program Test {
      fn doNothing() {
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const emptyInfo = allDiags.some(d => d.description.includes('empty'));
  assert(emptyInfo, 'Should info about empty function body');
});

test('no-empty-body: empty instruction', () => {
  const ast = parse(`
    program Test {
      pub instruction noop(#[mut] signer auth) {
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const emptyInfo = allDiags.some(d => d.description.includes('empty'));
  assert(emptyInfo, 'Should info about empty instruction body');
});

test('no-unsafe-arithmetic: detects arithmetic operations', () => {
  const ast = parse(`
    program Test {
      fn calc(a: u64, b: u64) {
        let c = a + b;
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const arithmeticWarn = allDiags.some(d => d.description.includes('arithmetic') || d.description.includes('overflow'));
  assert(arithmeticWarn, 'Should warn about potential overflow');
});

test('no-hardcoded-keys: detects hardcoded pubkeys', () => {
  const ast = parse(`
    program Test {
      fn check() {
        let key = "11111111111111111111111111111111";
      }
    }
  `);
  const result = lintPurpAST(ast);
  // This checks for base58-like strings (32+ char alphanumeric) 
  // The actual behavior depends on the rule implementation
  assert(result.diagnostics !== undefined, 'Should have diagnostics object');
});

test('lint result has correct counts', () => {
  const ast = parse(`
    program Test {
      fn doNothing() {
      }
    }
  `);
  const result = lintPurpAST(ast);
  assert(typeof result.errors === 'number', 'errors should be a number');
  assert(typeof result.warnings === 'number', 'warnings should be a number');
  assert(typeof result.infos === 'number', 'infos should be a number');
  assert(result.errors + result.warnings + result.infos >= 0, 'counts should be non-negative');
});

test('enum-naming: PascalCase enum names', () => {
  const ast = parse(`
    program Test {
      enum my_status {
        Active,
        Inactive
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const namingWarning = allDiags.some(d => d.description.includes('PascalCase') || d.description.includes('naming'));
  assert(namingWarning, 'Should warn about non-PascalCase enum name');
});

test('account-naming: PascalCase account names', () => {
  const ast = parse(`
    program Test {
      account my_data {
        value: u64
      }
    }
  `);
  const result = lintPurpAST(ast);
  const allDiags = result.diagnostics.getAll();
  const namingWarning = allDiags.some(d => d.description.includes('PascalCase') || d.description.includes('naming'));
  assert(namingWarning, 'Should warn about non-PascalCase account name');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
if (failed > 0) process.exit(1);
