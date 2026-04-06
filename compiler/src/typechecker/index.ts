// ============================================================================
// Purp Type Checker v1.0.0 — The Solana Coding Language
// Full type inference and type checking system
// ============================================================================

import * as AST from '../ast/index.js';
import { PurpDiagnostics, ErrorCode } from '../errors/index.js';

// Internal type representations
export type PurpType =
  | { kind: 'primitive'; name: string }
  | { kind: 'struct'; name: string; fields: Map<string, PurpType>; generics?: string[] }
  | { kind: 'enum'; name: string; variants: Map<string, PurpType | null>; generics?: string[] }
  | { kind: 'array'; element: PurpType; size?: number }
  | { kind: 'option'; inner: PurpType }
  | { kind: 'result'; ok: PurpType; err: PurpType }
  | { kind: 'tuple'; elements: PurpType[] }
  | { kind: 'function'; params: PurpType[]; returnType: PurpType }
  | { kind: 'generic'; name: string; constraint?: PurpType }
  | { kind: 'named'; name: string; typeArgs?: PurpType[] }
  | { kind: 'unknown' }
  | { kind: 'never' }
  | { kind: 'void' }
  | { kind: 'pubkey' }
  | { kind: 'any' };

export class TypeChecker {
  private diagnostics: PurpDiagnostics;
  private typeEnv: Map<string, PurpType>[] = [];
  private typeRegistry: Map<string, PurpType> = new Map();
  private file: string;

  constructor(diagnostics: PurpDiagnostics, file: string = '<stdin>') {
    this.diagnostics = diagnostics;
    this.file = file;
    this.initBuiltinTypes();
  }

  private initBuiltinTypes(): void {
    // Register primitive types
    const primitives = ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128', 'f32', 'f64', 'bool', 'string', 'bytes'];
    for (const p of primitives) {
      this.typeRegistry.set(p, { kind: 'primitive', name: p });
    }
    this.typeRegistry.set('pubkey', { kind: 'pubkey' });
    this.typeRegistry.set('Pubkey', { kind: 'pubkey' });

    // Solana built-in types
    this.typeRegistry.set('Signer', { kind: 'named', name: 'Signer' });
    this.typeRegistry.set('SystemProgram', { kind: 'named', name: 'SystemProgram' });
    this.typeRegistry.set('TokenProgram', { kind: 'named', name: 'TokenProgram' });
    this.typeRegistry.set('Rent', { kind: 'named', name: 'Rent' });
  }

  check(program: AST.ProgramNode): void {
    this.pushScope();
    this.registerTopLevelTypes(program.body);
    for (const node of program.body) {
      this.checkTopLevel(node);
    }
    this.popScope();
  }

  private registerTopLevelTypes(nodes: AST.TopLevelNode[]): void {
    for (const node of nodes) {
      switch (node.kind) {
        case 'ProgramDeclaration':
          this.registerTopLevelTypes(node.body);
          break;
        case 'AccountDeclaration': {
          const fields = new Map<string, PurpType>();
          for (const f of node.fields) {
            fields.set(f.name, this.resolveType(f.type));
          }
          this.typeRegistry.set(node.name, { kind: 'struct', name: node.name, fields });
          break;
        }
        case 'StructDeclaration': {
          const fields = new Map<string, PurpType>();
          for (const f of node.fields) {
            fields.set(f.name, this.resolveType(f.type));
          }
          const generics = node.genericParams?.map(g => g.name);
          this.typeRegistry.set(node.name, { kind: 'struct', name: node.name, fields, generics });
          break;
        }
        case 'EnumDeclaration': {
          const variants = new Map<string, PurpType | null>();
          for (const v of node.variants) {
            if (v.fields && v.fields.length > 0) {
              const fMap = new Map<string, PurpType>();
              for (const f of v.fields) fMap.set(f.name, this.resolveType(f.type));
              variants.set(v.name, { kind: 'struct', name: v.name, fields: fMap });
            } else {
              variants.set(v.name, null);
            }
          }
          const generics = node.genericParams?.map(g => g.name);
          this.typeRegistry.set(node.name, { kind: 'enum', name: node.name, variants, generics });
          break;
        }
        case 'TypeAlias': {
          this.typeRegistry.set(node.name, this.resolveType(node.type));
          break;
        }
        case 'FunctionDeclaration': {
          const paramTypes = node.params.map(p => this.resolveType(p.type));
          const returnType = node.returnType ? this.resolveType(node.returnType) : { kind: 'void' as const };
          this.typeRegistry.set(node.name, { kind: 'function', params: paramTypes, returnType });
          break;
        }
        case 'InstructionDeclaration': {
          // Allow instructions to be referenced for CPI
          const paramTypes = node.params.map(p => this.resolveType(p.type));
          this.typeRegistry.set(node.name, { kind: 'function', params: paramTypes, returnType: { kind: 'void' as const } });
          break;
        }
      }
    }
  }

