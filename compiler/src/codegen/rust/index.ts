// ============================================================================
// Purp Rust Code Generator v0.2.0 — The Solana Coding Language
// Generates Anchor-compatible Rust from Purp AST
// Complete with: generics, closures, assert/require, PDA seeds,
// full account constraints, CPI, SPL token ops, test blocks,
// bitwise ops, cast, patterns, destructuring, template strings
// ============================================================================

import * as AST from '../../ast/index.js';

export class RustCodegen {
  private output: string[] = [];
  private indent: number = 0;
  private programId: string = '"PURP1111111111111111111111111111111111111111"';
  private programName: string = '';
  private accounts: Map<string, AST.AccountDeclaration> = new Map();
  private events: Map<string, AST.EventDeclaration> = new Map();
  private errors: Map<string, AST.ErrorDeclaration> = new Map();
  private structs: Map<string, AST.StructDeclaration> = new Map();
  private enums: Map<string, AST.EnumDeclaration> = new Map();
  private pendingContextStructs: { name: string; accounts: AST.AccountParam[] }[] = [];

  generate(program: AST.ProgramNode): string {
    this.output = [];
    this.collectDeclarations(program.body);
    this.emitHeader();

    for (const node of program.body) {
      this.emitTopLevel(node);
    }

    return this.output.join('\n');
  }

  private collectDeclarations(nodes: AST.TopLevelNode[]): void {
    for (const node of nodes) {
      switch (node.kind) {
        case 'ProgramDeclaration':
          this.programName = node.name;
          if (node.id) this.programId = `"${node.id}"`;
          this.collectDeclarations(node.body);
          break;
        case 'AccountDeclaration':
          this.accounts.set(node.name, node);
          break;
        case 'EventDeclaration':
          this.events.set(node.name, node);
          break;
        case 'ErrorDeclaration':
          this.errors.set(node.name, node);
          break;
        case 'StructDeclaration':
          this.structs.set(node.name, node);
          break;
        case 'EnumDeclaration':
          this.enums.set(node.name, node);
          break;
      }
    }
  }

  private emitHeader(): void {
    this.emit('use anchor_lang::prelude::*;');
    this.emit('use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer as SplTransfer, MintTo, Burn, CloseAccount as SplCloseAccount};');
    this.emit('use anchor_spl::associated_token::AssociatedToken;');
    this.emit('');
    this.emit(`declare_id!(${this.programId});`);
    this.emit('');
  }

  private emitTopLevel(node: AST.TopLevelNode): void {
    switch (node.kind) {
      case 'ProgramDeclaration':
        this.emitProgramDeclaration(node);
        break;
      case 'StructDeclaration':
        this.emitStructDeclaration(node);
        break;
      case 'EnumDeclaration':
        this.emitEnumDeclaration(node);
        break;
      case 'FunctionDeclaration':
        this.emitFunctionDeclaration(node);
        break;
      case 'ConstDeclaration':
        this.emitConstDeclaration(node);
        break;
      case 'TypeAlias':
        this.emitTypeAlias(node);
        break;
      case 'ImplBlock':
        this.emitImplBlock(node);
        break;
      case 'TraitDeclaration':
        this.emitTraitDeclaration(node);
        break;
      case 'TestBlock':
        this.emitTestBlock(node);
        break;
      case 'ImportDeclaration':
        // Imports handled in header
        break;
      case 'ClientBlock':
        // Client blocks → TypeScript only (no Rust output)
        this.emit('// client{} block — see generated TypeScript SDK');
        this.emit('');
        break;
      case 'FrontendBlock':
        // Frontend blocks → TypeScript/React only (no Rust output)
        this.emit('// frontend{} block — see generated TypeScript/React output');
        this.emit('');
        break;
      case 'ConfigBlock':
        // Config blocks are used by the build system, not emitted in Rust
        break;
      case 'InstructionDeclaration':
        // Standalone instruction (outside program{}) — wrap in a program module
        this.emit('#[program]');
        this.emit(`pub mod purp_program {`);
        this.indent++;
        this.emit('use super::*;');
        this.emit('');
        this.emitInstruction(node);
        this.indent--;
        this.emit('}');
        this.emit('');
        this.emitPendingContextStructs();
        break;
      case 'AccountDeclaration':
        this.emitAccountDeclaration(node);
        break;
      case 'EventDeclaration':
        this.emitEventDeclaration(node);
        break;
      case 'ErrorDeclaration':
        this.emitErrorDeclaration(node);
        break;
    }
  }

  // =========================================================================
  // Program Declaration (Anchor #[program])
  // =========================================================================

