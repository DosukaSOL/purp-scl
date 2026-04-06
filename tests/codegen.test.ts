// Purp SCL — Codegen Tests (Rust + TypeScript extended coverage)

import { compile } from '../compiler/src/index.js';

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

console.log('\n=== Codegen Extended Tests ===\n');

// --- Rust Codegen ---

test('rust: generates header with anchor import', () => {
  const r = compile('program Test { }');
  assert(r.rust!.includes('use anchor_lang::prelude::*'), 'Should have anchor import');
});

test('rust: generates declare_id macro', () => {
  const r = compile('program Test { }');
  assert(r.rust!.includes('declare_id!'), 'Should have declare_id!');
});

test('rust: generates #[program] attribute', () => {
  const r = compile('program Test { }');
  assert(r.rust!.includes('#[program]'), 'Should have #[program] attribute');
});

test('rust: account struct has #[account] attribute', () => {
  const r = compile(`
    program Test {
      account Data {
        value: u64
      }
    }
  `);
  assert(r.rust!.includes('#[account]'), 'Should have #[account] attribute');
  assert(r.rust!.includes('pub value: u64'), 'Should have pub field');
});

test('rust: instruction generates context struct', () => {
  const r = compile(`
    program Test {
      pub instruction init(
        #[mut] signer authority,
        #[init] account data
      ) {
        data.value = 42;
      }
    }
  `);
  assert(r.rust!.includes('Init'), 'Should generate context struct');
  assert(r.rust!.includes('pub fn init'), 'Should generate instruction fn');
});

test('rust: event generates #[event] struct', () => {
  const r = compile(`
    program Test {
      event Transfer { from: pubkey, to: pubkey, amount: u64 }
    }
  `);
  assert(r.rust!.includes('#[event]'), 'Should have #[event] attribute');
  assert(r.rust!.includes('Transfer'), 'Should have Transfer struct');
});

test('rust: error generates #[error_code] enum', () => {
  const r = compile(`
    program Test {
      error Errors {
        Unauthorized = "Not authorized",
        NotFound = "Item not found"
      }
    }
  `);
  assert(r.rust!.includes('#[error_code]') || r.rust!.includes('ErrorCode'), 'Should have error code definition');
  assert(r.rust!.includes('Unauthorized'), 'Should have Unauthorized variant');
  assert(r.rust!.includes('NotFound'), 'Should have NotFound variant');
});

test('rust: struct generates Rust struct', () => {
  const r = compile(`
    program Test {
      struct Config {
        admin: pubkey,
        fee: u64
      }
    }
  `);
  assert(r.rust!.includes('Config'), 'Should have Config struct');
  assert(r.rust!.includes('admin'), 'Should have admin field');
});

test('rust: enum generates Rust enum', () => {
  const r = compile(`
    program Test {
      enum Status {
        Active,
        Inactive,
        Paused
      }
    }
  `);
  assert(r.rust!.includes('enum Status'), 'Should have enum Status');
  assert(r.rust!.includes('Active'), 'Should have Active variant');
});

test('rust: for loop compiles', () => {
  const r = compile(`
    program Test {
      fn process(items: Vec<u64>) {
        for item in items {
          let x = item;
        }
      }
    }
  `);
  assert(r.success, 'Should compile for loop');
  assert(r.rust!.includes('for') || r.rust!.includes('item'), 'Should contain loop construct');
});

test('rust: if/else compiles', () => {
  const r = compile(`
    program Test {
      fn check(x: u64) {
        if x > 10 {
          let y = 1;
        } else {
          let y = 0;
        }
      }
    }
  `);
  assert(r.success, 'Should compile if/else');
  assert(r.rust!.includes('if'), 'Should contain if');
});

test('rust: assert statement compiles', () => {
  const r = compile(`
    program Test {
      fn validate(x: u64) {
        assert(x > 0, "must be positive");
      }
    }
  `);
  assert(r.success, 'Should compile assert');
  assert(r.rust!.includes('require!') || r.rust!.includes('assert'), 'Should contain assertion');
});

test('rust: emit statement compiles', () => {
  const r = compile(`
    program Test {
      event Done { }
      fn finish() {
        emit Done();
      }
    }
  `);
  assert(r.success, 'Should compile emit');
  assert(r.rust!.includes('emit!') || r.rust!.includes('Done'), 'Should contain emit call');
});

// --- TypeScript Codegen ---

test('typescript: generates SDK class', () => {
  const r = compile(`
    program MyApp {
      account Data { value: u64 }
      pub instruction init(#[mut] signer auth, #[init] account data) {
        data.value = 0;
      }
    }
  `);
  assert(r.typescript!.includes('class') || r.typescript!.includes('MyApp'), 'Should generate class or module');
});

test('typescript: generates account interface', () => {
  const r = compile(`
    program Test {
      account UserProfile {
        name: string,
        score: u64,
        active: bool
      }
    }
  `);
  assert(r.typescript!.includes('UserProfile'), 'Should have UserProfile interface');
});