  private checkTopLevel(node: AST.TopLevelNode): void {
    switch (node.kind) {
      case 'ProgramDeclaration':
        for (const child of node.body) this.checkTopLevel(child);
        break;
      case 'InstructionDeclaration':
        this.checkInstruction(node);
        break;
      case 'FunctionDeclaration':
        this.checkFunction(node);
        break;
      case 'ConstDeclaration':
        this.checkConst(node);
        break;
      case 'TestBlock':
        this.pushScope();
        this.checkStatements(node.body);
        this.popScope();
        break;
      case 'ClientBlock':
        this.pushScope();
        this.checkStatements(node.body);
        this.popScope();
        break;
      case 'FrontendBlock':
        this.pushScope();
        this.checkStatements(node.body);
        this.popScope();
        break;
    }
  }

  private checkInstruction(node: AST.InstructionDeclaration): void {
    this.pushScope();
    // Register account params
    for (const acc of node.accounts) {
      const accType = this.resolveAccountType(acc.accountType);
      this.define(acc.name, accType);
    }
    // Register value params
    for (const p of node.params) {
      this.define(p.name, this.resolveType(p.type));
    }
    this.checkStatements(node.body);
    this.popScope();
  }

  private checkFunction(node: AST.FunctionDeclaration): void {
    this.pushScope();
    // Register generic params
    if (node.genericParams) {
      for (const g of node.genericParams) {
        this.define(g.name, { kind: 'generic', name: g.name, constraint: g.constraint ? this.resolveType(g.constraint) : undefined });
      }
    }
    // Register params
    for (const p of node.params) {
      this.define(p.name, this.resolveType(p.type));
    }
    const returnType = node.returnType ? this.resolveType(node.returnType) : { kind: 'void' as const };
    this.checkStatements(node.body);

    // Check return type consistency
    if (node.returnType) {
      const lastStmt = node.body[node.body.length - 1];
      if (lastStmt && lastStmt.kind === 'ReturnStatement' && lastStmt.value) {
        const exprType = this.inferExprType(lastStmt.value);
        if (!this.isAssignable(exprType, returnType)) {
          this.diagnostics.warning(
            ErrorCode.TypeMismatch,
            `Return type mismatch in '${node.name}': expected ${this.typeToString(returnType)}, got ${this.typeToString(exprType)}`,
            lastStmt.span.start,
            this.file,
          );
        }
      }
    }
    this.popScope();
  }

  private checkConst(node: AST.ConstDeclaration): void {
    const valueType = this.inferExprType(node.value);
    if (node.type) {
      const declaredType = this.resolveType(node.type);
      if (!this.isAssignable(valueType, declaredType)) {
        this.diagnostics.error(
          ErrorCode.TypeMismatch,
          `Type mismatch in const '${node.name}': expected ${this.typeToString(declaredType)}, got ${this.typeToString(valueType)}`,
          node.span.start,
          this.file,
        );
      }
    }
    this.define(node.name, node.type ? this.resolveType(node.type) : valueType);
  }

  private checkStatements(stmts: AST.Statement[]): void {
    for (const stmt of stmts) {
      this.checkStatement(stmt);
    }
  }