  private emitProgramDeclaration(node: AST.ProgramDeclaration): void {
    this.emit('#[program]');
    this.emit(`pub mod ${this.toSnakeCase(node.name)} {`);
    this.indent++;
    this.emit('use super::*;');
    this.emit('');

    for (const child of node.body) {
      switch (child.kind) {
        case 'InstructionDeclaration':
          this.emitInstruction(child);
          break;
        case 'AccountDeclaration':
          // Accounts emitted outside #[program]
          break;
        case 'EventDeclaration':
          // Events emitted outside #[program]
          break;
        case 'ErrorDeclaration':
          // Errors emitted outside #[program]
          break;
        case 'FunctionDeclaration':
          this.emitFunctionDeclaration(child);
          break;
        case 'ClientBlock':
        case 'FrontendBlock':
        case 'ConfigBlock':
          // These blocks don't produce Rust output
          break;
      }
    }

    this.indent--;
    this.emit('}');
    this.emit('');

    // Emit all context structs (outside program module)
    this.emitPendingContextStructs();

    // Emit accounts, events, errors outside program module
    for (const child of node.body) {
      switch (child.kind) {
        case 'AccountDeclaration':
          this.emitAccountDeclaration(child);
          break;
        case 'StructDeclaration':
          this.emitStructDeclaration(child);
          break;
        case 'EnumDeclaration':
          this.emitEnumDeclaration(child);
          break;
        case 'EventDeclaration':
          this.emitEventDeclaration(child);
          break;
        case 'ErrorDeclaration':
          this.emitErrorDeclaration(child);
          break;
      }
    }
  }

  // =========================================================================
  // Instructions
  // =========================================================================

  private emitInstruction(node: AST.InstructionDeclaration): void {
    // Emit attributes
    for (const attr of node.attributes) {
      this.emit(`#[${attr.name}${attr.args.length > 0 ? `(${attr.args.map(a => this.emitExprStr(a)).join(', ')})` : ''}]`);
    }

    const ctxName = `${this.toPascalCase(node.name)}Context`;
    const params = node.params.map(p => `${this.toSnakeCase(p.name)}: ${this.emitTypeStr(p.type)}`);
    const paramStr = params.length > 0 ? `, ${params.join(', ')}` : '';
    const retType = node.returns ? ` -> ${this.emitTypeStr(node.returns)}` : '';

    this.emit(`pub fn ${this.toSnakeCase(node.name)}(ctx: Context<${ctxName}>${paramStr}) -> Result<()${retType ? retType.slice(4) : ''}> {`);
    this.indent++;

    this.emitStatements(node.body, node.accounts);

    this.emit('Ok(())');
    this.indent--;
    this.emit('}');
    this.emit('');

    // Collect context struct for emission after program module closes
    this.pendingContextStructs.push({ name: ctxName, accounts: node.accounts });
  }

  private emitPendingContextStructs(): void {
    for (const { name, accounts } of this.pendingContextStructs) {
      this.emit('#[derive(Accounts)]');
      this.emit(`pub struct ${name}<'info> {`);
      this.indent++;

      for (const acc of accounts) {
        this.emitAccountField(acc);
      }

      this.indent--;
      this.emit('}');
      this.emit('');
    }
    this.pendingContextStructs = [];
  }

  private emitAccountField(acc: AST.AccountParam): void {
    const constraints = this.buildAccountConstraints(acc);
    if (constraints.length > 0) {
      this.emit(`#[account(${constraints.join(', ')})]`);
    }

    const fieldType = this.accountTypeToRust(acc);
    this.emit(`pub ${this.toSnakeCase(acc.name)}: ${fieldType},`);
  }

  private buildAccountConstraints(acc: AST.AccountParam): string[] {
    const constraints: string[] = [];

    for (const c of acc.constraints) {
      switch (c.kind) {
        case 'init':
          constraints.push('init');
          break;
        case 'mut':
          constraints.push('mut');
          break;
        case 'payer':
          constraints.push(c.value ? `payer = ${this.emitExprStr(c.value)}` : 'payer');
          break;
        case 'space':
          constraints.push(c.value ? `space = ${this.emitExprStr(c.value)}` : 'space = 8 + 256');
          break;
        case 'has_one':
          constraints.push(c.value ? `has_one = ${this.emitExprStr(c.value)}` : 'has_one');
          break;
        case 'close':
          constraints.push(c.value ? `close = ${this.emitExprStr(c.value)}` : 'close');
          break;
        case 'seeds': {
          if (acc.accountType.kind === 'PDA' && acc.accountType.seeds.length > 0) {
            const seeds = acc.accountType.seeds.map(s => this.emitExprStr(s));
            constraints.push(`seeds = [${seeds.join(', ')}]`);
          }
          break;
        }
        case 'bump':
          constraints.push('bump');
          break;
        case 'constraint':
          if (c.value) constraints.push(`constraint = ${this.emitExprStr(c.value)}`);
          break;
      }
    }

    // Auto-add mut for mutable account types
    if (!constraints.includes('mut') && acc.accountType.kind !== 'Program' && acc.accountType.kind !== 'Signer') {
      if ('mutable' in acc.accountType && acc.accountType.mutable) {
        constraints.unshift('mut');
      }
    }

    return constraints;
  }

