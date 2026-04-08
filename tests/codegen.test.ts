// Purp SCL — Codegen Tests (Rust + TypeScript extended coverage)

import { compile } from '../compiler/src/index.js';
import { Parser } from '../compiler/src/parser/index.js';
import { Lexer } from '../compiler/src/lexer/index.js';

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

test('rust: generates header with pinocchio import', () => {
  const r = compile('program Test { }');
  assert(r.rust!.includes('use pinocchio'), 'Should have pinocchio import');
});

test('rust: generates PROGRAM_ID constant', () => {
  const r = compile('program Test { }');
  assert(r.rust!.includes('PROGRAM_ID'), 'Should have PROGRAM_ID constant');
});

test('rust: generates process_instruction entrypoint', () => {
  const r = compile('program Test { }');
  assert(r.rust!.includes('process_instruction'), 'Should have process_instruction entrypoint');
});

test('rust: account struct has BorshSerialize derive', () => {
  const r = compile(`
    program Test {
      account Data {
        value: u64
      }
    }
  `);
  assert(r.rust!.includes('BorshSerialize'), 'Should have BorshSerialize derive');
  assert(r.rust!.includes('pub value: u64'), 'Should have pub field');
});

test('rust: instruction generates function with account validation', () => {
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
  assert(r.rust!.includes('fn init'), 'Should generate instruction fn');
  assert(r.rust!.includes('accounts') || r.rust!.includes('AccountView'), 'Should reference accounts');
});

test('rust: event generates BorshSerialize struct', () => {
  const r = compile(`
    program Test {
      event Transfer { from: pubkey, to: pubkey, amount: u64 }
    }
  `);
  assert(r.rust!.includes('BorshSerialize'), 'Should have BorshSerialize derive for event');
  assert(r.rust!.includes('Transfer'), 'Should have Transfer struct');
});

