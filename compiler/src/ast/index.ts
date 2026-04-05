// ============================================================================
// Purp AST Node Types — The Solana Coding Language
// Complete Abstract Syntax Tree definition for the Purp language
// ============================================================================

import { SourceSpan } from '../lexer/tokens.js';

// --- Base Node ---
export interface BaseNode {
  kind: string;
  span: SourceSpan;
}

// --- Program (Top Level) ---
export interface ProgramNode extends BaseNode {
  kind: 'Program';
  name: string;
  body: TopLevelNode[];
}

export type TopLevelNode =
  | ProgramDeclaration
  | InstructionDeclaration
  | AccountDeclaration
  | StructDeclaration
  | EnumDeclaration
  | FunctionDeclaration
  | EventDeclaration
  | ErrorDeclaration
  | ImportDeclaration
  | ConstDeclaration
  | TypeAlias
  | ImplBlock
  | TraitDeclaration
  | ClientBlock
  | FrontendBlock
  | ConfigBlock;

// --- Program Declaration ---
export interface ProgramDeclaration extends BaseNode {
  kind: 'ProgramDeclaration';
  name: string;
  id?: string;
  body: TopLevelNode[];
}

// --- Instruction ---
export interface InstructionDeclaration extends BaseNode {
  kind: 'InstructionDeclaration';
  name: string;
  visibility: 'pub' | 'private';
  accounts: AccountParam[];
  params: Parameter[];
  body: Statement[];
  returns?: TypeAnnotation;
}

export interface AccountParam extends BaseNode {
  kind: 'AccountParam';
  name: string;
  accountType: AccountType;
  constraints: AccountConstraint[];
}

export type AccountType =
  | { kind: 'Signer'; mutable: boolean }
  | { kind: 'Account'; type: string; mutable: boolean }
  | { kind: 'TokenAccount'; mutable: boolean }
  | { kind: 'Mint'; mutable: boolean }
  | { kind: 'PDA'; seeds: Expression[]; bump?: string; mutable: boolean }
  | { kind: 'Program'; name: string }
  | { kind: 'SystemAccount'; mutable: boolean };

export interface AccountConstraint {
  kind: 'init' | 'mut' | 'seeds' | 'bump' | 'has_one' | 'constraint' | 'close' | 'payer' | 'space';
  value?: Expression;
}

// --- Account / Struct ---
export interface AccountDeclaration extends BaseNode {
  kind: 'AccountDeclaration';
  name: string;
  fields: FieldDeclaration[];
  space?: number;
}

export interface StructDeclaration extends BaseNode {
  kind: 'StructDeclaration';
  name: string;
  fields: FieldDeclaration[];
  visibility: 'pub' | 'private';
}

export interface FieldDeclaration extends BaseNode {
  kind: 'FieldDeclaration';
  name: string;
  type: TypeAnnotation;
  visibility: 'pub' | 'private';
  default?: Expression;
}

// --- Enum ---
export interface EnumDeclaration extends BaseNode {
  kind: 'EnumDeclaration';
  name: string;
  variants: EnumVariant[];
  visibility: 'pub' | 'private';
}

export interface EnumVariant extends BaseNode {
  kind: 'EnumVariant';
  name: string;
  fields?: FieldDeclaration[];
  value?: Expression;
}

// --- Function ---
export interface FunctionDeclaration extends BaseNode {
  kind: 'FunctionDeclaration';
  name: string;
  visibility: 'pub' | 'private';
  params: Parameter[];
  returnType?: TypeAnnotation;
  body: Statement[];
  isAsync: boolean;
}

export interface Parameter extends BaseNode {
  kind: 'Parameter';
  name: string;
  type: TypeAnnotation;
  default?: Expression;
}

// --- Event ---
export interface EventDeclaration extends BaseNode {
  kind: 'EventDeclaration';
  name: string;
  fields: FieldDeclaration[];
}

// --- Error ---
export interface ErrorDeclaration extends BaseNode {
  kind: 'ErrorDeclaration';
  name: string;
  variants: ErrorVariant[];
}

export interface ErrorVariant extends BaseNode {
  kind: 'ErrorVariant';
  name: string;
  code: number;
  message: string;
}

// --- Import ---
export interface ImportDeclaration extends BaseNode {
  kind: 'ImportDeclaration';
  path: string;
  items: ImportItem[];
  isWildcard: boolean;
}

