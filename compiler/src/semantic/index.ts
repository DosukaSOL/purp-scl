// ============================================================================
// Purp Semantic Analyzer v0.2.0 — The Solana Coding Language
// Scope validation, symbol resolution, constraint checking
// ============================================================================

import * as AST from '../ast/index.js';
import { PurpDiagnostics, ErrorCode } from '../errors/index.js';
import { TypeChecker } from '../typechecker/index.js';

interface Symbol {
  name: string;
  kind: 'variable' | 'function' | 'account' | 'struct' | 'enum' | 'event' | 'error' | 'type' | 'const' | 'trait' | 'import';
  mutable?: boolean;
  node?: AST.BaseNode;
}

class Scope {
  symbols: Map<string, Symbol> = new Map();
  parent?: Scope;
  kind: 'global' | 'program' | 'function' | 'instruction' | 'block' | 'loop' | 'match' | 'test';

  constructor(kind: Scope['kind'], parent?: Scope) {
    this.kind = kind;
    this.parent = parent;
  }

  define(sym: Symbol): boolean {
    if (this.symbols.has(sym.name)) return false;
    this.symbols.set(sym.name, sym);
    return true;
  }

  resolve(name: string): Symbol | undefined {
    return this.symbols.get(name) ?? this.parent?.resolve(name);
  }

  isInLoop(): boolean {
    if (this.kind === 'loop') return true;
    return this.parent?.isInLoop() ?? false;
  }

  isInInstruction(): boolean {
    if (this.kind === 'instruction') return true;
    return this.parent?.isInInstruction() ?? false;
  }
}

export class SemanticAnalyzer {
  private diagnostics: PurpDiagnostics;
  private scope: Scope;
  private file: string;
  private typeChecker: TypeChecker;
  private programName?: string;

  constructor(file: string = '<stdin>') {
    this.diagnostics = new PurpDiagnostics();
    this.scope = new Scope('global');
    this.file = file;
    this.typeChecker = new TypeChecker(this.diagnostics, file);
    this.registerBuiltins();
  }

  analyze(program: AST.ProgramNode): PurpDiagnostics {
    // Type-check first
    this.typeChecker.check(program);

    // Then do semantic analysis
    for (const node of program.body) {
      this.analyzeTopLevel(node);
    }
    return this.diagnostics;
  }

  private registerBuiltins(): void {
    const builtins = [
      'u8', 'u16', 'u32', 'u64', 'u128',
      'i8', 'i16', 'i32', 'i64', 'i128',
      'f32', 'f64', 'bool', 'string', 'bytes', 'pubkey',
      'Pubkey', 'Signer', 'SystemProgram', 'Clock', 'Rent',
      'TokenProgram', 'AssociatedTokenProgram',
      'Vec', 'Option', 'Result', 'String',
    ];
    for (const b of builtins) {
      this.scope.define({ name: b, kind: 'type' });
    }
    // Built-in functions
    const fns = ['msg', 'print', 'log', 'require', 'sol_transfer'];
    for (const f of fns) {
      this.scope.define({ name: f, kind: 'function' });
    }
  }

  // =========================================================================
  // Top-Level Analysis
  // =========================================================================