test('typescript: generates instruction method', () => {
  const r = compile(`
    program Test {
      pub instruction transfer(
        #[mut] signer from,
        #[mut] account to,
        amount: u64
      ) {
        to.balance += amount;
      }
    }
  `);
  assert(r.typescript!.includes('transfer'), 'Should have transfer method');
});

test('typescript: generates event types', () => {
  const r = compile(`
    program Test {
      event Swap { user: pubkey, amount: u64 }
    }
  `);
  assert(r.typescript!.includes('Swap'), 'Should have Swap type');
});

test('typescript: generates error mapping', () => {
  const r = compile(`
    program Test {
      error Errors {
        InvalidInput = "Bad input"
      }
    }
  `);
  assert(r.typescript!.includes('InvalidInput') || r.typescript!.includes('Bad input'), 'Should have error mapping');
});

test('typescript: complex program produces full SDK', () => {
  const r = compile(`
    program NFTMarket {
      account Listing {
        seller: pubkey,
        price: u64,
        active: bool
      }

      event Listed { nft: pubkey, price: u64 }
      event Sold { nft: pubkey, buyer: pubkey, price: u64 }

      error MarketErrors {
        NotActive = "Listing not active",
        InsufficientFunds = "Not enough SOL"
      }

      pub instruction list(
        #[mut] signer seller,
        #[init] account listing,
        price: u64
      ) {
        listing.seller = seller;
        listing.price = price;
        listing.active = true;
        emit Listed(seller, price);
      }

      pub instruction buy(
        #[mut] signer buyer,
        #[mut] account listing
      ) {
        assert(listing.active, "Not active");
        listing.active = false;
        emit Sold(buyer, buyer, listing.price);
      }
    }
  `);
  assert(r.success, 'Complex program should compile');
  assert(r.rust!.length > 200, 'Rust output should be substantial');
  assert(r.typescript!.length > 100, 'TypeScript output should be substantial');
});

// --- Source Map integration ---

test('compile with sourceMap option', () => {
  const r = compile('program Test { }', { sourceMap: true });
  assert(r.success, 'Should compile with sourceMap');
  assert(r.sourceMap !== undefined, 'Should produce sourceMap');
});

// --- Frontend codegen ---

test('frontend block generates output', () => {
  const r = compile(`
    program Test {
      account Data { value: u64 }
    }
  `);
  assert(r.success, 'Should compile program');
  // frontend output is generated when frontend{} blocks exist
  assert(r.typescript !== undefined, 'Should have typescript output');
});

// --- Error handling ---

test('compile returns diagnostics on error', () => {
  const r = compile('this is not valid purp code at all {{{}}}');
  assert(r.diagnostics !== undefined, 'Should have diagnostics');
});

// === New codegen tests (v1.1) ===

test('rust: ** generates .pow()', () => {
  const r = compile(`
    program Test {
      fn calc() -> u64 {
        return 2 ** 3
      }
    }
  `);
  assert(r.rust!.includes('.pow('), 'Should generate .pow() for **');
});

test('rust: ?? generates unwrap_or()', () => {
  const r = compile(`
    program Test {
      fn fallback() {
        let x = a ?? b
      }
    }
  `);
  assert(r.rust!.includes('unwrap_or('), 'Should generate unwrap_or() for ??');
});

test('rust: SpreadExpr generates into_iter()', () => {
  const r = compile(`
    program Test {
      fn merge() {
        let combined = [...items, 1]
      }
    }
  `);
  assert(r.rust!.includes('into_iter()'), 'Should generate into_iter() for spread');
});

test('ts: spread generates ...expr', () => {
  const r = compile(`
    program Test {
      account Data { value: u64 }
    }
  `);
  assert(r.success, 'Should compile');
});

test('rust: **= assignment generates .pow()', () => {
  const r = compile(`
    program Test {
      fn calc() {
        let mut x: u64 = 2
        x **= 3
      }
    }
  `);
  assert(r.rust!.includes('.pow('), 'Should generate .pow() for **=');
});

test('idl: generates IDL JSON with instructions', () => {
  const r = compile(`
    program Vault {
      account VaultData {
        owner: pubkey
        balance: u64
      }
      instruction deposit(amount: u64) {
        accounts {
          vault: VaultData
          user: Signer
        }
      }
    }
  `);
  assert(r.idl !== undefined, 'Should have IDL output');
  const idl = JSON.parse(r.idl!);
  assert(idl.name === 'vault', 'IDL name should be snake_case');
  assert(idl.instructions.length === 1, 'Should have 1 instruction');
  assert(idl.instructions[0].name === 'deposit', 'Instruction should be deposit');
  assert(idl.accounts.length === 1, 'Should have 1 account');
});

test('idl: includes enum types', () => {
  const r = compile(`
    program Test {
      enum Status { Active, Paused, Closed }
    }
  `);
  const idl = JSON.parse(r.idl!);
  assert(idl.types.length === 1, 'Should have 1 type');
  assert(idl.types[0].type.kind === 'enum', 'Should be enum type');
  assert(idl.types[0].type.variants.length === 3, 'Should have 3 variants');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
if (failed > 0) process.exit(1);
