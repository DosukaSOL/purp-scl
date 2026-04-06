// Purp SCL — Semantic Analyzer Tests

import { Lexer } from '../compiler/src/lexer/index.js';
import { Parser } from '../compiler/src/parser/index.js';
import { SemanticAnalyzer } from '../compiler/src/semantic/index.js';
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

function analyze(source: string) {
  const ast = parse(source);
  const analyzer = new SemanticAnalyzer();
  return analyzer.analyze(ast);
}

console.log('\n=== Semantic Analyzer Tests ===\n');

test('analyze empty program', () => {
  const diag = analyze('program Test { }');
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze program with account', () => {
  const diag = analyze(`
    program Test {
      account Data {
        value: u64,
        owner: pubkey
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze program with instruction', () => {
  const diag = analyze(`
    program Test {
      pub instruction init(
        #[mut] signer auth,
        #[init] account data
      ) {
        data.value = 42;
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze struct declaration', () => {
  const diag = analyze(`
    program Test {
      struct Config {
        admin: pubkey,
        fee: u64
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze enum declaration', () => {
  const diag = analyze(`
    program Test {
      enum Status {
        Active,
        Paused,
        Closed
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze event and emit', () => {
  const diag = analyze(`
    program Test {
      event Created { user: pubkey, amount: u64 }
      pub instruction create(#[mut] signer auth) {
        emit Created(auth, 100);
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze error declaration', () => {
  const diag = analyze(`
    program Test {
      error AppErrors {
        NotFound = "Not found"
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze function with parameters', () => {
  const diag = analyze(`
    program Test {
      fn calculate(a: u64, b: u64) {
        let result = a + b;
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze const declaration', () => {
  const diag = analyze(`
    program Test {
      const MAX: u64 = 1000;
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze control flow (if/else)', () => {
  const diag = analyze(`
    program Test {
      fn check(x: u64) {
        if x > 0 {
          let y = x;
        } else {
          let y = 0;
        }
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze for loop', () => {
  const diag = analyze(`
    program Test {
      fn process(items: Vec<u64>) {
        for item in items {
          let x = item;
        }
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze import statement', () => {
  const diag = analyze(`
    import { Token } from "@purp/stdlib";
    program Test { }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze complex program', () => {
  const diag = analyze(`
    program DeFi {
      account Pool {
        authority: pubkey,
        tokenA_balance: u64,
        tokenB_balance: u64,
        fee_rate: u64
      }

      struct SwapParams {
        amount_in: u64,
        min_out: u64
      }

      enum PoolStatus { Active, Paused }

      event Swapped { user: pubkey, amount_in: u64, amount_out: u64 }
      error PoolErrors { 
        Paused = "Pool is paused",
        SlippageExceeded = "Slippage too high"
      }

      const FEE_BASIS: u64 = 10000;

      fn calculate_fee(amount: u64, rate: u64) {
        let fee = amount * rate;
      }

      pub instruction swap(
        #[mut] signer user,
        #[mut] account pool,
        amount: u64
      ) {
        let fee = amount * pool.fee_rate;
        pool.tokenA_balance += amount;
        emit Swapped(user, amount, amount);
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('analyze returns diagnostics object', () => {
  const diag = analyze('program Test { }');
  assert(diag.getAll !== undefined, 'Should have getAll method');
  assert(diag.hasErrors !== undefined, 'Should have hasErrors method');
  assert(diag.getErrors !== undefined, 'Should have getErrors method');
  assert(diag.getWarnings !== undefined, 'Should have getWarnings method');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
if (failed > 0) process.exit(1);