  private analyzeTopLevel(node: AST.TopLevelNode): void {
    switch (node.kind) {
      case 'ProgramDeclaration':
        this.analyzeProgram(node);
        break;
      case 'InstructionDeclaration':
        this.analyzeInstruction(node);
        break;
      case 'AccountDeclaration':
        this.analyzeAccount(node);
        break;
      case 'StructDeclaration':
        this.analyzeStruct(node);
        break;
      case 'EnumDeclaration':
        this.analyzeEnum(node);
        break;
      case 'FunctionDeclaration':
        this.analyzeFunction(node);
        break;
      case 'EventDeclaration':
        this.scope.define({ name: node.name, kind: 'event', node });
        this.checkDuplicateFields(node.fields, node.name);
        break;
      case 'ErrorDeclaration':
        this.scope.define({ name: node.name, kind: 'error', node });
        break;
      case 'ImportDeclaration':
        for (const item of node.items) {
          this.scope.define({ name: item.alias ?? item.name, kind: 'import', node });
        }
        break;
      case 'ConstDeclaration':
        this.scope.define({ name: node.name, kind: 'const', node });
        this.analyzeExpression(node.value);
        break;
      case 'TypeAlias':
        this.scope.define({ name: node.name, kind: 'type', node });
        break;
      case 'ImplBlock':
        this.analyzeImpl(node);
        break;
      case 'TraitDeclaration':
        this.scope.define({ name: node.name, kind: 'trait', node });
        break;
      case 'TestBlock':
        this.analyzeTestBlock(node);
        break;
      case 'ClientBlock':
        this.diagnostics.warning(
          ErrorCode.UnsupportedFeature,
          `client{} block "${node.name}" is TypeScript-only — see generated TypeScript SDK output`,
          node.span?.start,
          this.file,
        );
        this.pushScope('block');
        this.analyzeStatements(node.body);
        this.popScope();
        break;
      case 'FrontendBlock':
        this.diagnostics.warning(
          ErrorCode.UnsupportedFeature,
          `frontend{} block is TypeScript-only — see generated frontend output`,
          node.span?.start,
          this.file,
        );
        this.pushScope('block');
        this.analyzeStatements(node.body);
        this.popScope();
        break;
      case 'ConfigBlock':
        break;
    }
  }

  private analyzeProgram(node: AST.ProgramDeclaration): void {
    this.programName = node.name;
    this.pushScope('program');
    for (const child of node.body) {
      this.analyzeTopLevel(child);
    }
    this.popScope();
  }

  private analyzeInstruction(node: AST.InstructionDeclaration): void {
    this.scope.define({ name: node.name, kind: 'function', node });
    this.pushScope('instruction');

    // Validate accounts
    let hasSigner = false;
    for (const acc of node.accounts) {
      this.scope.define({ name: acc.name, kind: 'account', mutable: this.isAccountMutable(acc), node: acc });
      if (acc.accountType.kind === 'Signer') hasSigner = true;

      // Validate PDA seeds
      if (acc.accountType.kind === 'PDA') {
        this.validatePDASeeds(acc);
      }

      // Validate init accounts have payer
      const isInit = acc.constraints.some(c => c.kind === 'init');
      if (isInit) {
        const hasPayer = acc.constraints.some(c => c.kind === 'payer');
        if (!hasPayer) {
          this.diagnostics.warning(
            ErrorCode.MissingAccountConstraint,
            `Account '${acc.name}' is #[init] but has no payer specified`,
            acc.span.start, this.file,
            'Add a payer constraint: payer = authority',
          );
        }
      }
    }

    if (!hasSigner && node.accounts.length > 0) {
      this.diagnostics.warning(
        ErrorCode.MissingAccountConstraint,
        `Instruction '${node.name}' has no signer account`,
        node.span.start, this.file,
        'At least one account should be a signer for security',
      );
    }

    // Register params
    for (const p of node.params) {
      this.scope.define({ name: p.name, kind: 'variable', node: p });
    }

    this.analyzeStatements(node.body);
    this.popScope();
  }

  private analyzeAccount(node: AST.AccountDeclaration): void {
    this.scope.define({ name: node.name, kind: 'account', node });
    this.checkDuplicateFields(node.fields, node.name);
  }

  private analyzeStruct(node: AST.StructDeclaration): void {
    this.scope.define({ name: node.name, kind: 'struct', node });
    this.checkDuplicateFields(node.fields, node.name);
  }

  private analyzeEnum(node: AST.EnumDeclaration): void {
    this.scope.define({ name: node.name, kind: 'enum', node });
    const variantNames = new Set<string>();
    for (const v of node.variants) {
      if (variantNames.has(v.name)) {
        this.diagnostics.error(ErrorCode.DuplicateDefinition, `Duplicate variant '${v.name}' in enum '${node.name}'`, v.span.start, this.file);
      }
      variantNames.add(v.name);
    }
  }

  private analyzeFunction(node: AST.FunctionDeclaration): void {
    this.scope.define({ name: node.name, kind: 'function', node });
    this.pushScope('function');

    if (node.genericParams) {
      for (const g of node.genericParams) {
        this.scope.define({ name: g.name, kind: 'type', node: g });
      }
    }

    for (const p of node.params) {
      this.scope.define({ name: p.name, kind: 'variable', node: p });
    }

    this.analyzeStatements(node.body);
    this.popScope();
  }