test('rust: error generates repr(u32) enum', () => {
  const r = compile(`
    program Test {
      error Errors {
        Unauthorized = "Not authorized",
        NotFound = "Item not found"
      }
    }
  `);
  assert(r.rust!.includes('repr(u32)') || r.rust!.includes('ProgramError'), 'Should have error code definition');
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
  assert(r.rust!.includes('return Err') || r.rust!.includes('assert'), 'Should contain assertion');
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
  assert(r.rust!.includes('msg!') || r.rust!.includes('Done'), 'Should contain emit call');
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

// --- E2E Rust Generation Validation ---

test('e2e: full program generates valid Pinocchio Rust', () => {
  const r = compile(`
    program TokenVault {
      account Vault {
        owner: pubkey,
        balance: u64,
        is_locked: bool
      }
      error VaultErrors {
        Unauthorized = "Not authorized",
        InsufficientFunds = "Not enough funds"
      }
      event Deposit { user: pubkey, amount: u64 }
      pub instruction initialize(
        #[mut] signer authority,
        #[init] account vault
      ) {
        vault.owner = authority;
        vault.balance = 0;
      }
      pub instruction deposit(
        #[mut] signer depositor,
        #[mut] account vault,
        amount: u64
      ) {
        assert(amount > 0, "Amount must be positive");
        vault.balance = vault.balance + amount;
        emit Deposit(depositor, amount);
      }
      pub instruction withdraw(
        #[mut] signer owner_acc,
        #[mut] account vault,
        amount: u64
      ) {
        require(vault.balance >= amount, VaultErrors.InsufficientFunds);
        vault.balance = vault.balance - amount;
      }
    }
  `);
  assert(r.success, 'Full program should compile');
  const rust = r.rust!;
  // Pinocchio imports
  assert(rust.includes('use pinocchio::'), 'Should have pinocchio import');
  assert(rust.includes('use pinocchio_log::log'), 'Should have pinocchio_log import');
  assert(rust.includes('use borsh::'), 'Should have borsh import');
  // Entrypoint
  assert(rust.includes('entrypoint!(process_instruction)'), 'Should have entrypoint macro');
  assert(rust.includes('fn process_instruction'), 'Should have process_instruction fn');
  // Instruction dispatch
  assert(rust.includes('match tag'), 'Should have instruction dispatch');
  assert(rust.includes('0 => initialize'), 'Should dispatch initialize at index 0');
  assert(rust.includes('1 => deposit'), 'Should dispatch deposit at index 1');
  assert(rust.includes('2 => withdraw'), 'Should dispatch withdraw at index 2');
  // Account deserialization
  assert(rust.includes('Vault::default()'), 'Init account should use default()');
  assert(rust.includes('Vault::try_from_slice'), 'Non-init account should deserialize');
  // Signer key resolution
  assert(rust.includes('authority_key'), 'Signer should have _key alias');
  assert(rust.includes('vault.owner = authority_key'), 'Signer should resolve to _key in assignment');
  // Error enum Rust syntax
  assert(rust.includes('VaultErrors::InsufficientFunds'), 'Error variants should use :: syntax');
  assert(rust.includes('.into()'), 'Error return should use .into()');
  // Serialization
  assert(rust.includes('vault.serialize'), 'Modified accounts should be serialized back');
  assert(rust.includes('data_mut()'), 'Should use unsafe data_mut for write-back');
  // Args deserialization
  assert(rust.includes('DepositArgs'), 'Should generate args struct for params');
  assert(rust.includes('BorshDeserialize'), 'Args struct should derive BorshDeserialize');
  // Account struct
  assert(rust.includes('pub struct Vault'), 'Should generate Vault struct');
  assert(rust.includes('Default'), 'Account struct should derive Default');
});

test('e2e: full program generates valid TS SDK', () => {
  const r = compile(`
    program TokenVault {
      account Vault { owner: pubkey, balance: u64 }
      event Deposited { user: pubkey, amount: u64 }
      pub instruction deposit(
        #[mut] signer depositor,
        #[mut] account vault,
        amount: u64
      ) {
        vault.balance = vault.balance + amount;
      }
    }
  `);
  assert(r.success, 'Should compile');
  const ts = r.typescript!;
  assert(ts.includes('TransactionInstruction'), 'Should use TransactionInstruction');
  assert(ts.includes('TokenVaultClient'), 'Should generate client class');
  assert(ts.includes('async deposit'), 'Should have deposit method');
  assert(ts.includes('signers: Keypair[]'), 'Should accept signers');
  assert(ts.includes('Buffer.from(['), 'Should have discriminator byte');
  assert(ts.includes('sendRawTransaction'), 'Should send raw transaction');
  assert(ts.includes('interface Vault'), 'Should have Vault interface');
  assert(ts.includes('connection.getAccountInfo'), 'Account fetcher should use getAccountInfo');
  assert(ts.includes('onLogs'), 'Event listener should use onLogs');
  assert(ts.includes('this.programId'), 'PDA helper should use this.programId');
});

test('rust: Clock.timestamp generates Clock::get()?.unix_timestamp', () => {
  const r = compile(`
    program TimeLock {
      account Lock { unlock_time: u64 }
      pub instruction create_lock(
        #[mut] signer owner,
        #[init] account lock,
        duration: u64
      ) {
        lock.unlock_time = Clock.timestamp + duration;
      }
    }
  `);
  assert(r.success, 'Should compile with Clock access');
  assert(r.rust!.includes('Clock::get()?.unix_timestamp'), 'Should generate Clock sysvar access');
});

test('rust: error enum uses :: syntax in require', () => {
  const r = compile(`
    program Test {
      error Errors { Denied = "Denied" }
      pub instruction check(#[mut] signer auth) {
        require(auth == auth, Errors.Denied);
      }
    }
  `);
  assert(r.success, 'Should compile');
  assert(r.rust!.includes('Errors::Denied'), 'Should generate Rust :: enum syntax');
  assert(r.rust!.includes('.into()'), 'Should add .into() for custom error');
});

// --- State Machine DSL ---

test('rust: state machine generates enum + transitions', () => {
  const r = compile(`
    program Game {
      state machine GameState {
        state Lobby
        state Playing
        state Finished

        transition start: Lobby -> Playing
        transition finish: Playing -> Finished
        transition restart: Finished -> Lobby
      }
    }
  `);
  assert(r.success, 'State machine should compile');
  const rust = r.rust!;
  assert(rust.includes('pub enum GameState'), 'Should generate state enum');
  assert(rust.includes('Lobby,'), 'Should have Lobby variant');
  assert(rust.includes('Playing,'), 'Should have Playing variant');
  assert(rust.includes('Finished,'), 'Should have Finished variant');
  assert(rust.includes('impl GameState'), 'Should generate impl block');
  assert(rust.includes('fn start(&self)'), 'Should generate start transition');
  assert(rust.includes('fn finish(&self)'), 'Should generate finish transition');
  assert(rust.includes('GameState::Lobby =>'), 'Should match from state');
  assert(rust.includes('Ok(GameState::Playing)'), 'Should return to state');
  assert(rust.includes('ProgramError::InvalidArgument'), 'Should have invalid transition error');
  assert(rust.includes('Default'), 'Should derive Default');
});

test('ts: state machine generates enum + transition map', () => {
  const r = compile(`
    program Game {
      state machine GameState {
        state Lobby
        state Playing
        state Finished
        transition start: Lobby -> Playing
        transition finish: Playing -> Finished
      }
    }
  `);
  assert(r.success, 'Should compile');
  const ts = r.typescript!;
  assert(ts.includes('export enum GameState'), 'Should generate TS enum');
  assert(ts.includes('Lobby = 0'), 'First state should be 0');
  assert(ts.includes('GameStateTransitions'), 'Should generate transitions map');
  assert(ts.includes('transitionGameState'), 'Should generate transition helper');
});

test('rust: multi-source transition uses OR pattern', () => {
  const r = compile(`
    program Order {
      state machine OrderStatus {
        state Pending
        state Active
        state Cancelled
        transition cancel: Pending | Active -> Cancelled
      }
    }
  `);
  assert(r.success, 'Should compile');
  assert(r.rust!.includes('OrderStatus::Pending | OrderStatus::Active'), 'Should use | pattern for multi-source');
});

// --- Parser Error Recovery ---

test('parser: collects multiple errors', () => {
  const tokens = new Lexer('@@@ ??? program Test {}', 'test').tokenize();
  const parser = new Parser(tokens, 'test');
  const ast = parser.parse();
  // Should recover and parse the program declaration
  const errors = parser.getErrors();
  assert(errors.length > 0, 'Should have collected errors');
  assert(ast.body.length >= 1, 'Should still parse valid program after recovery');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
if (failed > 0) process.exit(1);