  private accountTypeToRust(acc: AST.AccountParam): string {
    switch (acc.accountType.kind) {
      case 'Signer':
        return acc.accountType.mutable ? "Signer<'info>" : "Signer<'info>";
      case 'Account':
        return `Account<'info, ${acc.accountType.type}>`;
      case 'TokenAccount':
        return "Account<'info, TokenAccount>";
      case 'Mint':
        return "Account<'info, Mint>";
      case 'PDA':
        return "AccountInfo<'info>";
      case 'Program':
        return acc.accountType.name === 'System' ? "Program<'info, System>" : `Program<'info, ${acc.accountType.name}>`;
      case 'SystemAccount':
        return "SystemAccount<'info>";
      default:
        return "AccountInfo<'info>";
    }
  }

  // =========================================================================
  // Account, Struct, Enum, Event, Error Declarations
  // =========================================================================

  private emitAccountDeclaration(node: AST.AccountDeclaration): void {
    for (const attr of node.attributes) {
      this.emit(`#[${attr.name}]`);
    }
    this.emit('#[account]');
    this.emit(`pub struct ${node.name} {`);
    this.indent++;
    for (const field of node.fields) {
      this.emit(`pub ${this.toSnakeCase(field.name)}: ${this.emitTypeStr(field.type)},`);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitStructDeclaration(node: AST.StructDeclaration): void {
    for (const attr of node.attributes) {
      this.emit(`#[${attr.name}]`);
    }
    this.emit('#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]');
    const generics = node.genericParams && node.genericParams.length > 0
      ? `<${node.genericParams.map(g => this.emitGenericParam(g)).join(', ')}>`
      : '';
    this.emit(`pub struct ${node.name}${generics} {`);
    this.indent++;
    for (const field of node.fields) {
      this.emit(`pub ${this.toSnakeCase(field.name)}: ${this.emitTypeStr(field.type)},`);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitEnumDeclaration(node: AST.EnumDeclaration): void {
    for (const attr of node.attributes) {
      this.emit(`#[${attr.name}]`);
    }
    this.emit('#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]');
    const generics = node.genericParams && node.genericParams.length > 0
      ? `<${node.genericParams.map(g => this.emitGenericParam(g)).join(', ')}>`
      : '';
    this.emit(`pub enum ${node.name}${generics} {`);
    this.indent++;
    for (const variant of node.variants) {
      if (variant.fields && variant.fields.length > 0) {
        this.emit(`${variant.name} {`);
        this.indent++;
        for (const f of variant.fields) {
          this.emit(`${this.toSnakeCase(f.name)}: ${this.emitTypeStr(f.type)},`);
        }
        this.indent--;
        this.emit('},');
      } else {
        this.emit(`${variant.name},`);
      }
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitEventDeclaration(node: AST.EventDeclaration): void {
    this.emit('#[event]');
    this.emit(`pub struct ${node.name} {`);
    this.indent++;
    for (const field of node.fields) {
      this.emit(`pub ${this.toSnakeCase(field.name)}: ${this.emitTypeStr(field.type)},`);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitErrorDeclaration(node: AST.ErrorDeclaration): void {
    this.emit('#[error_code]');
    this.emit(`pub enum ${node.name} {`);
    this.indent++;
    for (const variant of node.variants) {
      this.emit(`#[msg("${variant.message}")]`);
      this.emit(`${variant.name},`);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  // =========================================================================
  // Function, Const, Type, Impl, Trait, Test
  // =========================================================================

  private emitFunctionDeclaration(node: AST.FunctionDeclaration): void {
    for (const attr of node.attributes) {
      this.emit(`#[${attr.name}]`);
    }
    const vis = node.visibility === 'pub' ? 'pub ' : '';
    const asyncStr = node.isAsync ? 'async ' : '';
    const generics = node.genericParams && node.genericParams.length > 0
      ? `<${node.genericParams.map(g => this.emitGenericParam(g)).join(', ')}>`
      : '';
    const params = node.params.map(p => `${this.toSnakeCase(p.name)}: ${this.emitTypeStr(p.type)}`);
    const retType = node.returnType ? ` -> ${this.emitTypeStr(node.returnType)}` : '';

    this.emit(`${vis}${asyncStr}fn ${this.toSnakeCase(node.name)}${generics}(${params.join(', ')})${retType} {`);
    this.indent++;
    this.emitStatements(node.body);
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitConstDeclaration(node: AST.ConstDeclaration): void {
    const vis = node.visibility === 'pub' ? 'pub ' : '';
    const typeStr = node.type ? `: ${this.emitTypeStr(node.type)}` : '';
    this.emit(`${vis}const ${node.name.toUpperCase()}${typeStr} = ${this.emitExprStr(node.value)};`);
    this.emit('');
  }

  private emitTypeAlias(node: AST.TypeAlias): void {
    const generics = node.genericParams && node.genericParams.length > 0
      ? `<${node.genericParams.map(g => this.emitGenericParam(g)).join(', ')}>`
      : '';
    this.emit(`pub type ${node.name}${generics} = ${this.emitTypeStr(node.type)};`);
    this.emit('');
  }

  private emitImplBlock(node: AST.ImplBlock): void {
    const generics = node.genericParams && node.genericParams.length > 0
      ? `<${node.genericParams.map(g => this.emitGenericParam(g)).join(', ')}>`
      : '';
    const trait = node.trait ? `${node.trait} for ` : '';
    this.emit(`impl${generics} ${trait}${node.target} {`);
    this.indent++;
    for (const method of node.methods) {
      this.emitFunctionDeclaration(method);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitTraitDeclaration(node: AST.TraitDeclaration): void {
    const generics = node.genericParams && node.genericParams.length > 0
      ? `<${node.genericParams.map(g => this.emitGenericParam(g)).join(', ')}>`
      : '';
    this.emit(`pub trait ${node.name}${generics} {`);
    this.indent++;
    for (const method of node.methods) {
      const params = method.params.map(p => `${this.toSnakeCase(p.name)}: ${this.emitTypeStr(p.type)}`);
      const retType = method.returnType ? ` -> ${this.emitTypeStr(method.returnType)}` : '';
      this.emit(`fn ${this.toSnakeCase(method.name)}(${params.join(', ')})${retType};`);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitTestBlock(node: AST.TestBlock): void {
    this.emit('#[cfg(test)]');
    this.emit('mod tests {');
    this.indent++;
    this.emit('use super::*;');
    this.emit('');
    const asyncStr = node.isAsync ? 'async ' : '';
    const testName = this.toSnakeCase(node.name.replace(/[^a-zA-Z0-9_]/g, '_'));
    this.emit('#[test]');
    this.emit(`${asyncStr}fn ${testName}() {`);
    this.indent++;
    this.emitStatements(node.body);
    this.indent--;
    this.emit('}');
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  // =========================================================================
  // Statements
  // =========================================================================

  private emitStatements(stmts: AST.Statement[], accounts?: AST.AccountParam[]): void {
    for (const stmt of stmts) {
      this.emitStatement(stmt, accounts);
    }
  }

  private emitStatement(stmt: AST.Statement, accounts?: AST.AccountParam[]): void {
    switch (stmt.kind) {
      case 'LetStatement': {
        const mutStr = stmt.mutable ? 'mut ' : '';
        const typeStr = stmt.type ? `: ${this.emitTypeStr(stmt.type)}` : '';
        const valueStr = stmt.value ? ` = ${this.emitExprStr(stmt.value)}` : '';
        this.emit(`let ${mutStr}${this.toSnakeCase(stmt.name)}${typeStr}${valueStr};`);
        break;
      }
      case 'ConstStatement': {
        const typeStr = stmt.type ? `: ${this.emitTypeStr(stmt.type)}` : '';
        this.emit(`let ${this.toSnakeCase(stmt.name)}${typeStr} = ${this.emitExprStr(stmt.value)};`);
        break;
      }
      case 'AssignmentStatement': {
        const target = this.emitExprStr(stmt.target, accounts);
        this.emit(`${target} ${stmt.operator} ${this.emitExprStr(stmt.value)};`);
        break;
      }
      case 'ExpressionStatement':
        this.emit(`${this.emitExprStr(stmt.expression)};`);
        break;
      case 'ReturnStatement':
        if (stmt.value) {
          this.emit(`return ${this.emitExprStr(stmt.value)};`);
        } else {
          this.emit('return;');
        }
        break;
      case 'IfStatement':
        this.emitIf(stmt);
        break;
      case 'ForStatement':
        this.emit(`for ${this.toSnakeCase(stmt.variable)} in ${this.emitExprStr(stmt.iterable)} {`);
        this.indent++;
        this.emitStatements(stmt.body);
        this.indent--;
        this.emit('}');
        break;
      case 'WhileStatement':
        this.emit(`while ${this.emitExprStr(stmt.condition)} {`);
        this.indent++;
        this.emitStatements(stmt.body);
        this.indent--;
        this.emit('}');
        break;
      case 'LoopStatement':
        this.emit('loop {');
        this.indent++;
        this.emitStatements(stmt.body);
        this.indent--;
        this.emit('}');
        break;
      case 'MatchStatement':
        this.emitMatch(stmt);
        break;
      case 'BreakStatement':
        this.emit('break;');
        break;
      case 'ContinueStatement':
        this.emit('continue;');
        break;
      case 'EmitStatement':
        this.emit(`emit!(${stmt.event} {`);
        this.indent++;
        for (let i = 0; i < stmt.args.length; i++) {
          this.emit(`${this.emitExprStr(stmt.args[i])},`);
        }
        this.indent--;
        this.emit('});');
        break;
      case 'CPICall':
        this.emitCPICall(stmt);
        break;
      case 'SPLOperation':
        this.emitSPLOperation(stmt);
        break;
      case 'AssertStatement':
        if (stmt.message) {
          this.emit(`require!(${this.emitExprStr(stmt.condition)}, ProgramError::Custom(0)); // ${this.emitExprStr(stmt.message)}`);
        } else {
          this.emit(`require!(${this.emitExprStr(stmt.condition)}, ProgramError::Custom(0));`);
        }
        break;
      case 'RequireStatement': {
        const errCode = stmt.errorCode ? this.emitExprStr(stmt.errorCode) : 'ProgramError::Custom(0)';
        this.emit(`require!(${this.emitExprStr(stmt.condition)}, ${errCode});`);
        break;
      }
      case 'TryStatement':
        this.emitTryStatement(stmt);
        break;
      case 'ThrowStatement':
        this.emit(`return Err(${this.emitExprStr(stmt.value)}.into());`);
        break;
      case 'DestructureStatement':
        this.emitDestructure(stmt);
        break;
      case 'BlockStatement':
        this.emit('{');
        this.indent++;
        this.emitStatements(stmt.body);
        this.indent--;
        this.emit('}');
        break;
    }
  }

  private emitIf(node: AST.IfStatement): void {
    this.emit(`if ${this.emitExprStr(node.condition)} {`);
    this.indent++;
    this.emitStatements(node.then);
    this.indent--;
    if (node.elseIf) {
      for (const ei of node.elseIf) {
        this.emit(`} else if ${this.emitExprStr(ei.condition)} {`);
        this.indent++;
        this.emitStatements(ei.body);
        this.indent--;
      }
    }
    if (node.else && node.else.length > 0) {
      this.emit('} else {');
      this.indent++;
      this.emitStatements(node.else);
      this.indent--;
    }
    this.emit('}');
  }

  private emitMatch(node: AST.MatchStatement): void {
    this.emit(`match ${this.emitExprStr(node.subject)} {`);
    this.indent++;
    for (const arm of node.arms) {
      const pattern = this.emitPatternStr(arm.pattern);
      const guard = arm.guard ? ` if ${this.emitExprStr(arm.guard)}` : '';
      if (arm.body.length === 1) {
        this.emit(`${pattern}${guard} => {`);
        this.indent++;
        this.emitStatements(arm.body);
        this.indent--;
        this.emit('}');
      } else {
        this.emit(`${pattern}${guard} => {`);
        this.indent++;
        this.emitStatements(arm.body);
        this.indent--;
        this.emit('}');
      }
    }
    this.indent--;
    this.emit('}');
  }

  private emitTryStatement(node: AST.TryStatement): void {
    // Rust doesn't have try/catch, emit as match on Result
    this.emit('match (|| -> Result<()> {');
    this.indent++;
    this.emitStatements(node.body);
    this.emit('Ok(())');
    this.indent--;
    this.emit('})() {');
    this.indent++;
    this.emit('Ok(_) => {},');
    const catchVar = node.catchParam ?? '_e';
    this.emit(`Err(${catchVar}) => {`);
    this.indent++;
    this.emitStatements(node.catchBody);
    this.indent--;
    this.emit('}');
    this.indent--;
    this.emit('}');
  }

  private emitDestructure(node: AST.DestructureStatement): void {
    const mutStr = node.mutable ? 'mut ' : '';
    switch (node.pattern.kind) {
      case 'ObjectDestructure': {
        const fields = node.pattern.fields.map(f =>
          f.alias ? `${this.toSnakeCase(f.name)}: ${mutStr}${this.toSnakeCase(f.alias)}` : `${mutStr}${this.toSnakeCase(f.name)}`
        );
        const rest = node.pattern.rest ? `, ..` : '';
        this.emit(`let ${this.toPascalCase(this.inferStructName(node.value))} { ${fields.join(', ')}${rest} } = ${this.emitExprStr(node.value)};`);
        break;
      }
      case 'ArrayDestructure': {
        const elems = node.pattern.elements.map(e => e ? `${mutStr}${this.toSnakeCase(e)}` : '_');
        this.emit(`let [${elems.join(', ')}] = ${this.emitExprStr(node.value)};`);
        break;
      }
      case 'TupleDestructure': {
        const elems = node.pattern.elements.map(e => `${mutStr}${this.toSnakeCase(e)}`);
        this.emit(`let (${elems.join(', ')}) = ${this.emitExprStr(node.value)};`);
        break;
      }
    }
  }

  private emitCPICall(node: AST.CPICall): void {
    this.emit(`// CPI: ${node.program}::${node.instruction}`);
    const accountsList = node.accounts.map(a => this.emitExprStr(a)).join(', ');
    const argsList = node.args.map(a => this.emitExprStr(a)).join(', ');

    if (node.seeds && node.seeds.length > 0) {
      const seeds = node.seeds.map(s => this.emitExprStr(s)).join(', ');
      this.emit(`let seeds = &[${seeds}];`);
      this.emit(`let signer_seeds = &[&seeds[..]];`);
      this.emit(`let cpi_accounts = ${this.toPascalCase(node.instruction)} {`);
      this.indent++;
      this.emit(`${accountsList}`);
      this.indent--;
      this.emit('};');
      this.emit(`let cpi_ctx = CpiContext::new_with_signer(`);
      this.indent++;
      this.emit(`ctx.accounts.${this.toSnakeCase(node.program)}.to_account_info(),`);
      this.emit('cpi_accounts,');
      this.emit('signer_seeds,');
      this.indent--;
      this.emit(');');
      this.emit(`${this.toSnakeCase(node.program)}::${this.toSnakeCase(node.instruction)}(cpi_ctx${argsList ? ', ' + argsList : ''})?;`);
    } else {
      this.emit(`let cpi_accounts = ${this.toPascalCase(node.instruction)} {`);
      this.indent++;
      this.emit(`${accountsList}`);
      this.indent--;
      this.emit('};');
      this.emit(`let cpi_ctx = CpiContext::new(`);
      this.indent++;
      this.emit(`ctx.accounts.${this.toSnakeCase(node.program)}.to_account_info(),`);
      this.emit('cpi_accounts,');
      this.indent--;
      this.emit(');');
      this.emit(`${this.toSnakeCase(node.program)}::${this.toSnakeCase(node.instruction)}(cpi_ctx${argsList ? ', ' + argsList : ''})?;`);
    }
  }

  private emitSPLOperation(node: AST.SPLOperation): void {
    const getArg = (name: string): string => {
      const arg = node.args.find(a => a.name === name);
      return arg ? this.emitExprStr(arg.value) : name;
    };

    switch (node.operation) {
      case 'transfer': {
        this.emit('let cpi_accounts = SplTransfer {');
        this.indent++;
        this.emit(`from: ${getArg('from')}.to_account_info(),`);
        this.emit(`to: ${getArg('to')}.to_account_info(),`);
        this.emit(`authority: ${getArg('authority')}.to_account_info(),`);
        this.indent--;
        this.emit('};');
        this.emit('let cpi_ctx = CpiContext::new(');
        this.indent++;
        this.emit('ctx.accounts.token_program.to_account_info(),');
        this.emit('cpi_accounts,');
        this.indent--;
        this.emit(');');
        this.emit(`token::transfer(cpi_ctx, ${getArg('amount')})?;`);
        break;
      }
      case 'mint_to': {
        this.emit('let cpi_accounts = MintTo {');
        this.indent++;
        this.emit(`mint: ${getArg('mint')}.to_account_info(),`);
        this.emit(`to: ${getArg('to')}.to_account_info(),`);
        this.emit(`authority: ${getArg('authority')}.to_account_info(),`);
        this.indent--;
        this.emit('};');
        this.emit('let cpi_ctx = CpiContext::new(');
        this.indent++;
        this.emit('ctx.accounts.token_program.to_account_info(),');
        this.emit('cpi_accounts,');
        this.indent--;
        this.emit(');');
        this.emit(`token::mint_to(cpi_ctx, ${getArg('amount')})?;`);
        break;
      }
      case 'burn': {
        this.emit('let cpi_accounts = Burn {');
        this.indent++;
        this.emit(`mint: ${getArg('mint')}.to_account_info(),`);
        this.emit(`from: ${getArg('from')}.to_account_info(),`);
        this.emit(`authority: ${getArg('authority')}.to_account_info(),`);
        this.indent--;
        this.emit('};');
        this.emit('let cpi_ctx = CpiContext::new(');
        this.indent++;
        this.emit('ctx.accounts.token_program.to_account_info(),');
        this.emit('cpi_accounts,');
        this.indent--;
        this.emit(');');
        this.emit(`token::burn(cpi_ctx, ${getArg('amount')})?;`);
        break;
      }
      case 'close_account': {
        this.emit('let cpi_accounts = SplCloseAccount {');
        this.indent++;
        this.emit(`account: ${getArg('account')}.to_account_info(),`);
        this.emit(`destination: ${getArg('destination')}.to_account_info(),`);
        this.emit(`authority: ${getArg('authority')}.to_account_info(),`);
        this.indent--;
        this.emit('};');
        this.emit('let cpi_ctx = CpiContext::new(');
        this.indent++;
        this.emit('ctx.accounts.token_program.to_account_info(),');
        this.emit('cpi_accounts,');
        this.indent--;
        this.emit(');');
        this.emit('token::close_account(cpi_ctx)?;');
        break;
      }
    }
  }

  // =========================================================================
  // Expressions
  // =========================================================================

  emitExprStr(expr: AST.Expression, accounts?: AST.AccountParam[]): string {
    switch (expr.kind) {
      case 'NumberLiteral':
        return expr.raw;
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'TemplateStringLiteral':
        return this.emitTemplateString(expr);
      case 'BooleanLiteral':
        return expr.value ? 'true' : 'false';
      case 'PubkeyLiteral':
        return `Pubkey::from_str("${expr.value}").unwrap()`;
      case 'NullLiteral':
        return 'None';
      case 'IdentifierExpr': {
        // Check if it's an account reference in instruction context
        if (accounts) {
          const acc = accounts.find(a => a.name === expr.name);
          if (acc) return `ctx.accounts.${this.toSnakeCase(expr.name)}`;
        }
        return this.toSnakeCase(expr.name);
      }
      case 'BinaryExpr':
        return this.emitBinaryExpr(expr);
      case 'UnaryExpr':
        return `${expr.operator}${this.emitExprStr(expr.operand)}`;
      case 'CallExpr':
        return this.emitCallExpr(expr);
      case 'MemberExpr':
        return this.emitMemberExpr(expr, accounts);
      case 'OptionalChainExpr':
        return `${this.emitExprStr(expr.object)}.as_ref().map(|v| v.${this.toSnakeCase(expr.property)})`;
      case 'IndexExpr':
        return `${this.emitExprStr(expr.object)}[${this.emitExprStr(expr.index)}]`;
      case 'ArrayExpr':
        return `vec![${expr.elements.map(e => this.emitExprStr(e)).join(', ')}]`;
      case 'ObjectExpr':
        return `{ ${expr.properties.map(p => `${this.toSnakeCase(p.key)}: ${this.emitExprStr(p.value)}`).join(', ')} }`;
      case 'TupleExpr':
        return `(${expr.elements.map(e => this.emitExprStr(e)).join(', ')})`;
      case 'LambdaExpr':
        return this.emitLambda(expr);
      case 'AwaitExpr':
        return `${this.emitExprStr(expr.expression)}.await`;
      case 'TernaryExpr':
        return `if ${this.emitExprStr(expr.condition)} { ${this.emitExprStr(expr.consequent)} } else { ${this.emitExprStr(expr.alternate)} }`;
      case 'StructInitExpr':
        return this.emitStructInit(expr);
      case 'RangeExpr':
        return expr.inclusive
          ? `${this.emitExprStr(expr.start)}..=${this.emitExprStr(expr.end)}`
          : `${this.emitExprStr(expr.start)}..${this.emitExprStr(expr.end)}`;
      case 'CastExpr':
        return `${this.emitExprStr(expr.expression)} as ${this.emitTypeStr(expr.targetType)}`;
      case 'TryExpr':
        return `${this.emitExprStr(expr.expression)}?`;
      case 'SolLiteral':
        return `${expr.amount} * anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL`;
      case 'LamportsLiteral':
        return `${expr.amount}`;
      default:
        return '/* unsupported expression */';
    }
  }

  private emitBinaryExpr(expr: AST.BinaryExpr): string {
    const left = this.emitExprStr(expr.left);
    const right = this.emitExprStr(expr.right);
    // All operators including bitwise work the same in Rust
    return `(${left} ${expr.operator} ${right})`;
  }

  private emitCallExpr(expr: AST.CallExpr): string {
    const args = expr.args.map(a => this.emitExprStr(a)).join(', ');
    if (expr.callee.kind === 'MemberExpr') {
      const obj = this.emitExprStr(expr.callee.object);
      const method = this.toSnakeCase(expr.callee.property);
      // Map common iterator methods
      switch (method) {
        case 'map': return `${obj}.iter().map(${args}).collect::<Vec<_>>()`;
        case 'filter': return `${obj}.iter().filter(${args}).collect::<Vec<_>>()`;
        case 'find': return `${obj}.iter().find(${args})`;
        case 'reduce': return `${obj}.iter().fold(${args})`;
        case 'for_each': return `${obj}.iter().for_each(${args})`;
        case 'some': return `${obj}.iter().any(${args})`;
        case 'every': return `${obj}.iter().all(${args})`;
        case 'flat_map': return `${obj}.iter().flat_map(${args}).collect::<Vec<_>>()`;
        case 'len': case 'length': return `${obj}.len()`;
        case 'push': return `${obj}.push(${args})`;
        case 'pop': return `${obj}.pop()`;
        case 'contains': return `${obj}.contains(&${args})`;
        case 'to_string': return `${obj}.to_string()`;
        case 'key': return `${obj}.key()`;
        default: return `${obj}.${method}(${args})`;
      }
    }
    const callee = this.emitExprStr(expr.callee);

    // Built-in function mappings
    switch (callee) {
      case 'msg': return `msg!(${args})`;
      case 'print': case 'log': return `msg!(${args})`;
      default: return `${callee}(${args})`;
    }
  }

  private emitMemberExpr(expr: AST.MemberExpr, accounts?: AST.AccountParam[]): string {
    const obj = this.emitExprStr(expr.object, accounts);
    const prop = this.toSnakeCase(expr.property);
    return `${obj}.${prop}`;
  }

  private emitLambda(expr: AST.LambdaExpr): string {
    const params = expr.params.map(p => {
      const typeStr = p.type.kind !== 'PrimitiveType' || p.type.name !== 'unknown' as any
        ? `: ${this.emitTypeStr(p.type)}`
        : '';
      return `${this.toSnakeCase(p.name)}${typeStr}`;
    });
    if (Array.isArray(expr.body)) {
      return `|${params.join(', ')}| { ${expr.body.map(s => this.emitStmtStr(s)).join(' ')} }`;
    }
    return `|${params.join(', ')}| ${this.emitExprStr(expr.body)}`;
  }

  private emitStructInit(expr: AST.StructInitExpr): string {
    const fields = expr.fields.map(f => `${this.toSnakeCase(f.name)}: ${this.emitExprStr(f.value)}`);
    return `${expr.name} { ${fields.join(', ')} }`;
  }

  private emitTemplateString(expr: AST.TemplateStringLiteral): string {
    // Convert to Rust format! macro
    let formatStr = '';
    const args: string[] = [];
    for (const part of expr.parts) {
      if (typeof part === 'string') {
        formatStr += part;
      } else {
        formatStr += '{}';
        args.push(this.emitExprStr(part));
      }
    }
    if (args.length === 0) return `"${formatStr}".to_string()`;
    return `format!("${formatStr}", ${args.join(', ')})`;
  }

  // =========================================================================
  // Patterns
  // =========================================================================

  private emitPatternStr(pattern: AST.Pattern): string {
    switch (pattern.kind) {
      case 'LiteralPattern':
        return this.emitExprStr(pattern.value);
      case 'IdentifierPattern':
        return this.toSnakeCase(pattern.name);
      case 'WildcardPattern':
        return '_';
      case 'StructPattern': {
        const fields = pattern.fields.map(f => `${this.toSnakeCase(f.name)}: ${this.emitPatternStr(f.pattern)}`);
        const rest = pattern.rest ? ', ..' : '';
        return `${pattern.name} { ${fields.join(', ')}${rest} }`;
      }
      case 'EnumPattern': {
        const variant = `${pattern.enumName}::${pattern.variant}`;
        if (pattern.fields && pattern.fields.length > 0) {
          return `${variant}(${pattern.fields.map(f => this.emitPatternStr(f)).join(', ')})`;
        }
        return variant;
      }
      case 'TuplePattern':
        return `(${pattern.elements.map(e => this.emitPatternStr(e)).join(', ')})`;
      case 'ArrayPattern': {
        const elems = pattern.elements.map(e => this.emitPatternStr(e));
        return `[${elems.join(', ')}]`;
      }
      case 'RangePattern':
        return pattern.inclusive
          ? `${this.emitExprStr(pattern.start)}..=${this.emitExprStr(pattern.end)}`
          : `${this.emitExprStr(pattern.start)}..${this.emitExprStr(pattern.end)}`;
      case 'OrPattern':
        return pattern.patterns.map(p => this.emitPatternStr(p)).join(' | ');
    }
  }

  // =========================================================================
  // Types
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
        return type.size !== undefined
          ? `[${this.emitTypeStr(type.element)}; ${type.size}]`
          : `Vec<${this.emitTypeStr(type.element)}>`;
      case 'OptionType':
        return `Option<${this.emitTypeStr(type.inner)}>`;
      case 'ResultType':
        return type.err
          ? `Result<${this.emitTypeStr(type.ok)}, ${this.emitTypeStr(type.err)}>`
          : `Result<${this.emitTypeStr(type.ok)}>`;
      case 'TupleType':
        return `(${type.elements.map(e => this.emitTypeStr(e)).join(', ')})`;
      case 'FunctionType':
        return `fn(${type.params.map(p => this.emitTypeStr(p)).join(', ')}) -> ${this.emitTypeStr(type.returnType)}`;
      case 'GenericType':
        return `${type.name}<${type.typeParams.map(p => this.emitTypeStr(p)).join(', ')}>`;
    }
  }

  private mapPrimitiveType(name: string): string {
    const map: Record<string, string> = {
      'u8': 'u8', 'u16': 'u16', 'u32': 'u32', 'u64': 'u64', 'u128': 'u128',
      'i8': 'i8', 'i16': 'i16', 'i32': 'i32', 'i64': 'i64', 'i128': 'i128',
      'f32': 'f32', 'f64': 'f64',
      'bool': 'bool',
      'string': 'String',
      'pubkey': 'Pubkey',
      'bytes': 'Vec<u8>',
    };
    return map[name] ?? name;
  }

  private emitGenericParam(g: AST.GenericParam): string {
    let result = g.name;
    if (g.constraint) result += `: ${this.emitTypeStr(g.constraint)}`;
    if (g.default) result += ` = ${this.emitTypeStr(g.default)}`;
    return result;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private emitStmtStr(stmt: AST.Statement): string {
    const prev = this.output;
    const prevIndent = this.indent;
    this.output = [];
    this.indent = 0;
    this.emitStatement(stmt);
    const result = this.output.join(' ');
    this.output = prev;
    this.indent = prevIndent;
    return result;
  }

  private inferStructName(expr: AST.Expression): string {
    if (expr.kind === 'IdentifierExpr') return expr.name;
    if (expr.kind === 'CallExpr' && expr.callee.kind === 'IdentifierExpr') return expr.callee.name;
    return 'Unknown';
  }

  private emit(line: string): void {
    const indentation = '    '.repeat(this.indent);
    this.output.push(`${indentation}${line}`);
  }

  private toSnakeCase(name: string): string {
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/__/g, '_');
  }

  private toPascalCase(name: string): string {
    return name.split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }
}
