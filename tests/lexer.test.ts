// Purp SCL — Lexer Tests

import { Lexer } from '../compiler/src/lexer/index.js';
import { TokenType } from '../compiler/src/lexer/tokens.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertTokenTypes(source: string, expected: TokenType[]): void {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  // Remove EOF token for comparison
  const nonEof = tokens.filter(t => t.type !== TokenType.EOF);
  assert(
    nonEof.length === expected.length,
    `Expected ${expected.length} tokens, got ${nonEof.length} for source: "${source}"\n` +
    `Tokens: ${nonEof.map(t => TokenType[t.type]).join(', ')}`
  );
  for (let i = 0; i < expected.length; i++) {
    assert(
      nonEof[i].type === expected[i],
      `Token ${i}: expected ${TokenType[expected[i]]}, got ${TokenType[nonEof[i].type]}`
    );
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

console.log('\n=== Lexer Tests ===\n');

test('empty source produces only EOF', () => {
  const lexer = new Lexer('');
  const tokens = lexer.tokenize();
  assert(tokens.length === 1, 'Expected 1 token (EOF)');
  assert(tokens[0].type === TokenType.EOF, 'Expected EOF token');
});

test('keyword: program', () => {
  assertTokenTypes('program', [TokenType.Program]);
});

test('keyword: instruction', () => {
  assertTokenTypes('instruction', [TokenType.Instruction]);
});

test('keyword: account', () => {
  assertTokenTypes('account', [TokenType.Account]);
});

test('Solana keywords', () => {
  assertTokenTypes('pda cpi token mint nft', [
    TokenType.PDA, TokenType.CPI, TokenType.Token, TokenType.Mint, TokenType.NFT
  ]);
});

test('identifiers', () => {
  assertTokenTypes('myVar _private camelCase', [
    TokenType.Identifier, TokenType.Identifier, TokenType.Identifier
  ]);
});

test('integer literal', () => {
  assertTokenTypes('42', [TokenType.Number]);
});

test('float literal', () => {
  assertTokenTypes('3.14', [TokenType.Number]);
});

test('string literal', () => {
  assertTokenTypes('"hello world"', [TokenType.String]);
});

test('boolean literals', () => {
  assertTokenTypes('true false', [TokenType.True, TokenType.False]);
});

test('null literal', () => {
  assertTokenTypes('null', [TokenType.Null]);
});

test('operators', () => {
  assertTokenTypes('+ - * / %', [
    TokenType.Plus, TokenType.Minus, TokenType.Star, TokenType.Slash, TokenType.Percent
  ]);
});

test('comparison operators', () => {
  assertTokenTypes('== != < <= > >=', [
    TokenType.Equals, TokenType.NotEquals,
    TokenType.LessThan, TokenType.LessEqual,
    TokenType.GreaterThan, TokenType.GreaterEqual
  ]);
});

test('logical operators', () => {
  assertTokenTypes('&& ||', [TokenType.And, TokenType.Or]);
});

test('brackets and delimiters', () => {
  assertTokenTypes('{ } ( ) [ ] , ; : .', [
    TokenType.LeftBrace, TokenType.RightBrace,
    TokenType.LeftParen, TokenType.RightParen,
    TokenType.LeftBracket, TokenType.RightBracket,
    TokenType.Comma, TokenType.Semicolon,
    TokenType.Colon, TokenType.Dot
  ]);
});

test('assignment operator', () => {
  assertTokenTypes('=', [TokenType.Assign]);
});

test('simple program declaration', () => {
  assertTokenTypes('program Hello { }', [
    TokenType.Program, TokenType.Identifier, TokenType.LeftBrace, TokenType.RightBrace
  ]);
});

test('account declaration tokens', () => {
  assertTokenTypes('account User { name: string, age: u64 }', [
    TokenType.Account, TokenType.Identifier, TokenType.LeftBrace,
    TokenType.Identifier, TokenType.Colon, TokenType.Identifier, TokenType.Comma,
    TokenType.Identifier, TokenType.Colon, TokenType.Identifier,
    TokenType.RightBrace
  ]);
});

test('instruction with attributes', () => {
  assertTokenTypes('pub instruction create(#[mut] signer user)', [
    TokenType.Pub, TokenType.Instruction, TokenType.Identifier, TokenType.LeftParen,
    TokenType.Hash, TokenType.LeftBracket, TokenType.Mut, TokenType.RightBracket,
    TokenType.Signer, TokenType.Identifier, TokenType.RightParen
  ]);
});

test('skips single-line comments', () => {
  assertTokenTypes('// this is a comment\n42', [TokenType.Number]);
});

test('skips multi-line comments', () => {
  assertTokenTypes('/* comment */ 42', [TokenType.Number]);
});

test('control flow keywords', () => {
  assertTokenTypes('if else for while match return', [
    TokenType.If, TokenType.Else, TokenType.For, TokenType.While,
    TokenType.Match, TokenType.Return
  ]);
});

test('type keywords', () => {
  assertTokenTypes('struct enum impl trait type', [
    TokenType.Struct, TokenType.Enum, TokenType.Impl, TokenType.Trait, TokenType.Type
  ]);
});

test('event, emit, and assert keywords', () => {
  assertTokenTypes('event emit assert', [
    TokenType.Event, TokenType.Emit, TokenType.Assert
  ]);
});

test('arrow and fat arrow', () => {
  assertTokenTypes('-> =>', [TokenType.Arrow, TokenType.FatArrow]);
});

test('let and const', () => {
  assertTokenTypes('let mut const', [TokenType.Let, TokenType.Mut, TokenType.Const]);
});

test('async await', () => {
  assertTokenTypes('async await', [TokenType.Async, TokenType.Await]);
});

test('import from', () => {
  assertTokenTypes('import from', [TokenType.Import, TokenType.From]);
});

// === New operator tokens (v1.1) ===

test('exponentiation operator **', () => {
  assertTokenTypes('2 ** 3', [TokenType.Number, TokenType.StarStar, TokenType.Number]);
});

test('exponentiation assign **=', () => {
  assertTokenTypes('x **= 2', [TokenType.Identifier, TokenType.StarStarAssign, TokenType.Number]);
});

test('nullish coalescing ??', () => {
  assertTokenTypes('a ?? b', [TokenType.Identifier, TokenType.NullishCoalesce, TokenType.Identifier]);
});

test('nullish coalescing assign ??=', () => {
  assertTokenTypes('a ??= b', [TokenType.Identifier, TokenType.NullishCoalesceAssign, TokenType.Identifier]);
});

test('spread operator ...', () => {
  assertTokenTypes('...arr', [TokenType.DotDotDot, TokenType.Identifier]);
});

test('spread in context with range', () => {
  assertTokenTypes('0..10', [TokenType.Number, TokenType.DotDot, TokenType.Number]);
});

test('?? distinct from ?.', () => {
  assertTokenTypes('a ?? b?.c', [
    TokenType.Identifier, TokenType.NullishCoalesce,
    TokenType.Identifier, TokenType.QuestionDot, TokenType.Identifier
  ]);
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
