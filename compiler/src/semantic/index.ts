// ============================================================================
// Purp Semantic Analyzer — The Solana Coding Language
// Validates AST for correctness before codegen
// ============================================================================

import * as AST from '../ast/index.js';
import { PurpDiagnostics, ErrorCode } from '../errors/index.js';

export class SemanticAnalyzer {
  private diagnostics = new PurpDiagnostics();
  private scopes: Map<string, string>[] = [new Map()];
  private types: Map<string, AST.TopLevelNode> = new Map();
  private file: string;

  constructor(file: string = '<stdin>') {
    this.file = file;
  }

  analyze(program: AST.ProgramNode): PurpDiagnostics {
    this.diagnostics.clear();
    this.collectTopLevelDeclarations(program.body);
    this.validateProgram(program);
    return this.diagnostics;
  }

  private collectTopLevelDeclarations(nodes: AST.TopLevelNode[]): void {
    for (const node of nodes) {
      switch (node.kind) {
        case 'ProgramDeclaration':
          this.define(node.name, 'program', node.span.start);
          this.collectTopLevelDeclarations(node.body);
          break;
        case 'AccountDeclaration':
          this.define(node.name, 'account', node.span.start);
          this.types.set(node.name, node);
          break;
        case 'StructDeclaration':
          this.define(node.name, 'struct', node.span.start);
          this.types.set(node.name, node);
          break;
        case 'EnumDeclaration':
          this.define(node.name, 'enum', node.span.start);
          this.types.set(node.name, node);
          break;
        case 'FunctionDeclaration':
          this.define(node.name, 'function', node.span.start);
          break;
        case 'InstructionDeclaration':
          this.define(node.name, 'instruction', node.span.start);
          break;
        case 'EventDeclaration':
          this.define(node.name, 'event', node.span.start);
          break;
        case 'ErrorDeclaration':
          this.define(node.name, 'error', node.span.start);
          break;
        case 'ConstDeclaration':
          this.define(node.name, 'const', node.span.start);
          break;
      }
    }
  }

  private validateProgram(program: AST.ProgramNode): void {
    for (const node of program.body) {
      this.validateTopLevel(node);
    }
  }

  private validateTopLevel(node: AST.TopLevelNode): void {
    switch (node.kind) {
      case 'ProgramDeclaration':
        for (const child of node.body) this.validateTopLevel(child);
        break;
      case 'InstructionDeclaration':
        this.validateInstruction(node);
        break;
      case 'FunctionDeclaration':
        this.validateFunction(node);
        break;
      case 'AccountDeclaration':
        this.validateFields(node.fields);
        break;
      case 'StructDeclaration':
        this.validateFields(node.fields);
        break;
    }
  }

  private validateInstruction(node: AST.InstructionDeclaration): void {
    // Validate accounts
    const hasSigner = node.accounts.some(a => a.accountType.kind === 'Signer');
    if (!hasSigner) {
      this.diagnostics.warning(
        ErrorCode.MissingAccountConstraint,
        `Instruction '${node.name}' has no signer account — this is unusual`,
        node.span.start,
        this.file,
        'Most instructions require at least one signer',
      );
    }

    // Validate body
    this.pushScope();
    for (const acc of node.accounts) {
      this.define(acc.name, 'account', acc.span.start);
    }
    for (const param of node.params) {
      this.define(param.name, 'param', param.span.start);
    }
    this.validateStatements(node.body);
    this.popScope();
  }

  private validateFunction(node: AST.FunctionDeclaration): void {
    this.pushScope();
    for (const param of node.params) {
      this.define(param.name, 'param', param.span.start);
    }
    this.validateStatements(node.body);
    this.popScope();
  }

  private validateStatements(stmts: AST.Statement[]): void {
    for (const stmt of stmts) {
      this.validateStatement(stmt);
    }
  }

  private validateStatement(stmt: AST.Statement): void {
    switch (stmt.kind) {
      case 'LetStatement':
        if (stmt.value) this.validateExpression(stmt.value);
        this.define(stmt.name, 'variable', stmt.span.start);
        break;
      case 'ConstStatement':
        this.validateExpression(stmt.value);
        this.define(stmt.name, 'const', stmt.span.start);
        break;
      case 'AssignmentStatement':
        this.validateExpression(stmt.target);
        this.validateExpression(stmt.value);
        break;
      case 'ExpressionStatement':
        this.validateExpression(stmt.expression);
        break;
      case 'ReturnStatement':
        if (stmt.value) this.validateExpression(stmt.value);
        break;
      case 'IfStatement':
        this.validateExpression(stmt.condition);
        this.validateStatements(stmt.then);
        if (stmt.elseIf) stmt.elseIf.forEach(ei => {
          this.validateExpression(ei.condition);
          this.validateStatements(ei.body);
        });
        if (stmt.else) this.validateStatements(stmt.else);
        break;
      case 'ForStatement':
        this.validateExpression(stmt.iterable);
        this.pushScope();
        this.define(stmt.variable, 'variable', stmt.span.start);
        this.validateStatements(stmt.body);
        this.popScope();
        break;
      case 'WhileStatement':
        this.validateExpression(stmt.condition);
        this.validateStatements(stmt.body);
        break;
      case 'LoopStatement':
        this.validateStatements(stmt.body);
        break;
    }
  }

  private validateExpression(expr: AST.Expression): void {
    switch (expr.kind) {
      case 'IdentifierExpr':
        if (!this.resolve(expr.name)) {
          // Don't error — could be a global or imported name; just note it
        }
        break;
      case 'BinaryExpr':
        this.validateExpression(expr.left);
        this.validateExpression(expr.right);
        break;
      case 'UnaryExpr':
        this.validateExpression(expr.operand);
        break;
      case 'CallExpr':
        this.validateExpression(expr.callee);
        expr.args.forEach(a => this.validateExpression(a));
        break;
      case 'MemberExpr':
        this.validateExpression(expr.object);
        break;
      case 'IndexExpr':
        this.validateExpression(expr.object);
        this.validateExpression(expr.index);
        break;
      case 'ArrayExpr':
        expr.elements.forEach(e => this.validateExpression(e));
        break;
      case 'StructInitExpr':
        expr.fields.forEach(f => this.validateExpression(f.value));
        break;
    }
  }

  private validateFields(fields: AST.FieldDeclaration[]): void {
    const names = new Set<string>();
    for (const field of fields) {
      if (names.has(field.name)) {
        this.diagnostics.error(
          ErrorCode.DuplicateDefinition,
          `Duplicate field '${field.name}'`,
          field.span.start,
          this.file,
        );
      }
      names.add(field.name);
    }
  }

  // === Scope helpers ===

  private pushScope(): void { this.scopes.push(new Map()); }
  private popScope(): void { this.scopes.pop(); }

  private define(name: string, kind: string, loc: AST.BaseNode['span']['start']): void {
    const currentScope = this.scopes[this.scopes.length - 1];
    if (currentScope.has(name)) {
      this.diagnostics.error(ErrorCode.DuplicateDefinition, `'${name}' is already defined in this scope`, loc, this.file);
    }
    currentScope.set(name, kind);
  }

  private resolve(name: string): string | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const val = this.scopes[i].get(name);
      if (val) return val;
    }
    return undefined;
  }
}
