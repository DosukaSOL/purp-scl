// ============================================================================
// Purp TypeScript Code Generator v2.0.0 — The Solana Coding Language
// Generates Solana TypeScript client SDK using @solana/web3.js
// Complete with: IDL types, instruction methods, account fetchers,
// event listeners, error parsing, generics, tuples, template literals,
// client{} block codegen, frontend{} React component generation
// ============================================================================

import * as AST from '../../ast/index.js';

export class TypeScriptCodegen {
  private output: string[] = [];
  private indent: number = 0;
  private programName: string = '';
  private accounts: AST.AccountDeclaration[] = [];
  private instructions: AST.InstructionDeclaration[] = [];
  private events: AST.EventDeclaration[] = [];
  private errors: AST.ErrorDeclaration[] = [];
  private structs: AST.StructDeclaration[] = [];
  private enums: AST.EnumDeclaration[] = [];
  private clientBlocks: AST.ClientBlock[] = [];
  private frontendBlocks: AST.FrontendBlock[] = [];
  private configBlocks: AST.ConfigBlock[] = [];
  private consts: AST.ConstDeclaration[] = [];
  private functions: AST.FunctionDeclaration[] = [];

  generate(program: AST.ProgramNode): string {
    this.output = [];
    this.collectDeclarations(program.body);
    this.emitHeader();
    this.emitTypes();
    this.emitClientClass();
    this.emitClientBlocks();
    this.emitEventTypes();
    this.emitErrorTypes();
    this.emitHelperFunctions();
    this.emitFrontendBlocks();
    return this.output.join('\n');
  }

  /**
   * Generate ONLY the frontend output for frontend{} blocks.
   * Returns React/Next.js component code, or empty string if none.
   */
  generateFrontend(program: AST.ProgramNode): string {
    this.output = [];
    this.collectDeclarations(program.body);
    if (this.frontendBlocks.length === 0) return '';
    this.emitFrontendStandalone();
    return this.output.join('\n');
  }

  private collectDeclarations(nodes: AST.TopLevelNode[]): void {
    for (const node of nodes) {
      switch (node.kind) {
        case 'ProgramDeclaration':
          this.programName = node.name;
          this.collectDeclarations(node.body);
          break;
        case 'AccountDeclaration':
          this.accounts.push(node);
          break;
        case 'InstructionDeclaration':
          this.instructions.push(node);
          break;
        case 'EventDeclaration':
          this.events.push(node);
          break;
        case 'ErrorDeclaration':
          this.errors.push(node);
          break;
        case 'StructDeclaration':
          this.structs.push(node);
          break;
        case 'EnumDeclaration':
          this.enums.push(node);
          break;
        case 'ClientBlock':
          this.clientBlocks.push(node);
          break;
        case 'FrontendBlock':
          this.frontendBlocks.push(node);
          break;
        case 'ConfigBlock':
          this.configBlocks.push(node);
          break;
        case 'ConstDeclaration':
          this.consts.push(node);
          break;
        case 'FunctionDeclaration':
          this.functions.push(node);
          break;
      }
    }
  }

  // =========================================================================
  // Client Blocks — user-defined client{} code emitted as SDK methods
  // =========================================================================

  private emitClientBlocks(): void {
    if (this.clientBlocks.length === 0) return;

    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('// Client Logic (from client{} blocks)');
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('');

    for (const block of this.clientBlocks) {
      this.emit(`// --- client "${block.name}" ---`);
      this.emitClientStatements(block.body);
      this.emit('');
    }
  }

  private emitClientStatements(stmts: AST.Statement[]): void {
    for (const stmt of stmts) {
      this.emitTSStatement(stmt);
    }
  }

  // =========================================================================
  // Frontend Blocks — user-defined frontend{} code emitted as React components
  // =========================================================================

  private emitFrontendBlocks(): void {
    if (this.frontendBlocks.length === 0) return;

    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('// Frontend Components (from frontend{} blocks)');
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('');
    this.emit('// NOTE: These components are generated as React/TypeScript.');
    this.emit('// For full frontend output, use `purp build --target frontend`');
    this.emit('// which generates a separate Next.js-compatible module.');
    this.emit('');

    for (const block of this.frontendBlocks) {
      this.emit(`// --- frontend${block.framework ? ` (${block.framework})` : ''} ---`);
      this.emitFrontendStatements(block.body);
      this.emit('');
    }
  }

  private emitFrontendStatements(stmts: AST.Statement[]): void {
    for (const stmt of stmts) {
      this.emitTSStatement(stmt);
    }
  }