  private checkStatement(stmt: AST.Statement): void {
    switch (stmt.kind) {
      case 'LetStatement': {
        let type: PurpType = { kind: 'unknown' };
        if (stmt.value) type = this.inferExprType(stmt.value);
        if (stmt.type) {
          const declared = this.resolveType(stmt.type);
          if (stmt.value && !this.isAssignable(type, declared)) {
            this.diagnostics.warning(
              ErrorCode.TypeMismatch,
              `Type mismatch in let '${stmt.name}': expected ${this.typeToString(declared)}, got ${this.typeToString(type)}`,
              stmt.span.start,
              this.file,
            );
          }
          type = declared;
        }
        this.define(stmt.name, type);
        break;
      }
      case 'ConstStatement': {
        const type = this.inferExprType(stmt.value);
        this.define(stmt.name, stmt.type ? this.resolveType(stmt.type) : type);
        break;
      }
      case 'AssignmentStatement':
        this.inferExprType(stmt.target);
        this.inferExprType(stmt.value);
        break;
      case 'ExpressionStatement':
        this.inferExprType(stmt.expression);
        break;
      case 'ReturnStatement':
        if (stmt.value) this.inferExprType(stmt.value);
        break;
      case 'IfStatement':
        this.checkIfType(stmt);
        break;
      case 'ForStatement': {
        const iterType = this.inferExprType(stmt.iterable);
        let elemType: PurpType = { kind: 'unknown' };
        if (iterType.kind === 'array') elemType = iterType.element;
        this.pushScope();
        this.define(stmt.variable, elemType);
        this.checkStatements(stmt.body);
        this.popScope();
        break;
      }
      case 'WhileStatement':
        this.inferExprType(stmt.condition);
        this.pushScope();
        this.checkStatements(stmt.body);
        this.popScope();
        break;
      case 'LoopStatement':
        this.pushScope();
        this.checkStatements(stmt.body);
        this.popScope();
        break;
      case 'MatchStatement':
        this.inferExprType(stmt.subject);
        for (const arm of stmt.arms) {
          this.pushScope();
          this.checkStatements(arm.body);
          this.popScope();
        }
        break;
      case 'TryStatement':
        this.pushScope();
        this.checkStatements(stmt.body);
        this.popScope();
        this.pushScope();
        if (stmt.catchParam) this.define(stmt.catchParam, { kind: 'named', name: 'Error' });
        this.checkStatements(stmt.catchBody);
        this.popScope();
        break;
      case 'AssertStatement':
        this.inferExprType(stmt.condition);
        if (stmt.message) this.inferExprType(stmt.message);
        break;
      case 'RequireStatement':
        this.inferExprType(stmt.condition);
        break;
      case 'DestructureStatement':
        this.inferExprType(stmt.value);
        this.checkDestructure(stmt.pattern, this.inferExprType(stmt.value));
        break;
      case 'BreakStatement':
      case 'ContinueStatement':
        // No type checking needed
        break;
      case 'EmitStatement':
        for (const arg of stmt.args) this.inferExprType(arg);
        break;
      case 'ThrowStatement':
        this.inferExprType(stmt.value);
        break;
      case 'CPICall':
        for (const acc of stmt.accounts) this.inferExprType(acc);
        for (const arg of stmt.args) this.inferExprType(arg);
        if (stmt.seeds) {
          for (const seed of stmt.seeds) this.inferExprType(seed);
        }
        break;
      case 'SPLOperation':
        for (const arg of stmt.args) this.inferExprType(arg.value);
        break;
      case 'BlockStatement':
        this.pushScope();
        this.checkStatements(stmt.body);
        this.popScope();
        break;
    }
  }

  private checkIfType(stmt: AST.IfStatement): void {
    const condType = this.inferExprType(stmt.condition);
    if (condType.kind !== 'primitive' || condType.name !== 'bool') {
      if (condType.kind !== 'unknown' && condType.kind !== 'any') {
        this.diagnostics.warning(
          ErrorCode.TypeMismatch,
          `If condition should be bool, got ${this.typeToString(condType)}`,
          stmt.span.start,
          this.file,
        );
      }
    }
    this.pushScope();
    this.checkStatements(stmt.then);
    this.popScope();
    if (stmt.elseIf) {
      for (const ei of stmt.elseIf) {
        this.inferExprType(ei.condition);
        this.pushScope();
        this.checkStatements(ei.body);
        this.popScope();
      }
    }
    if (stmt.else) {
      this.pushScope();
      this.checkStatements(stmt.else);
      this.popScope();
    }
  }

