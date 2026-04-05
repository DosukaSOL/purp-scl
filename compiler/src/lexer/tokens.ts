// ============================================================================
// Purp Token Types — The Solana Coding Language
// ============================================================================

export enum TokenType {
  // Literals
  Number = 'Number',
  String = 'String',
  Boolean = 'Boolean',
  Identifier = 'Identifier',
  Pubkey = 'Pubkey',

  // Operators
  Plus = 'Plus',
  Minus = 'Minus',
  Star = 'Star',
  Slash = 'Slash',
  Percent = 'Percent',
  Assign = 'Assign',
  Equals = 'Equals',
  NotEquals = 'NotEquals',
  LessThan = 'LessThan',
  GreaterThan = 'GreaterThan',
  LessEqual = 'LessEqual',
  GreaterEqual = 'GreaterEqual',
  And = 'And',
  Or = 'Or',
  Not = 'Not',
  Arrow = 'Arrow',
  FatArrow = 'FatArrow',
  Dot = 'Dot',
  DotDot = 'DotDot',
  Colon = 'Colon',
  ColonColon = 'ColonColon',
  Semicolon = 'Semicolon',
  Comma = 'Comma',
  Hash = 'Hash',
  At = 'At',
  Pipe = 'Pipe',
  Ampersand = 'Ampersand',
  Question = 'Question',

  // Delimiters
  LeftParen = 'LeftParen',
  RightParen = 'RightParen',
  LeftBrace = 'LeftBrace',
  RightBrace = 'RightBrace',
  LeftBracket = 'LeftBracket',
  RightBracket = 'RightBracket',

  // Keywords — Purp-native (Solana-first)
  Program = 'Program',
  Instruction = 'Instruction',
  Account = 'Account',
  Signer = 'Signer',
  Mut = 'Mut',
  Init = 'Init',
  Seeds = 'Seeds',
  Bump = 'Bump',
  PDA = 'PDA',
  Token = 'Token',
  Mint = 'Mint',
  NFT = 'NFT',
  CNFT = 'CNFT',
  CPI = 'CPI',
  Event = 'Event',
  Emit = 'Emit',
  Error = 'Error',

  // Keywords — General
  Let = 'Let',
  Const = 'Const',
  Fn = 'Fn',
  Return = 'Return',
  If = 'If',
  Else = 'Else',
  Match = 'Match',
  For = 'For',
  While = 'While',
  Loop = 'Loop',
  Break = 'Break',
  Continue = 'Continue',
  Struct = 'Struct',
  Enum = 'Enum',
  Impl = 'Impl',
  Trait = 'Trait',
  Type = 'Type',
  Pub = 'Pub',
  Use = 'Use',
  Module = 'Module',
  Import = 'Import',
  From = 'From',
  As = 'As',
  Self = 'Self',
  Super = 'Super',
  True = 'True',
  False = 'False',
  Null = 'Null',
  Async = 'Async',
  Await = 'Await',

  // Purp-specific keywords
  Client = 'Client',
  Frontend = 'Frontend',
  Config = 'Config',
  Deploy = 'Deploy',
  Test = 'Test',
  Transaction = 'Transaction',
  Wallet = 'Wallet',
  Lamports = 'Lamports',
  Sol = 'Sol',

  // Special
  EOF = 'EOF',
  Newline = 'Newline',
  Comment = 'Comment',
  DocComment = 'DocComment',
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
  file?: string;
}

export interface SourceSpan {
  start: SourceLocation;
  end: SourceLocation;
}

export interface Token {
  type: TokenType;
  value: string;
  span: SourceSpan;
}

export const KEYWORDS: Record<string, TokenType> = {
  'program': TokenType.Program,
  'instruction': TokenType.Instruction,
  'account': TokenType.Account,
  'signer': TokenType.Signer,
  'mut': TokenType.Mut,
  'init': TokenType.Init,
  'seeds': TokenType.Seeds,
  'bump': TokenType.Bump,
  'pda': TokenType.PDA,
  'token': TokenType.Token,
  'mint': TokenType.Mint,
  'nft': TokenType.NFT,
  'cnft': TokenType.CNFT,
  'cpi': TokenType.CPI,
  'event': TokenType.Event,
  'emit': TokenType.Emit,
  'error': TokenType.Error,
  'let': TokenType.Let,
  'const': TokenType.Const,
  'fn': TokenType.Fn,
  'return': TokenType.Return,
  'if': TokenType.If,
  'else': TokenType.Else,
  'match': TokenType.Match,
  'for': TokenType.For,
  'while': TokenType.While,
  'loop': TokenType.Loop,
  'break': TokenType.Break,
  'continue': TokenType.Continue,
  'struct': TokenType.Struct,
  'enum': TokenType.Enum,
  'impl': TokenType.Impl,
  'trait': TokenType.Trait,
  'type': TokenType.Type,
  'pub': TokenType.Pub,
  'use': TokenType.Use,
  'module': TokenType.Module,
  'import': TokenType.Import,
  'from': TokenType.From,
  'as': TokenType.As,
  'self': TokenType.Self,
  'super': TokenType.Super,
  'true': TokenType.True,
  'false': TokenType.False,
  'null': TokenType.Null,
  'async': TokenType.Async,
  'await': TokenType.Await,
  'client': TokenType.Client,
  'frontend': TokenType.Frontend,
  'config': TokenType.Config,
  'deploy': TokenType.Deploy,
  'test': TokenType.Test,
  'transaction': TokenType.Transaction,
  'wallet': TokenType.Wallet,
  'lamports': TokenType.Lamports,
  'sol': TokenType.Sol,
};