  private analyzeImpl(node: AST.ImplBlock): void {
    const targetType = this.scope.resolve(node.target);
    if (!targetType) {
      this.diagnostics.warning(ErrorCode.UndefinedType, `Type '${node.target}' not defined before impl block`, node.span.start, this.file);
    }
    for (const method of node.methods) {
      this.analyzeFunction(method);
    }
  }

  private analyzeTestBlock(node: AST.TestBlock): void {
    this.pushScope('test');
    this.analyzeStatements(node.body);
    this.popScope();
  }

  // =========================================================================
  // Statement Analysis
  // =========================================================================

  private analyzeStatements(stmts: AST.Statement[]): void {
    for (const stmt of stmts) this.analyzeStatement(stmt);
  }

  private analyzeStatement(stmt: AST.Statement): void {
    switch (stmt.kind) {
      case 'LetStatement':
        if (stmt.value) this.analyzeExpression(stmt.value);
        this.scope.define({ name: stmt.name, kind: 'variable', mutable: stmt.mutable, node: stmt });
        break;
      case 'ConstStatement':
        this.analyzeExpression(stmt.value);
        this.scope.define({ name: stmt.name, kind: 'const', node: stmt });
        break;
      case 'AssignmentStatement':
        this.analyzeExpression(stmt.target);
        this.analyzeExpression(stmt.value);
        // Check mutability
        if (stmt.target.kind === 'IdentifierExpr') {
          const sym = this.scope.resolve(stmt.target.name);
          if (sym && sym.kind === 'variable' && sym.mutable === false) {
            this.diagnostics.warning(ErrorCode.TypeMismatch, `Cannot assign to immutable variable '${stmt.target.name}'`, stmt.span.start, this.file, 'Declare with "let mut" to make mutable');
          }
        }
        break;
      case 'ExpressionStatement':
        this.analyzeExpression(stmt.expression);
        break;
      case 'ReturnStatement':
        if (stmt.value) this.analyzeExpression(stmt.value);
        break;
      case 'IfStatement':
        this.analyzeExpression(stmt.condition);
        this.pushScope('block');
        this.analyzeStatements(stmt.then);
        this.popScope();
        if (stmt.elseIf) {
          for (const ei of stmt.elseIf) {
            this.analyzeExpression(ei.condition);
            this.pushScope('block');
            this.analyzeStatements(ei.body);
            this.popScope();
          }
        }
        if (stmt.else) {
          this.pushScope('block');
          this.analyzeStatements(stmt.else);
          this.popScope();
        }
        break;
      case 'ForStatement':
        this.analyzeExpression(stmt.iterable);
        this.pushScope('loop');
        this.scope.define({ name: stmt.variable, kind: 'variable', node: stmt });
        this.analyzeStatements(stmt.body);
        this.popScope();
        break;
      case 'WhileStatement':
        this.analyzeExpression(stmt.condition);
        this.pushScope('loop');
        this.analyzeStatements(stmt.body);
        this.popScope();
        break;
      case 'LoopStatement':
        this.pushScope('loop');
        this.analyzeStatements(stmt.body);
        this.popScope();
        break;
      case 'BreakStatement':
      case 'ContinueStatement':
        if (!this.scope.isInLoop()) {
          this.diagnostics.error(ErrorCode.ParseError, `'${stmt.kind === 'BreakStatement' ? 'break' : 'continue'}' outside of loop`, stmt.span.start, this.file);
        }
        break;
      case 'MatchStatement':
        this.analyzeExpression(stmt.subject);
        for (const arm of stmt.arms) {
          this.pushScope('match');
          this.analyzePattern(arm.pattern);
          if (arm.guard) this.analyzeExpression(arm.guard);
          this.analyzeStatements(arm.body);
          this.popScope();
        }
        break;
      case 'EmitStatement':
        if (!this.scope.isInInstruction()) {
          this.diagnostics.warning(ErrorCode.ParseError, `'emit' outside of instruction`, stmt.span.start, this.file);
        }
        for (const arg of stmt.args) this.analyzeExpression(arg);
        break;
      case 'CPICall':
        this.analyzeCPI(stmt);
        break;
      case 'SPLOperation':
        this.analyzeSPL(stmt);
        break;
      case 'AssertStatement':
        this.analyzeExpression(stmt.condition);
        if (stmt.message) this.analyzeExpression(stmt.message);
        break;
      case 'RequireStatement':
        this.analyzeExpression(stmt.condition);
        if (stmt.errorCode) this.analyzeExpression(stmt.errorCode);
        if (stmt.message) this.analyzeExpression(stmt.message);
        break;
      case 'TryStatement':
        this.pushScope('block');
        this.analyzeStatements(stmt.body);
        this.popScope();
        this.pushScope('block');
        if (stmt.catchParam) {
          this.scope.define({ name: stmt.catchParam, kind: 'variable', node: stmt });
        }
        this.analyzeStatements(stmt.catchBody);
        this.popScope();
        break;
      case 'ThrowStatement':
        this.analyzeExpression(stmt.value);
        break;
      case 'DestructureStatement':
        this.analyzeExpression(stmt.value);
        this.analyzeDestructure(stmt.pattern);
        break;
      case 'BlockStatement':
        this.pushScope('block');
        this.analyzeStatements(stmt.body);
        this.popScope();
        break;
    }
  }