  private checkDestructure(pattern: AST.DestructurePattern, sourceType: PurpType): void {
    switch (pattern.kind) {
      case 'ObjectDestructure':
        for (const f of pattern.fields) {
          let fieldType: PurpType = { kind: 'unknown' };
          if (sourceType.kind === 'struct') {
            fieldType = sourceType.fields.get(f.name) ?? { kind: 'unknown' };
          }
          this.define(f.alias ?? f.name, fieldType);
        }
        break;
      case 'ArrayDestructure':
        for (const elem of pattern.elements) {
          if (elem) {
            let elemType: PurpType = { kind: 'unknown' };
            if (sourceType.kind === 'array') elemType = sourceType.element;
            this.define(elem, elemType);
          }
        }
        break;
      case 'TupleDestructure':
        for (let i = 0; i < pattern.elements.length; i++) {
          let elemType: PurpType = { kind: 'unknown' };
          if (sourceType.kind === 'tuple' && i < sourceType.elements.length) {
            elemType = sourceType.elements[i];
          }
          this.define(pattern.elements[i], elemType);
        }
        break;
    }
  }

  // =========================================================================
  // Type Inference
  // =========================================================================

  inferExprType(expr: AST.Expression): PurpType {
    switch (expr.kind) {
      case 'NumberLiteral': {
        // Infer integer vs float
        if (expr.raw.includes('.')) return { kind: 'primitive', name: 'f64' };
        const v = expr.value;
        if (v >= 0 && v <= 255) return { kind: 'primitive', name: 'u8' };
        if (v >= 0 && v <= 4294967295) return { kind: 'primitive', name: 'u64' };
        return { kind: 'primitive', name: 'i64' };
      }
      case 'StringLiteral':
      case 'TemplateStringLiteral':
        return { kind: 'primitive', name: 'string' };
      case 'BooleanLiteral':
        return { kind: 'primitive', name: 'bool' };
      case 'PubkeyLiteral':
        return { kind: 'pubkey' };
      case 'NullLiteral':
        return { kind: 'option', inner: { kind: 'unknown' } };
      case 'IdentifierExpr':
        return this.resolve(expr.name) ?? { kind: 'unknown' };
      case 'BinaryExpr': {
        const left = this.inferExprType(expr.left);
        const right = this.inferExprType(expr.right);
        // Comparison operators always return bool
        if (['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(expr.operator)) {
          return { kind: 'primitive', name: 'bool' };
        }
        // Arithmetic: infer from operands
        return this.unifyTypes(left, right);
      }
      case 'UnaryExpr':
        if (expr.operator === '!') return { kind: 'primitive', name: 'bool' };
        return this.inferExprType(expr.operand);
      case 'CallExpr':
        return this.inferCallType(expr);
      case 'MemberExpr':
      case 'OptionalChainExpr':
        return this.inferMemberType(expr);
      case 'IndexExpr': {
        const objType = this.inferExprType(expr.object);
        if (objType.kind === 'array') return objType.element;
        return { kind: 'unknown' };
      }
      case 'ArrayExpr': {
        if (expr.elements.length === 0) return { kind: 'array', element: { kind: 'unknown' } };
        const elemType = this.inferExprType(expr.elements[0]);
        return { kind: 'array', element: elemType };
      }
      case 'TupleExpr': {
        const elements = expr.elements.map(e => this.inferExprType(e));
        return { kind: 'tuple', elements };
      }
      case 'LambdaExpr': {
        const params = expr.params.map(p => this.resolveType(p.type));
        return { kind: 'function', params, returnType: { kind: 'unknown' } };
      }
      case 'AwaitExpr':
        return this.inferExprType(expr.expression);
      case 'CastExpr':
        return this.resolveType(expr.targetType);
      case 'TryExpr': {
        const inner = this.inferExprType(expr.expression);
        return inner; // ? operator unwraps Result
      }
      case 'StructInitExpr': {
        const structType = this.typeRegistry.get(expr.name);
        return structType ?? { kind: 'named', name: expr.name };
      }
      case 'RangeExpr':
        return { kind: 'named', name: 'Range' };
      case 'SolLiteral':
      case 'LamportsLiteral':
        return { kind: 'primitive', name: 'u64' };
      case 'TernaryExpr': {
        return this.inferExprType(expr.consequent);
      }
      default:
        return { kind: 'unknown' };
    }
  }

  private inferCallType(expr: AST.CallExpr): PurpType {
    // Direct function call (e.g., myFunction(...))
    if (expr.callee.kind === 'IdentifierExpr') {
      const fnType = this.resolve(expr.callee.name) ?? this.typeRegistry.get(expr.callee.name);
      if (fnType && fnType.kind === 'function') return fnType.returnType;
    }
    // Method call (e.g., obj.method(...))
    if (expr.callee.kind === 'MemberExpr') {
      const objType = this.inferExprType(expr.callee.object);
      // Array methods
      if (objType.kind === 'array') {
        switch (expr.callee.property) {
          case 'map': case 'filter': return { kind: 'array', element: { kind: 'unknown' } };
          case 'find': return { kind: 'option', inner: objType.element };
          case 'len': case 'length': return { kind: 'primitive', name: 'u64' };
          case 'push': case 'pop': return { kind: 'void' };
          case 'contains': case 'some': case 'every': return { kind: 'primitive', name: 'bool' };
        }
      }
      // String methods
      if (objType.kind === 'primitive' && objType.name === 'string') {
        switch (expr.callee.property) {
          case 'len': case 'length': return { kind: 'primitive', name: 'u64' };
          case 'contains': case 'starts_with': case 'ends_with': return { kind: 'primitive', name: 'bool' };
          case 'to_uppercase': case 'to_lowercase': case 'trim': return { kind: 'primitive', name: 'string' };
        }
      }
    }
    const calleeType = this.inferExprType(expr.callee);
    if (calleeType.kind === 'function') return calleeType.returnType;
    return { kind: 'unknown' };
  }

  private inferMemberType(expr: AST.MemberExpr | AST.OptionalChainExpr): PurpType {
    const objType = this.inferExprType(expr.object);
    if (objType.kind === 'struct') {
      return objType.fields.get(expr.property) ?? { kind: 'unknown' };
    }
    // Built-in methods on arrays (map, filter, etc.)
    if (objType.kind === 'array') {
      if (['map', 'filter', 'find', 'reduce', 'forEach', 'some', 'every', 'flat_map', 'len', 'length', 'push', 'pop', 'contains', 'iter'].includes(expr.property)) {
        return { kind: 'function', params: [], returnType: { kind: 'unknown' } };
      }
    }
    return { kind: 'unknown' };
  }

  // =========================================================================
  // Type Resolution
  // =========================================================================

  resolveType(type: AST.TypeAnnotation): PurpType {
    switch (type.kind) {
      case 'PrimitiveType':
        return this.typeRegistry.get(type.name) ?? { kind: 'primitive', name: type.name };
      case 'NamedType': {
        const registered = this.typeRegistry.get(type.name);
        if (registered) return registered;
        const typeArgs = type.typeArgs?.map(a => this.resolveType(a));
        return { kind: 'named', name: type.name, typeArgs };
      }
      case 'ArrayType':
        return { kind: 'array', element: this.resolveType(type.element), size: type.size };
      case 'OptionType':
        return { kind: 'option', inner: this.resolveType(type.inner) };
      case 'ResultType':
        return { kind: 'result', ok: this.resolveType(type.ok), err: type.err ? this.resolveType(type.err) : { kind: 'named', name: 'ProgramError' } };
      case 'TupleType':
        return { kind: 'tuple', elements: type.elements.map(e => this.resolveType(e)) };
      case 'FunctionType':
        return { kind: 'function', params: type.params.map(p => this.resolveType(p)), returnType: this.resolveType(type.returnType) };
      case 'GenericType':
        return { kind: 'named', name: type.name, typeArgs: type.typeParams.map(p => this.resolveType(p)) };
    }
  }

  private resolveAccountType(accType: AST.AccountType): PurpType {
    switch (accType.kind) {
      case 'Signer': return { kind: 'named', name: 'Signer' };
      case 'Account': return this.typeRegistry.get(accType.type) ?? { kind: 'named', name: accType.type };
      case 'TokenAccount': return { kind: 'named', name: 'TokenAccount' };
      case 'Mint': return { kind: 'named', name: 'Mint' };
      case 'PDA': return { kind: 'named', name: 'PDA' };
      case 'Program': return { kind: 'named', name: accType.name };
      case 'SystemAccount': return { kind: 'named', name: 'SystemAccount' };
    }
  }

  // =========================================================================
  // Type Compatibility
  // =========================================================================

  isAssignable(source: PurpType, target: PurpType): boolean {
    if (source.kind === 'unknown' || target.kind === 'unknown') return true;
    if (source.kind === 'any' || target.kind === 'any') return true;
    if (source.kind === 'never') return true;

    if (source.kind === target.kind) {
      if (source.kind === 'primitive' && target.kind === 'primitive') {
        // Allow numeric coercion
        const numericTypes = ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128', 'f32', 'f64'];
        if (numericTypes.includes(source.name) && numericTypes.includes(target.name)) return true;
        return source.name === target.name;
      }
      if (source.kind === 'array' && target.kind === 'array') {
        return this.isAssignable(source.element, target.element);
      }
      if (source.kind === 'option' && target.kind === 'option') {
        return this.isAssignable(source.inner, target.inner);
      }
      if (source.kind === 'tuple' && target.kind === 'tuple') {
        return source.elements.length === target.elements.length &&
          source.elements.every((e, i) => this.isAssignable(e, target.elements[i]));
      }
      if (source.kind === 'named' && target.kind === 'named') {
        return source.name === target.name;
      }
    }

    // Option can accept non-option (wrapping Some)
    if (target.kind === 'option') {
      return this.isAssignable(source, target.inner);
    }

    return false;
  }

  private unifyTypes(a: PurpType, b: PurpType): PurpType {
    if (a.kind === 'unknown') return b;
    if (b.kind === 'unknown') return a;
    if (this.isAssignable(a, b)) return b;
    return a;
  }

  typeToString(type: PurpType): string {
    switch (type.kind) {
      case 'primitive': return type.name;
      case 'pubkey': return 'pubkey';
      case 'struct': return type.name;
      case 'enum': return type.name;
      case 'array': return `${this.typeToString(type.element)}[]`;
      case 'option': return `${this.typeToString(type.inner)}?`;
      case 'result': return `Result<${this.typeToString(type.ok)}, ${this.typeToString(type.err)}>`;
      case 'tuple': return `(${type.elements.map(e => this.typeToString(e)).join(', ')})`;
      case 'function': return `fn(${type.params.map(p => this.typeToString(p)).join(', ')}) -> ${this.typeToString(type.returnType)}`;
      case 'generic': return type.name;
      case 'named': return type.typeArgs ? `${type.name}<${type.typeArgs.map(a => this.typeToString(a)).join(', ')}>` : type.name;
      case 'unknown': return 'unknown';
      case 'never': return 'never';
      case 'void': return 'void';
      case 'any': return 'any';
    }
  }

  // =========================================================================
  // Scope Management
  // =========================================================================

  private pushScope(): void {
    this.typeEnv.push(new Map());
  }

  private popScope(): void {
    this.typeEnv.pop();
  }

  private define(name: string, type: PurpType): void {
    if (this.typeEnv.length === 0) this.typeEnv.push(new Map());
    this.typeEnv[this.typeEnv.length - 1].set(name, type);
  }

  private resolve(name: string): PurpType | undefined {
    for (let i = this.typeEnv.length - 1; i >= 0; i--) {
      const t = this.typeEnv[i].get(name);
      if (t) return t;
    }
    return this.typeRegistry.get(name);
  }
}