  /**
   * Generate standalone frontend output (React/Next.js components).
   */
  private emitFrontendStandalone(): void {
    const className = this.programName || 'PurpProgram';

    this.emit('// Auto-generated by Purp SCL Compiler v1.0.0 — Frontend Output');
    this.emit('// Do not edit manually');
    this.emit('');
    this.emit("import React, { useState, useEffect, useCallback } from 'react';");
    this.emit("import { useConnection, useWallet } from '@solana/wallet-adapter-react';");
    this.emit("import { PublicKey } from '@solana/web3.js';");
    this.emit("import BN from 'bn.js';");
    this.emit('');

    // Re-emit account types for the frontend module
    for (const acc of this.accounts) {
      this.emitInterface(acc.name, acc.fields);
    }
    for (const struct of this.structs) {
      this.emitStructInterface(struct);
    }

    // Emit a hook for each instruction
    for (const instr of this.instructions) {
      this.emitInstructionHook(instr);
    }

    // Emit a hook for each account fetcher
    for (const acc of this.accounts) {
      this.emitAccountHook(acc);
    }

    // Emit the frontend block bodies
    for (const block of this.frontendBlocks) {
      this.emit(`// --- frontend${block.framework ? ` (${block.framework})` : ''} ---`);
      this.emitFrontendStatements(block.body);
      this.emit('');
    }

    // Generate main App component if there are frontend blocks
    this.emit(`export function ${className}App() {`);
    this.indent++;
    this.emit('const { connection } = useConnection();');
    this.emit('const wallet = useWallet();');
    this.emit('');
    this.emit('return (');
    this.indent++;
    this.emit(`<div className="${this.toCamelCase(className)}-app">`);
    this.indent++;
    this.emit(`<h1>${className}</h1>`);
    this.emit('{wallet.connected ? (');
    this.indent++;
    this.emit('<div>');
    this.emit('  <p>Connected: {wallet.publicKey?.toBase58()}</p>');
    this.emit('</div>');
    this.indent--;
    this.emit(') : (');
    this.indent++;
    this.emit('<p>Connect your wallet to get started</p>');
    this.indent--;
    this.emit(')}');
    this.indent--;
    this.emit('</div>');
    this.indent--;
    this.emit(');');
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitInstructionHook(node: AST.InstructionDeclaration): void {
    const hookName = `use${this.toPascalCase(node.name)}`;
    const methodName = this.toCamelCase(node.name);

    this.emit(`export function ${hookName}(program: Program | null) {`);
    this.indent++;
    this.emit('const [loading, setLoading] = useState(false);');
    this.emit('const [error, setError] = useState<string | null>(null);');
    this.emit('const [txSignature, setTxSignature] = useState<string | null>(null);');
    this.emit('');

    const accountParams = node.accounts.map(a => `${this.toCamelCase(a.name)}: PublicKey`);
    const valueParams = node.params.map(p => `${this.toCamelCase(p.name)}: ${this.emitTypeStr(p.type)}`);
    const allParams = [...accountParams, ...valueParams];

    this.emit(`const execute = useCallback(async (${allParams.join(', ')}) => {`);
    this.indent++;
    this.emit('if (!program) return;');
    this.emit('setLoading(true);');
    this.emit('setError(null);');
    this.emit('try {');
    this.indent++;

    this.emit('const accounts = {');
    this.indent++;
    for (const acc of node.accounts) {
      this.emit(`${this.toCamelCase(acc.name)},`);
    }
    this.indent--;
    this.emit('};');

    const argNames = node.params.map(p => this.toCamelCase(p.name));
    const argsStr = argNames.length > 0 ? argNames.join(', ') : '';

    this.emit(`const sig = await program.methods.${methodName}(${argsStr})`);
    this.indent++;
    this.emit('.accounts(accounts)');
    this.emit('.rpc();');
    this.indent--;
    this.emit('setTxSignature(sig);');
    this.emit('return sig;');

    this.indent--;
    this.emit('} catch (err: any) {');
    this.indent++;
    this.emit("setError(err.message ?? 'Transaction failed');");
    this.indent--;
    this.emit('} finally {');
    this.indent++;
    this.emit('setLoading(false);');
    this.indent--;
    this.emit('}');
    this.indent--;
    this.emit('}, [program]);');
    this.emit('');
    this.emit('return { execute, loading, error, txSignature };');
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitAccountHook(acc: AST.AccountDeclaration): void {
    const hookName = `use${acc.name}`;

    this.emit(`export function ${hookName}(program: Program | null, address: PublicKey | null) {`);
    this.indent++;
    this.emit(`const [data, setData] = useState<${acc.name} | null>(null);`);
    this.emit('const [loading, setLoading] = useState(false);');
    this.emit('');
    this.emit('useEffect(() => {');
    this.indent++;
    this.emit('if (!program || !address) return;');
    this.emit('setLoading(true);');
    this.emit(`(program.account as any).${this.toCamelCase(acc.name)}.fetch(address)`);
    this.indent++;
    this.emit(`.then((acc: any) => setData(acc as ${acc.name}))`);
    this.emit('.catch(() => setData(null))');
    this.emit('.finally(() => setLoading(false));');
    this.indent--;
    this.indent--;
    this.emit('}, [program, address]);');
    this.emit('');
    this.emit('return { data, loading };');
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  // =========================================================================
  // Helper Functions & Constants
  // =========================================================================

  private emitHelperFunctions(): void {
    if (this.consts.length === 0 && this.functions.length === 0) return;

    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('// Constants & Helper Functions');
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('');

    for (const c of this.consts) {
      const typeStr = c.type ? `: ${this.emitTypeStr(c.type)}` : '';
      const vis = c.visibility === 'pub' ? 'export ' : '';
      this.emit(`${vis}const ${c.name}${typeStr} = ${this.emitTSExprStr(c.value)};`);
    }
    if (this.consts.length > 0) this.emit('');

    for (const fn of this.functions) {
      this.emitTSFunction(fn);
    }
  }

  private emitTSFunction(node: AST.FunctionDeclaration): void {
    const vis = node.visibility === 'pub' ? 'export ' : '';
    const asyncStr = node.isAsync ? 'async ' : '';
    const params = node.params.map(p =>
      `${this.toCamelCase(p.name)}: ${this.emitTypeStr(p.type)}`
    );
    const retType = node.returnType ? `: ${this.emitTypeStr(node.returnType)}` : '';
    this.emit(`${vis}${asyncStr}function ${this.toCamelCase(node.name)}(${params.join(', ')})${retType} {`);
    this.indent++;
    for (const stmt of node.body) {
      this.emitTSStatement(stmt);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  // =========================================================================
  // TypeScript Statement Emitter (for client{}/frontend{}/function bodies)
  // =========================================================================

  private emitTSStatement(stmt: AST.Statement): void {
    switch (stmt.kind) {
      case 'LetStatement': {
        const kw = stmt.mutable ? 'let' : 'const';
        const typeStr = stmt.type ? `: ${this.emitTypeStr(stmt.type)}` : '';
        const valueStr = stmt.value ? ` = ${this.emitTSExprStr(stmt.value)}` : '';
        this.emit(`${kw} ${this.toCamelCase(stmt.name)}${typeStr}${valueStr};`);
        break;
      }
      case 'ConstStatement': {
        const typeStr = stmt.type ? `: ${this.emitTypeStr(stmt.type)}` : '';
        this.emit(`const ${this.toCamelCase(stmt.name)}${typeStr} = ${this.emitTSExprStr(stmt.value)};`);
        break;
      }
      case 'AssignmentStatement':
        this.emit(`${this.emitTSExprStr(stmt.target)} ${stmt.operator} ${this.emitTSExprStr(stmt.value)};`);
        break;
      case 'ExpressionStatement':
        this.emit(`${this.emitTSExprStr(stmt.expression)};`);
        break;
      case 'ReturnStatement':
        this.emit(stmt.value ? `return ${this.emitTSExprStr(stmt.value)};` : 'return;');
        break;
      case 'IfStatement': {
        this.emit(`if (${this.emitTSExprStr(stmt.condition)}) {`);
        this.indent++;
        for (const s of stmt.then) this.emitTSStatement(s);
        this.indent--;
        if (stmt.elseIf) {
          for (const ei of stmt.elseIf) {
            this.emit(`} else if (${this.emitTSExprStr(ei.condition)}) {`);
            this.indent++;
            for (const s of ei.body) this.emitTSStatement(s);
            this.indent--;
          }
        }
        if (stmt.else && stmt.else.length > 0) {
          this.emit('} else {');
          this.indent++;
          for (const s of stmt.else) this.emitTSStatement(s);
          this.indent--;
        }
        this.emit('}');
        break;
      }
      case 'ForStatement':
        this.emit(`for (const ${this.toCamelCase(stmt.variable)} of ${this.emitTSExprStr(stmt.iterable)}) {`);
        this.indent++;
        for (const s of stmt.body) this.emitTSStatement(s);
        this.indent--;
        this.emit('}');
        break;
      case 'WhileStatement':
        this.emit(`while (${this.emitTSExprStr(stmt.condition)}) {`);
        this.indent++;
        for (const s of stmt.body) this.emitTSStatement(s);
        this.indent--;
        this.emit('}');
        break;
      case 'BreakStatement':
        this.emit('break;');
        break;
      case 'ContinueStatement':
        this.emit('continue;');
        break;
      case 'ThrowStatement':
        this.emit(`throw ${this.emitTSExprStr(stmt.value)};`);
        break;
      case 'TryStatement':
        this.emit('try {');
        this.indent++;
        for (const s of stmt.body) this.emitTSStatement(s);
        this.indent--;
        this.emit(`} catch (${stmt.catchParam ?? 'err'}) {`);
        this.indent++;
        for (const s of stmt.catchBody) this.emitTSStatement(s);
        this.indent--;
        this.emit('}');
        break;
      case 'EmitStatement':
        this.emit(`console.log('[event] ${stmt.event}', ${stmt.args.map(a => this.emitTSExprStr(a)).join(', ')});`);
        break;
      case 'MatchStatement': {
        this.emit(`switch (${this.emitTSExprStr(stmt.subject)}) {`);
        this.indent++;
        for (const arm of stmt.arms) {
          const pat = this.emitTSPattern(arm.pattern);
          if (pat === '_') {
            this.emit('default: {');
          } else {
            const guard = arm.guard ? ` if (${this.emitTSExprStr(arm.guard)})` : '';
            this.emit(`case ${pat}:${guard} {`);
          }
          this.indent++;
          for (const s of arm.body) this.emitTSStatement(s);
          this.emit('break;');
          this.indent--;
          this.emit('}');
        }
        this.indent--;
        this.emit('}');
        break;
      }
      case 'LoopStatement':
        this.emit('while (true) {');
        this.indent++;
        for (const s of stmt.body) this.emitTSStatement(s);
        this.indent--;
        this.emit('}');
        break;
      case 'BlockStatement':
        this.emit('{');
        this.indent++;
        for (const s of stmt.body) this.emitTSStatement(s);
        this.indent--;
        this.emit('}');
        break;
      case 'CPICall': {
        const cpiArgs = stmt.args.map(a => this.emitTSExprStr(a)).join(', ');
        const cpiAccounts = stmt.accounts.map(a => this.emitTSExprStr(a)).join(', ');
        this.emit(`await program.methods.${this.toCamelCase(stmt.instruction)}(${cpiArgs})`);
        this.indent++;
        this.emit(`.accounts({ ${cpiAccounts} })`);
        this.emit('.rpc();');
        this.indent--;
        break;
      }
      case 'SPLOperation': {
        const splArgs = stmt.args.map(a => `${a.name}: ${this.emitTSExprStr(a.value)}`).join(', ');
        this.emit(`await spl.${this.toCamelCase(stmt.operation)}({ ${splArgs} });`);
        break;
      }
      case 'AssertStatement': {
        const msg = stmt.message ? `, ${this.emitTSExprStr(stmt.message)}` : '';
        this.emit(`if (!(${this.emitTSExprStr(stmt.condition)})) throw new Error(${msg || '"Assertion failed"'});`);
        break;
      }
      case 'RequireStatement': {
        const errMsg = stmt.message ? this.emitTSExprStr(stmt.message) : (stmt.errorCode ? this.emitTSExprStr(stmt.errorCode) : '"Requirement not met"');
        this.emit(`if (!(${this.emitTSExprStr(stmt.condition)})) throw new Error(${errMsg});`);
        break;
      }
      case 'DestructureStatement': {
        const kw = stmt.mutable ? 'let' : 'const';
        const pat = this.emitTSDestructurePattern(stmt.pattern);
        const typeStr = stmt.type ? `: ${this.emitTypeStr(stmt.type)}` : '';
        this.emit(`${kw} ${pat}${typeStr} = ${this.emitTSExprStr(stmt.value)};`);
        break;
      }
      default:
        this.emit(`/* unsupported statement: ${(stmt as any).kind} */`);
    }
  }

  private emitTSExprStr(expr: AST.Expression): string {
    switch (expr.kind) {
      case 'NumberLiteral': return expr.raw;
      case 'StringLiteral': return `"${expr.value}"`;
      case 'TemplateStringLiteral': return this.emitTSTemplateString(expr);
      case 'BooleanLiteral': return expr.value ? 'true' : 'false';
      case 'PubkeyLiteral': return `new PublicKey("${expr.value}")`;
      case 'NullLiteral': return 'null';
      case 'IdentifierExpr': return this.toCamelCase(expr.name);
      case 'BinaryExpr': return `(${this.emitTSExprStr(expr.left)} ${expr.operator} ${this.emitTSExprStr(expr.right)})`;
      case 'UnaryExpr': return `${expr.operator}${this.emitTSExprStr(expr.operand)}`;
      case 'CallExpr': {
        const callee = this.emitTSExprStr(expr.callee);
        const args = expr.args.map(a => this.emitTSExprStr(a)).join(', ');
        return `${callee}(${args})`;
      }
      case 'MemberExpr': return `${this.emitTSExprStr(expr.object)}.${this.toCamelCase(expr.property)}`;
      case 'OptionalChainExpr': return `${this.emitTSExprStr(expr.object)}?.${this.toCamelCase(expr.property)}`;
      case 'IndexExpr': return `${this.emitTSExprStr(expr.object)}[${this.emitTSExprStr(expr.index)}]`;
      case 'ArrayExpr': return `[${expr.elements.map(e => this.emitTSExprStr(e)).join(', ')}]`;
      case 'SpreadExpr': return `...${this.emitTSExprStr(expr.expression)}`;
      case 'ObjectExpr': return `{ ${expr.properties.map(p => `${p.key}: ${this.emitTSExprStr(p.value)}`).join(', ')} }`;
      case 'TupleExpr': return `[${expr.elements.map(e => this.emitTSExprStr(e)).join(', ')}]`;
      case 'LambdaExpr': {
        const params = expr.params.map(p => {
          const t = p.type ? `: ${this.emitTypeStr(p.type)}` : '';
          return `${this.toCamelCase(p.name)}${t}`;
        });
        if (Array.isArray(expr.body)) {
          return `(${params.join(', ')}) => { /* ... */ }`;
        }
        return `(${params.join(', ')}) => ${this.emitTSExprStr(expr.body)}`;
      }
      case 'AwaitExpr': return `await ${this.emitTSExprStr(expr.expression)}`;
      case 'TernaryExpr': return `${this.emitTSExprStr(expr.condition)} ? ${this.emitTSExprStr(expr.consequent)} : ${this.emitTSExprStr(expr.alternate)}`;
      case 'StructInitExpr': {
        const fields = expr.fields.map(f => `${this.toCamelCase(f.name)}: ${this.emitTSExprStr(f.value)}`);
        return `{ ${fields.join(', ')} }`;
      }
      case 'SolLiteral': return `${expr.amount} * LAMPORTS_PER_SOL`;
      case 'LamportsLiteral': return `${expr.amount}`;
      case 'CastExpr': return `(${this.emitTSExprStr(expr.expression)} as ${this.emitTypeStr(expr.targetType)})`;
      case 'TryExpr': return this.emitTSExprStr(expr.expression);
      case 'RangeExpr': {
        const start = this.emitTSExprStr(expr.start);
        const end = this.emitTSExprStr(expr.end);
        return expr.inclusive
          ? `Array.from({ length: ${end} - ${start} + 1 }, (_, i) => ${start} + i)`
          : `Array.from({ length: ${end} - ${start} }, (_, i) => ${start} + i)`;
      }
      default: return `/* unsupported expr: ${(expr as any).kind} */`;
    }
  }

  private emitTSTemplateString(expr: AST.TemplateStringLiteral): string {
    let result = '`';
    for (const part of expr.parts) {
      if (typeof part === 'string') {
        result += part;
      } else {
        result += '${' + this.emitTSExprStr(part) + '}';
      }
    }
    return result + '`';
  }

  private emitTSPattern(pattern: AST.Pattern): string {
    switch (pattern.kind) {
      case 'LiteralPattern': return this.emitTSExprStr(pattern.value);
      case 'IdentifierPattern': return pattern.name;
      case 'WildcardPattern': return '_';
      case 'EnumPattern': return `"${pattern.variant}"`;
      case 'OrPattern': return pattern.patterns.map(p => this.emitTSPattern(p)).join(' || ');
      default: return `/* pattern ${pattern.kind} */`;
    }
  }

  private emitTSDestructurePattern(pattern: AST.DestructurePattern): string {
    switch (pattern.kind) {
      case 'ObjectDestructure': {
        const fields = pattern.fields.map(f => {
          if (f.alias) return `${f.name}: ${f.alias}`;
          if (f.default) return `${f.name} = ${this.emitTSExprStr(f.default)}`;
          return f.name;
        });
        const rest = pattern.rest ? `, ...${pattern.rest}` : '';
        return `{ ${fields.join(', ')}${rest} }`;
      }
      case 'ArrayDestructure': {
        const elems = pattern.elements.map(e => e ?? '_');
        const rest = pattern.rest ? `, ...${pattern.rest}` : '';
        return `[${elems.join(', ')}${rest}]`;
      }
      case 'TupleDestructure':
        return `[${pattern.elements.join(', ')}]`;
    }
  }

  // =========================================================================
  // Header
  // =========================================================================

  private emitHeader(): void {
    this.emit('// Auto-generated by Purp SCL Compiler v1.0.0');
    this.emit('// Do not edit manually');
    this.emit('');
    this.emit("import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';");
    this.emit("import BN from 'bn.js';");
    this.emit("import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';");
    this.emit('');

    // Emit config if present
    if (this.configBlocks.length > 0) {
      this.emit('// ═══════════════════════════════════════════════════════');
      this.emit('// Configuration');
      this.emit('// ═══════════════════════════════════════════════════════');
      this.emit('');
      for (const config of this.configBlocks) {
        this.emit('export const CONFIG = {');
        this.indent++;
        for (const entry of config.entries) {
          this.emit(`${this.toCamelCase(entry.key)}: ${this.emitTSExprStr(entry.value)},`);
        }
        this.indent--;
        this.emit('};');
        this.emit('');
      }
    }
  }

  // =========================================================================
  // Type Interfaces
  // =========================================================================

  private emitTypes(): void {
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('// Account Types');
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('');

    for (const acc of this.accounts) {
      this.emitInterface(acc.name, acc.fields);
    }

    for (const struct of this.structs) {
      this.emitStructInterface(struct);
    }

    for (const enumDecl of this.enums) {
      this.emitEnumType(enumDecl);
    }

    this.emit('');
  }

  private emitInterface(name: string, fields: AST.FieldDeclaration[]): void {
    this.emit(`export interface ${name} {`);
    this.indent++;
    for (const field of fields) {
      this.emit(`${this.toCamelCase(field.name)}: ${this.emitTypeStr(field.type)};`);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitStructInterface(node: AST.StructDeclaration): void {
    const generics = node.genericParams && node.genericParams.length > 0
      ? `<${node.genericParams.map(g => g.name).join(', ')}>`
      : '';
    this.emit(`export interface ${node.name}${generics} {`);
    this.indent++;
    for (const field of node.fields) {
      this.emit(`${this.toCamelCase(field.name)}: ${this.emitTypeStr(field.type)};`);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitEnumType(node: AST.EnumDeclaration): void {
    const generics = node.genericParams && node.genericParams.length > 0
      ? `<${node.genericParams.map(g => g.name).join(', ')}>`
      : '';

    // Emit as discriminated union or simple enum
    const hasFields = node.variants.some(v => v.fields && v.fields.length > 0);
    if (hasFields) {
      this.emit(`export type ${node.name}${generics} =`);
      this.indent++;
      for (let i = 0; i < node.variants.length; i++) {
        const v = node.variants[i];
        const sep = i < node.variants.length - 1 ? ' |' : ';';
        if (v.fields && v.fields.length > 0) {
          const fields = v.fields.map(f => `${this.toCamelCase(f.name)}: ${this.emitTypeStr(f.type)}`).join('; ');
          this.emit(`{ kind: '${v.name}'; ${fields} }${sep}`);
        } else {
          this.emit(`{ kind: '${v.name}' }${sep}`);
        }
      }
      this.indent--;
    } else {
      this.emit(`export enum ${node.name} {`);
      this.indent++;
      for (const v of node.variants) {
        this.emit(`${v.name},`);
      }
      this.indent--;
      this.emit('}');
    }
    this.emit('');
  }

  // =========================================================================
  // Client Class
  // =========================================================================

  private emitClientClass(): void {
    const className = this.programName || 'PurpProgram';
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('// Client SDK');
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('');
    this.emit(`export class ${className}Client {`);
    this.indent++;
    this.emit('private programId: PublicKey;');
    this.emit('private connection: Connection;');
    this.emit('');

    // Constructor
    this.emit('constructor(programId: PublicKey, connection: Connection) {');
    this.indent++;
    this.emit('this.programId = programId;');
    this.emit('this.connection = connection;');
    this.indent--;
    this.emit('}');
    this.emit('');

    // Static factory
    this.emit(`static create(programId: PublicKey, connection: Connection): ${className}Client {`);
    this.indent++;
    this.emit(`return new ${className}Client(programId, connection);`);
    this.indent--;
    this.emit('}');
    this.emit('');

    // Instruction methods
    for (const instr of this.instructions) {
      this.emitInstructionMethod(instr);
    }

    // Account fetchers
    for (const acc of this.accounts) {
      this.emitAccountFetcher(acc);
    }

    // Event listeners
    if (this.events.length > 0) {
      this.emitEventListener();
    }

    // PDA helpers
    this.emitPDAHelpers();

    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitInstructionMethod(node: AST.InstructionDeclaration): void {
    const methodName = this.toCamelCase(node.name);
    const accountParams = node.accounts.map(a =>
      `${this.toCamelCase(a.name)}: PublicKey`
    );
    const valueParams = node.params.map(p =>
      `${this.toCamelCase(p.name)}: ${this.emitTypeStr(p.type)}`
    );
    const allParams = [...accountParams, ...valueParams];

    this.emit(`async ${methodName}(`);
    this.indent++;
    for (let i = 0; i < allParams.length; i++) {
      this.emit(`${allParams[i]}${i < allParams.length - 1 ? ',' : ''}`);
    }
    this.indent--;
    this.emit('): Promise<string> {');
    this.indent++;

    // Build accounts object
    this.emit('const accounts = {');
    this.indent++;
    for (const acc of node.accounts) {
      const accName = this.toCamelCase(acc.name);
      if (acc.accountType.kind === 'Program') {
        if (acc.accountType.name === 'System') {
          this.emit(`${accName}: SystemProgram.programId,`);
        } else if (acc.accountType.name === 'Token') {
          this.emit(`${accName}: TOKEN_PROGRAM_ID,`);
        } else {
          this.emit(`${accName}: ${accName},`);
        }
      } else {
        this.emit(`${accName}: ${accName},`);
      }
    }
    this.indent--;
    this.emit('};');
    this.emit('');

    // Build args
    const argNames = node.params.map(p => this.toCamelCase(p.name));
    const argsStr = argNames.length > 0 ? argNames.join(', ') : '';

    this.emit(`const tx = await this.program.methods.${this.toCamelCase(node.name)}(${argsStr})`);
    this.indent++;
    this.emit('.accounts(accounts)');
    this.emit('.rpc();');
    this.indent--;
    this.emit('');
    this.emit('return tx;');

    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitAccountFetcher(acc: AST.AccountDeclaration): void {
    const methodName = `fetch${acc.name}`;
    this.emit(`async ${methodName}(address: PublicKey): Promise<${acc.name} | null> {`);
    this.indent++;
    this.emit('try {');
    this.indent++;
    this.emit(`const account = await (this.program.account as any).${this.toCamelCase(acc.name)}.fetch(address);`);
    this.emit('return account as unknown as ' + acc.name + ';');
    this.indent--;
    this.emit('} catch {');
    this.indent++;
    this.emit('return null;');
    this.indent--;
    this.emit('}');
    this.indent--;
    this.emit('}');
    this.emit('');

    // Fetch all
    this.emit(`async fetchAll${acc.name}s(): Promise<{ publicKey: PublicKey; account: ${acc.name} }[]> {`);
    this.indent++;
    this.emit(`const accounts = await (this.program.account as any).${this.toCamelCase(acc.name)}.all();`);
    this.emit(`return accounts.map((a: any) => ({ publicKey: a.publicKey, account: a.account as ${acc.name} }));`);
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitEventListener(): void {
    this.emit('addEventListener<T extends string>(');
    this.indent++;
    this.emit('eventName: T,');
    this.emit('callback: (event: any, slot: number) => void');
    this.indent--;
    this.emit('): number {');
    this.indent++;
    this.emit('return this.program.addEventListener(eventName, callback);');
    this.indent--;
    this.emit('}');
    this.emit('');

    this.emit('async removeEventListener(listenerId: number): Promise<void> {');
    this.indent++;
    this.emit('await this.program.removeEventListener(listenerId);');
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitPDAHelpers(): void {
    this.emit('async findPDA(seeds: (Buffer | Uint8Array)[], programId?: PublicKey): Promise<[PublicKey, number]> {');
    this.indent++;
    this.emit('return PublicKey.findProgramAddress(seeds, programId ?? this.program.programId);');
    this.indent--;
    this.emit('}');
    this.emit('');

    this.emit('async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {');
    this.indent++;
    this.emit('return getAssociatedTokenAddress(mint, owner);');
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  // =========================================================================
  // Event Types
  // =========================================================================

  private emitEventTypes(): void {
    if (this.events.length === 0) return;

    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('// Event Types');
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('');

    for (const event of this.events) {
      this.emit(`export interface ${event.name}Event {`);
      this.indent++;
      for (const field of event.fields) {
        this.emit(`${this.toCamelCase(field.name)}: ${this.emitTypeStr(field.type)};`);
      }
      this.indent--;
      this.emit('}');
      this.emit('');
    }
  }

  // =========================================================================
  // Error Types
  // =========================================================================

  private emitErrorTypes(): void {
    if (this.errors.length === 0) return;

    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('// Error Codes');
    this.emit('// ═══════════════════════════════════════════════════════');
    this.emit('');

    for (const err of this.errors) {
      this.emit(`export enum ${err.name}ErrorCode {`);
      this.indent++;
      for (const variant of err.variants) {
        this.emit(`${variant.name} = ${variant.code},`);
      }
      this.indent--;
      this.emit('}');
      this.emit('');

      this.emit(`export const ${err.name}Messages: Record<number, string> = {`);
      this.indent++;
      for (const variant of err.variants) {
        this.emit(`[${variant.code}]: "${variant.message}",`);
      }
      this.indent--;
      this.emit('};');
      this.emit('');

      // Error parser helper
      this.emit(`export function parse${err.name}Error(error: any): { code: number; message: string } | null {`);
      this.indent++;
      this.emit('if (error?.error?.errorCode?.number) {');
      this.indent++;
      this.emit(`const code = error.error.errorCode.number;`);
      this.emit(`const message = ${err.name}Messages[code] ?? 'Unknown error';`);
      this.emit('return { code, message };');
      this.indent--;
      this.emit('}');
      this.emit('return null;');
      this.indent--;
      this.emit('}');
      this.emit('');
    }
  }

  // =========================================================================
  // Type Mapping
  // =========================================================================

  emitTypeStr(type: AST.TypeAnnotation): string {
    switch (type.kind) {
      case 'PrimitiveType':
        return this.mapPrimitiveType(type.name);
      case 'NamedType': {
        const typeArgs = type.typeArgs && type.typeArgs.length > 0
          ? `<${type.typeArgs.map(a => this.emitTypeStr(a)).join(', ')}>`
          : '';
        return `${type.name}${typeArgs}`;
      }
      case 'ArrayType':
        return `${this.emitTypeStr(type.element)}[]`;
      case 'OptionType':
        return `${this.emitTypeStr(type.inner)} | null`;
      case 'ResultType': {
        const ok = this.emitTypeStr(type.ok);
        const err = type.err ? this.emitTypeStr(type.err) : 'Error';
        return `{ ok: ${ok} } | { err: ${err} }`;
      }
      case 'TupleType':
        return `[${type.elements.map(e => this.emitTypeStr(e)).join(', ')}]`;
      case 'FunctionType':
        return `(${type.params.map((p, i) => `arg${i}: ${this.emitTypeStr(p)}`).join(', ')}) => ${this.emitTypeStr(type.returnType)}`;
      case 'GenericType':
        return `${type.name}<${type.typeParams.map(p => this.emitTypeStr(p)).join(', ')}>`;
    }
  }

  private mapPrimitiveType(name: string): string {
    const map: Record<string, string> = {
      'u8': 'number',
      'u16': 'number',
      'u32': 'number',
      'u64': 'BN',
      'u128': 'BN',
      'i8': 'number',
      'i16': 'number',
      'i32': 'number',
      'i64': 'BN',
      'i128': 'BN',
      'f32': 'number',
      'f64': 'number',
      'bool': 'boolean',
      'string': 'string',
      'pubkey': 'PublicKey',
      'bytes': 'Buffer',
    };
    return map[name] ?? name;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private emit(line: string): void {
    const indentation = '  '.repeat(this.indent);
    this.output.push(`${indentation}${line}`);
  }

  private toCamelCase(name: string): string {
    return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  private toPascalCase(name: string): string {
    return name.split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }
}
