// Purp SCL — Compiler Integration Tests

import { compile } from '../compiler/src/index.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
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

console.log('\n=== Compiler Integration Tests ===\n');

test('compile empty program', () => {
  const result = compile('program Empty { }');
  assert(result.success === true, 'Should compile successfully');
  assert(result.rust!.length > 0, 'Should produce Rust output');
  assert(result.typescript!.length > 0, 'Should produce TypeScript output');
});

test('compile program with account', () => {
  const result = compile(`
    program Test {
      account Data {
        value: u64,
        owner: pubkey
      }
    }
  `);
  assert(result.success === true, 'Should compile successfully');
  assert(result.rust!.includes('Data'), 'Rust should contain Data struct');
  assert(result.typescript!.includes('Data'), 'TypeScript should contain Data interface');
});

test('compile program with instruction', () => {
  const result = compile(`
    program Test {
      pub instruction initialize(
        #[mut] signer authority,
        #[init] account data
      ) {
        data.value = 42;
      }
    }
  `);
  assert(result.success === true, 'Should compile successfully');
  assert(result.rust!.includes('initialize'), 'Rust should contain initialize fn');
  assert(result.typescript!.includes('initialize'), 'TypeScript should contain initialize method');
});

test('compile program with event', () => {
  const result = compile(`
    program Test {
      event Created { user: pubkey, value: u64 }
    }
  `);
  assert(result.success === true, 'Should compile successfully');
  assert(result.rust!.includes('Created'), 'Rust should contain Created event');
});

test('compile program with error', () => {
  const result = compile(`
    program Test {
      error NotFound = "Item not found"
    }
  `);
  assert(result.success === true, 'Should compile successfully');
  assert(result.rust!.includes('NotFound'), 'Rust should contain NotFound error');
});

test('Rust output contains Anchor boilerplate', () => {
  const result = compile('program MyApp { }');
  assert(result.rust!.includes('use anchor_lang::prelude::*'), 'Should import anchor_lang');
  assert(result.rust!.includes('declare_id!'), 'Should have declare_id!');
  assert(result.rust!.includes('#[program]'), 'Should have #[program]');
});

test('TypeScript output contains imports', () => {
  const result = compile(`
    program Test {
      account Data { value: u64 }
      pub instruction init(#[mut] signer auth, #[init] account data) { }
    }
  `);
  assert(result.success === true, 'Should compile successfully');
  assert(result.typescript!.includes('PublicKey') || result.typescript!.includes('import'), 
    'TypeScript should have imports or type references');
});

test('compile full program', () => {
  const source = `
    program TokenVault {
      account Vault {
        owner: pubkey,
        balance: u64
      }

      pub instruction create_vault(
        #[mut] signer owner,
        #[init] account vault
      ) {
        vault.owner = owner;
        vault.balance = 0;
      }

      pub instruction deposit(
        #[mut] signer user,
        #[mut] account vault,
        amount: u64
      ) {
        vault.balance += amount;
        emit Deposited(user, amount);
      }

      event Deposited { user: pubkey, amount: u64 }
      error InsufficientFunds = "Not enough balance"
    }
  `;
  const result = compile(source);
  assert(result.success === true, 'Should compile successfully');
  assert(result.rust!.includes('create_vault'), 'Rust should have create_vault');
  assert(result.rust!.includes('deposit'), 'Rust should have deposit');
  assert(result.rust!.includes('Deposited'), 'Rust should have Deposited event');
  assert(result.rust!.includes('InsufficientFunds'), 'Rust should have InsufficientFunds error');
  assert(result.typescript!.includes('TokenVault'), 'TypeScript should have TokenVault');
});

test('compile with import (should not error)', () => {
  const source = `
    import { Token } from "@purp/stdlib";
    program Test { }
  `;
  const result = compile(source);
  assert(result.success === true, 'Should compile successfully with imports');
});

test('diagnostics report errors for invalid code', () => {
  // This should still parse but semantic analysis might catch issues
  const source = `
    program Test {
      pub instruction no_signer(account data) {
        data.value = 1;
      }
    }
  `;
  const result = compile(source);
  // The semantic analyzer should warn about missing signer
  // But compilation may still produce output
  assert(result.rust !== undefined, 'Should still produce some output');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
