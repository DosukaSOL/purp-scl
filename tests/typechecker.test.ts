// Purp SCL — TypeChecker Tests

import { Lexer } from '../compiler/src/lexer/index.js';
import { Parser } from '../compiler/src/parser/index.js';
import { TypeChecker } from '../compiler/src/typechecker/index.js';
import { PurpDiagnostics } from '../compiler/src/errors/index.js';
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

function typecheck(source: string): PurpDiagnostics {
  const ast = parse(source);
  const diag = new PurpDiagnostics();
  const tc = new TypeChecker(diag);
  tc.check(ast);
  return diag;
}

console.log('\n=== TypeChecker Tests ===\n');

test('valid program with account and instruction', () => {
  const diag = typecheck(`
    program Test {
      account Data {
        value: u64,
        owner: pubkey
      }
      pub instruction init(#[mut] signer auth, #[init] account data) {
        data.value = 42;
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid struct declaration', () => {
  const diag = typecheck(`
    program Test {
      struct Config {
        admin: pubkey,
        fee: u64,
        active: bool
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid enum declaration', () => {
  const diag = typecheck(`
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

test('valid event declaration', () => {
  const diag = typecheck(`
    program Test {
      event Deposit {
        user: pubkey,
        amount: u64
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid error declaration', () => {
  const diag = typecheck(`
    program Test {
      error AppErrors {
        NotFound = "Not found",
        Unauthorized = "Not authorized"
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid function declaration', () => {
  const diag = typecheck(`
    program Test {
      fn calculate(a: u64, b: u64) {
        let result = a + b;
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid const declaration', () => {
  const diag = typecheck(`
    program Test {
      const MAX_SIZE: u64 = 1000;
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid if/else statement', () => {
  const diag = typecheck(`
    program Test {
      fn check(x: u64) {
        if x > 10 {
          let y = x;
        } else {
          let y = 0;
        }
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid for loop', () => {
  const diag = typecheck(`
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

test('valid emit statement', () => {
  const diag = typecheck(`
    program Test {
      event Created { user: pubkey }
      pub instruction create(#[mut] signer auth) {
        emit Created(auth);
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid assert statement', () => {
  const diag = typecheck(`
    program Test {
      fn validate(x: u64) {
        assert(x > 0, "must be positive");
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('valid import declaration', () => {
  const diag = typecheck(`
    import { Token } from "@purp/stdlib";
    program Test { }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('complex program with multiple features', () => {
  const diag = typecheck(`
    program Vault {
      account VaultData {
        owner: pubkey,
        balance: u64,
        active: bool
      }
      
      struct Config {
        maxDeposit: u64
      }

      enum Status { Open, Closed }

      event Deposited { user: pubkey, amount: u64 }
      error VaultErrors { Inactive = "Vault is inactive" }

      const MAX_DEPOSIT: u64 = 1000000;

      fn validate_amount(amount: u64) {
        assert(amount > 0, "Amount must be positive");
        assert(amount <= 1000000, "Amount too large");
      }

      pub instruction deposit(
        #[mut] signer user,
        #[mut] account vault,
        amount: u64
      ) {
        vault.balance += amount;
        emit Deposited(user, amount);
      }
    }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('empty program is valid', () => {
  const diag = typecheck('program Empty { }');
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

test('multiple programs are valid', () => {
  const diag = typecheck(`
    program A { }
    program B { }
  `);
  assert(!diag.hasErrors(), `Should have no errors, got: ${diag.format()}`);
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
if (failed > 0) process.exit(1);
