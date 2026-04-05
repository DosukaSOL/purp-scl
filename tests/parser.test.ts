// Purp SCL — Parser Tests

import { Lexer } from '../compiler/src/lexer/index.js';
import { Parser } from '../compiler/src/parser/index.js';

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

function parse(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

console.log('\n=== Parser Tests ===\n');

test('empty source produces empty AST', () => {
  const ast = parse('');
  assert(ast.kind === 'Program', 'Root node should be Program');
  assert(ast.body.length === 0, 'Body should be empty');
});

test('parse program declaration', () => {
  const ast = parse('program Hello { }');
  assert(ast.body.length === 1, 'Should have 1 top-level node');
  assert(ast.body[0].kind === 'ProgramDeclaration', 'Should be ProgramDeclaration');
  const prog = ast.body[0] as any;
  assert(prog.name === 'Hello', 'Program name should be Hello');
});

test('parse account declaration', () => {
  const ast = parse(`
    program Test {
      account User {
        name: string,
        age: u64
      }
    }
  `);
  const prog = ast.body[0] as any;
  assert(prog.body.length === 1, 'Should have 1 member');
  assert(prog.body[0].type === 'AccountDeclaration', 'Should be AccountDeclaration');
  assert(prog.body[0].name === 'User', 'Account name should be User');
  assert(prog.body[0].fields.length === 2, 'Should have 2 fields');
});

test('parse instruction', () => {
  const ast = parse(`
    program Test {
      pub instruction initialize(
        #[mut] signer authority,
        #[init] account data,
        value: u64
      ) {
        data.value = value;
      }
    }
  `);
  const prog = ast.body[0] as any;
  assert(prog.body.length === 1, 'Should have 1 member');
  const instr = prog.body[0];
  assert(instr.type === 'InstructionDeclaration', 'Should be InstructionDeclaration');
  assert(instr.name === 'initialize', 'Instruction name should be initialize');
  assert(instr.isPublic === true, 'Should be public');
  assert(instr.params.length === 3, 'Should have 3 params');
});

test('parse event declaration', () => {
  const ast = parse(`
    program Test {
      event Transfer { from: pubkey, to: pubkey, amount: u64 }
    }
  `);
  const prog = ast.body[0] as any;
  const event = prog.body[0];
  assert(event.type === 'EventDeclaration', 'Should be EventDeclaration');
  assert(event.name === 'Transfer', 'Event name should be Transfer');
  assert(event.fields.length === 3, 'Should have 3 fields');
});

test('parse error declaration', () => {
  const ast = parse(`
    program Test {
      error InsufficientFunds = "Not enough balance"
    }
  `);
  const prog = ast.body[0] as any;
  const err = prog.body[0];
  assert(err.type === 'ErrorDeclaration', 'Should be ErrorDeclaration');
  assert(err.name === 'InsufficientFunds', 'Error name should be InsufficientFunds');
});

test('parse import', () => {
  const ast = parse('import { Token, NFT } from "@purp/stdlib";');
  assert(ast.body.length === 1, 'Should have 1 import');
  const imp = ast.body[0] as any;
  assert(imp.type === 'ImportDeclaration', 'Should be ImportDeclaration');
  assert(imp.names.length === 2, 'Should import 2 names');
  assert(imp.source === '@purp/stdlib', 'Source should be @purp/stdlib');
});

test('parse struct declaration', () => {
  const ast = parse('struct Point { x: f64, y: f64 }');
  assert(ast.body.length === 1, 'Should have 1 node');
  assert(ast.body[0].kind === 'StructDeclaration', 'Should be StructDeclaration');
  const s = ast.body[0] as any;
  assert(s.name === 'Point', 'Struct name should be Point');
  assert(s.fields.length === 2, 'Should have 2 fields');
});

test('parse enum declaration', () => {
  const ast = parse('enum Status { Active, Paused, Closed }');
  assert(ast.body.length === 1, 'Should have 1 node');
  assert(ast.body[0].kind === 'EnumDeclaration', 'Should be EnumDeclaration');
  const e = ast.body[0] as any;
  assert(e.name === 'Status', 'Enum name should be Status');
  assert(e.variants.length === 3, 'Should have 3 variants');
});

test('parse function declaration', () => {
  const ast = parse(`
    fn calculate(amount: u64, rate: u16): u64 {
      return amount * rate as u64 / 10000;
    }
  `);
  assert(ast.body.length === 1, 'Should have 1 node');
  assert(ast.body[0].kind === 'FunctionDeclaration', 'Should be FunctionDeclaration');
  const fn_ = ast.body[0] as any;
  assert(fn_.name === 'calculate', 'Function name should be calculate');
  assert(fn_.params.length === 2, 'Should have 2 params');
});

test('parse const declaration', () => {
  const ast = parse('const MAX_SIZE: u64 = 1000;');
  assert(ast.body.length === 1, 'Should have 1 node');
  const c = ast.body[0] as any;
  assert(c.type === 'ConstDeclaration' || c.type === 'VariableDeclaration', 
    'Should be const declaration');
});

test('parse let statement in function', () => {
  const ast = parse(`
    fn test() {
      let x = 42;
      let mut y: u64 = 0;
    }
  `);
  const fn_ = ast.body[0] as any;
  assert(fn_.body.length === 2, 'Function should have 2 statements');
});

test('parse if/else statement', () => {
  const ast = parse(`
    fn test() {
      if x > 0 {
        return x;
      } else {
        return 0;
      }
    }
  `);
  const fn_ = ast.body[0] as any;
  const ifStmt = fn_.body[0];
  assert(ifStmt.type === 'IfStatement', 'Should be IfStatement');
});

test('parse for loop', () => {
  const ast = parse(`
    fn test() {
      for item in items {
        process(item);
      }
    }
  `);
  const fn_ = ast.body[0] as any;
  const forStmt = fn_.body[0];
  assert(forStmt.type === 'ForStatement', 'Should be ForStatement');
});

test('parse emit statement', () => {
  const ast = parse(`
    program Test {
      pub instruction test(#[mut] signer user) {
        emit Created(user, 42);
      }
    }
  `);
  const prog = ast.body[0] as any;
  const instr = prog.body[0] as any;
  const emitStmt = instr.body[0];
  assert(emitStmt.type === 'EmitStatement', 'Should be EmitStatement');
});

test('parse assert statement', () => {
  const ast = parse(`
    program Test {
      pub instruction test(#[mut] signer user) {
        assert(x > 0, "Must be positive");
      }
    }
  `);
  const prog = ast.body[0] as any;
  const instr = prog.body[0] as any;
  const assertStmt = instr.body[0];
  assert(assertStmt.type === 'AssertStatement', 'Should be AssertStatement');
});

test('parse complex program', () => {
  const source = `
    import { Token } from "@purp/stdlib";

    program TokenVault {
      account Vault {
        owner: pubkey,
        balance: u64
      }

      pub instruction deposit(
        #[mut] signer user,
        #[mut] account vault,
        amount: u64
      ) {
        assert(vault.owner == user, "Not owner");
        vault.balance += amount;
        emit Deposited(user, amount);
      }

      event Deposited { user: pubkey, amount: u64 }
      error Unauthorized = "Not authorized"
    }
  `;
  const ast = parse(source);
  assert(ast.body.length === 2, 'Should have import + program');
  assert(ast.body[0].kind === 'ImportDeclaration', 'First should be import');
  assert(ast.body[1].kind === 'ProgramDeclaration', 'Second should be program');
  const prog = ast.body[1] as any;
  assert(prog.body.length === 4, 'Program should have account + instruction + event + error');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