export interface ImportItem extends BaseNode {
  kind: 'ImportItem';
  name: string;
  alias?: string;
}

// --- Const ---
export interface ConstDeclaration extends BaseNode {
  kind: 'ConstDeclaration';
  name: string;
  type?: TypeAnnotation;
  value: Expression;
  visibility: 'pub' | 'private';
}

// --- Type Alias ---
export interface TypeAlias extends BaseNode {
  kind: 'TypeAlias';
  name: string;
  type: TypeAnnotation;
}

// --- Impl Block ---
export interface ImplBlock extends BaseNode {
  kind: 'ImplBlock';
  target: string;
  trait?: string;
  methods: FunctionDeclaration[];
}

// --- Trait ---
export interface TraitDeclaration extends BaseNode {
  kind: 'TraitDeclaration';
  name: string;
  methods: FunctionSignature[];
}

export interface FunctionSignature extends BaseNode {
  kind: 'FunctionSignature';
  name: string;
  params: Parameter[];
  returnType?: TypeAnnotation;
}

// --- Client Block (Purp-specific: client-side code generation) ---
export interface ClientBlock extends BaseNode {
  kind: 'ClientBlock';
  name: string;
  body: Statement[];
}

// --- Frontend Block ---
export interface FrontendBlock extends BaseNode {
  kind: 'FrontendBlock';
  framework?: string;
  body: Statement[];
}

// --- Config Block ---
export interface ConfigBlock extends BaseNode {
  kind: 'ConfigBlock';
  entries: ConfigEntry[];
}

export interface ConfigEntry extends BaseNode {
  kind: 'ConfigEntry';
  key: string;
  value: Expression;
}

// ============================================================================
// Type Annotations
// ============================================================================

export type TypeAnnotation =
  | PrimitiveType
  | NamedType
  | ArrayType
  | OptionType
  | TupleType
  | FunctionType
  | GenericType;

export interface PrimitiveType extends BaseNode {
  kind: 'PrimitiveType';
  name: 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'i8' | 'i16' | 'i32' | 'i64' | 'i128' | 'f32' | 'f64' | 'bool' | 'string' | 'pubkey' | 'bytes';
}

export interface NamedType extends BaseNode {
  kind: 'NamedType';
  name: string;
  typeArgs?: TypeAnnotation[];
}

export interface ArrayType extends BaseNode {
  kind: 'ArrayType';
  element: TypeAnnotation;
  size?: number;
}

export interface OptionType extends BaseNode {
  kind: 'OptionType';
  inner: TypeAnnotation;
}

export interface TupleType extends BaseNode {
  kind: 'TupleType';
  elements: TypeAnnotation[];
}

export interface FunctionType extends BaseNode {
  kind: 'FunctionType';
  params: TypeAnnotation[];
  returnType: TypeAnnotation;
}

export interface GenericType extends BaseNode {
  kind: 'GenericType';
  name: string;
  typeParams: TypeAnnotation[];
}

// ============================================================================
// Statements
// ============================================================================

export type Statement =
  | LetStatement
  | ConstStatement
  | AssignmentStatement
  | ExpressionStatement
  | ReturnStatement
  | IfStatement
  | MatchStatement
  | ForStatement
  | WhileStatement
  | LoopStatement
  | BreakStatement
  | ContinueStatement
  | EmitStatement
  | CPICall
  | BlockStatement;

export interface LetStatement extends BaseNode {
  kind: 'LetStatement';
  name: string;
  type?: TypeAnnotation;
  mutable: boolean;
  value?: Expression;
}

export interface ConstStatement extends BaseNode {
  kind: 'ConstStatement';
  name: string;
  type?: TypeAnnotation;
  value: Expression;
}

export interface AssignmentStatement extends BaseNode {
  kind: 'AssignmentStatement';
  target: Expression;
  value: Expression;
  operator: '=' | '+=' | '-=' | '*=' | '/=';
}

export interface ExpressionStatement extends BaseNode {
  kind: 'ExpressionStatement';
  expression: Expression;
}

export interface ReturnStatement extends BaseNode {
  kind: 'ReturnStatement';
  value?: Expression;
}