  // =========================================================================
  // Expression Analysis
  // =========================================================================

  private analyzeExpression(expr: AST.Expression): void {
    switch (expr.kind) {
      case 'IdentifierExpr': {
        const sym = this.scope.resolve(expr.name);
        if (!sym) {
          // Only warn for non-type references
          this.diagnostics.warning(ErrorCode.UndefinedVariable, `Undefined variable '${expr.name}'`, expr.span.start, this.file);
        }
        break;
      }
      case 'BinaryExpr':
        this.analyzeExpression(expr.left);
        this.analyzeExpression(expr.right);
        break;
      case 'UnaryExpr':
        this.analyzeExpression(expr.operand);
        break;
      case 'CallExpr':
        this.analyzeExpression(expr.callee);
        for (const arg of expr.args) this.analyzeExpression(arg);
        break;
      case 'MemberExpr':
      case 'OptionalChainExpr':
        this.analyzeExpression(expr.object);
        break;
      case 'IndexExpr':
        this.analyzeExpression(expr.object);
        this.analyzeExpression(expr.index);
        break;
      case 'ArrayExpr':
        for (const el of expr.elements) this.analyzeExpression(el);
        break;
      case 'ObjectExpr':
        for (const p of expr.properties) this.analyzeExpression(p.value);
        break;
      case 'TupleExpr':
        for (const el of expr.elements) this.analyzeExpression(el);
        break;
      case 'LambdaExpr':
        this.pushScope('function');
        for (const p of expr.params) {
          this.scope.define({ name: p.name, kind: 'variable', node: p });
        }
        if (Array.isArray(expr.body)) {
          this.analyzeStatements(expr.body);
        } else {
          this.analyzeExpression(expr.body);
        }
        this.popScope();
        break;
      case 'AwaitExpr':
        this.analyzeExpression(expr.expression);
        break;
      case 'TernaryExpr':
        this.analyzeExpression(expr.condition);
        this.analyzeExpression(expr.consequent);
        this.analyzeExpression(expr.alternate);
        break;
      case 'StructInitExpr':
        for (const f of expr.fields) this.analyzeExpression(f.value);
        break;
      case 'RangeExpr':
        this.analyzeExpression(expr.start);
        this.analyzeExpression(expr.end);
        break;
      case 'CastExpr':
        this.analyzeExpression(expr.expression);
        break;
      case 'TryExpr':
        this.analyzeExpression(expr.expression);
        break;
      case 'TemplateStringLiteral':
        for (const part of expr.parts) {
          if (typeof part !== 'string') this.analyzeExpression(part);
        }
        break;
    }
  }

  // =========================================================================
  // Pattern Analysis
  // =========================================================================

  private analyzePattern(pattern: AST.Pattern): void {
    switch (pattern.kind) {
      case 'IdentifierPattern':
        this.scope.define({ name: pattern.name, kind: 'variable' });
        break;
      case 'StructPattern':
        for (const f of pattern.fields) this.analyzePattern(f.pattern);
        break;
      case 'EnumPattern':
        if (pattern.fields) {
          for (const f of pattern.fields) this.analyzePattern(f);
        }
        break;
      case 'TuplePattern':
        for (const el of pattern.elements) this.analyzePattern(el);
        break;
      case 'ArrayPattern':
        for (const el of pattern.elements) this.analyzePattern(el);
        break;
      case 'OrPattern':
        for (const p of pattern.patterns) this.analyzePattern(p);
        break;
      case 'RangePattern':
        this.analyzeExpression(pattern.start);
        this.analyzeExpression(pattern.end);
        break;
    }
  }