export interface IfStatement extends BaseNode {
  kind: 'IfStatement';
  condition: Expression;
  then: Statement[];
  elseIf?: { condition: Expression; body: Statement[] }[];
  else?: Statement[];
}

export interface MatchStatement extends BaseNode {
  kind: 'MatchStatement';
  subject: Expression;
  arms: MatchArm[];
}

export interface MatchArm extends BaseNode {
  kind: 'MatchArm';
  pattern: Expression;
  body: Statement[];
}

export interface ForStatement extends BaseNode {
  kind: 'ForStatement';
  variable: string;
  iterable: Expression;
  body: Statement[];
}

export interface WhileStatement extends BaseNode {
  kind: 'WhileStatement';
  condition: Expression;
  body: Statement[];
}

export interface LoopStatement extends BaseNode {
  kind: 'LoopStatement';
  body: Statement[];
}

export interface BreakStatement extends BaseNode {
  kind: 'BreakStatement';
}

export interface ContinueStatement extends BaseNode {
  kind: 'ContinueStatement';
}

export interface EmitStatement extends BaseNode {
  kind: 'EmitStatement';
  event: string;
  args: Expression[];
}

export interface CPICall extends BaseNode {
  kind: 'CPICall';
  program: string;
  instruction: string;
  accounts: Expression[];
  args: Expression[];
}

export interface BlockStatement extends BaseNode {
  kind: 'BlockStatement';
  body: Statement[];
}

// ============================================================================
// Expressions
// ============================================================================

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | PubkeyLiteral
  | NullLiteral
  | IdentifierExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | IndexExpr
  | ArrayExpr
  | ObjectExpr
  | LambdaExpr
  | AwaitExpr
  | TernaryExpr
  | StructInitExpr
  | RangeExpr
  | SolLiteral
  | LamportsLiteral;

export interface NumberLiteral extends BaseNode {
  kind: 'NumberLiteral';
  value: number;
  raw: string;
}

export interface StringLiteral extends BaseNode {
  kind: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral extends BaseNode {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface PubkeyLiteral extends BaseNode {
  kind: 'PubkeyLiteral';
  value: string;
}

export interface NullLiteral extends BaseNode {
  kind: 'NullLiteral';
}

export interface IdentifierExpr extends BaseNode {
  kind: 'IdentifierExpr';
  name: string;
}

export interface BinaryExpr extends BaseNode {
  kind: 'BinaryExpr';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpr extends BaseNode {
  kind: 'UnaryExpr';
  operator: string;
  operand: Expression;
}

export interface CallExpr extends BaseNode {
  kind: 'CallExpr';
  callee: Expression;
  args: Expression[];
}

export interface MemberExpr extends BaseNode {
  kind: 'MemberExpr';
  object: Expression;
  property: string;
}

export interface IndexExpr extends BaseNode {
  kind: 'IndexExpr';
  object: Expression;
  index: Expression;
}

export interface ArrayExpr extends BaseNode {
  kind: 'ArrayExpr';
  elements: Expression[];
}

export interface ObjectExpr extends BaseNode {
  kind: 'ObjectExpr';
  properties: { key: string; value: Expression }[];
}

export interface LambdaExpr extends BaseNode {
  kind: 'LambdaExpr';
  params: Parameter[];
  body: Statement[] | Expression;
}

export interface AwaitExpr extends BaseNode {
  kind: 'AwaitExpr';
  expression: Expression;
}

export interface TernaryExpr extends BaseNode {
  kind: 'TernaryExpr';
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface StructInitExpr extends BaseNode {
  kind: 'StructInitExpr';
  name: string;
  fields: { name: string; value: Expression }[];
}

export interface RangeExpr extends BaseNode {
  kind: 'RangeExpr';
  start: Expression;
  end: Expression;
  inclusive: boolean;
}

export interface SolLiteral extends BaseNode {
  kind: 'SolLiteral';
  amount: number;
}

export interface LamportsLiteral extends BaseNode {
  kind: 'LamportsLiteral';
  amount: number;
}

// --- AST Node (union of all) ---
export type ASTNode =
  | ProgramNode
  | TopLevelNode
  | Statement
  | Expression
  | TypeAnnotation
  | AccountParam
  | FieldDeclaration
  | EnumVariant
  | ErrorVariant
  | Parameter
  | ImportItem
  | MatchArm
  | ConfigEntry;