  private analyzeDestructure(pattern: AST.DestructurePattern): void {
    switch (pattern.kind) {
      case 'ObjectDestructure':
        for (const f of pattern.fields) {
          this.scope.define({ name: f.alias ?? f.name, kind: 'variable' });
        }
        if (pattern.rest) this.scope.define({ name: pattern.rest, kind: 'variable' });
        break;
      case 'ArrayDestructure':
        for (const el of pattern.elements) {
          if (el) this.scope.define({ name: el, kind: 'variable' });
        }
        if (pattern.rest) this.scope.define({ name: pattern.rest, kind: 'variable' });
        break;
      case 'TupleDestructure':
        for (const el of pattern.elements) {
          this.scope.define({ name: el, kind: 'variable' });
        }
        break;
    }
  }

  // =========================================================================
  // Solana-Specific Validation
  // =========================================================================

  private validatePDASeeds(acc: AST.AccountParam): void {
    if (acc.accountType.kind !== 'PDA') return;
    if (acc.accountType.seeds.length === 0) {
      this.diagnostics.warning(
        ErrorCode.InvalidPDASeeds,
        `PDA account '${acc.name}' has no seeds defined`,
        acc.span.start, this.file,
        'Add seeds attribute: seeds = [b"prefix", user.key()]',
      );
    }
  }

  private analyzeCPI(stmt: AST.CPICall): void {
    if (!this.scope.isInInstruction()) {
      this.diagnostics.warning(ErrorCode.InvalidCPICall, `CPI call outside of instruction`, stmt.span.start, this.file);
    }
    for (const arg of stmt.args) this.analyzeExpression(arg);
    for (const acc of stmt.accounts) this.analyzeExpression(acc);
    if (stmt.seeds) {
      for (const seed of stmt.seeds) this.analyzeExpression(seed);
    }
  }

  private analyzeSPL(stmt: AST.SPLOperation): void {
    if (!this.scope.isInInstruction()) {
      this.diagnostics.warning(ErrorCode.ParseError, `SPL operation outside of instruction`, stmt.span.start, this.file);
    }
    const requiredFields: Record<string, string[]> = {
      transfer: ['from', 'to', 'amount', 'authority'],
      mint_to: ['mint', 'to', 'amount', 'authority'],
      burn: ['mint', 'from', 'amount', 'authority'],
      close_account: ['account', 'destination', 'authority'],
      create_associated_token_account: ['payer', 'wallet', 'mint'],
    };
    const required = requiredFields[stmt.operation] ?? [];
    const provided = stmt.args.map(a => a.name);
    for (const req of required) {
      if (!provided.includes(req)) {
        this.diagnostics.warning(ErrorCode.MissingAccountConstraint, `SPL ${stmt.operation} missing required field '${req}'`, stmt.span.start, this.file);
      }
    }
    for (const arg of stmt.args) this.analyzeExpression(arg.value);
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private checkDuplicateFields(fields: AST.FieldDeclaration[], parentName: string): void {
    const names = new Set<string>();
    for (const f of fields) {
      if (names.has(f.name)) {
        this.diagnostics.error(ErrorCode.DuplicateDefinition, `Duplicate field '${f.name}' in '${parentName}'`, f.span.start, this.file);
      }
      names.add(f.name);
    }
  }

  private isAccountMutable(acc: AST.AccountParam): boolean {
    if (acc.accountType.kind === 'Program') return false;
    return acc.accountType.mutable || acc.constraints.some(c => c.kind === 'mut' || c.kind === 'init');
  }

  private pushScope(kind: Scope['kind']): void {
    this.scope = new Scope(kind, this.scope);
  }

  private popScope(): void {
    if (this.scope.parent) {
      this.scope = this.scope.parent;
    }
  }

  private error(code: ErrorCode, msg: string, loc: AST.BaseNode): void {
    this.diagnostics.error(code, msg, loc.span.start, this.file);
  }
}
