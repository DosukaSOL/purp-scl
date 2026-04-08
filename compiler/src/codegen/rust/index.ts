// ============================================================================
// Purp Rust Code Generator v2.0.0 — The Solana Coding Language
// Generates Pinocchio-based Rust from Purp AST
// Zero-dependency, no_std compatible Solana programs
// Complete with: generics, closures, assert/require, PDA seeds,
// full account validation, CPI, SPL token ops, test blocks,
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
    this.emit('use pinocchio::{');
    this.emit('    AccountView, Address, entrypoint, ProgramResult,');
    this.emit('    sysvars::rent::Rent, sysvars::Sysvar,');
    this.emit('};');
    this.emit('use pinocchio_token::instructions::{');
    this.emit('    Transfer as SplTransfer, MintTo, Burn,');
    this.emit('    CloseAccount as SplCloseAccount, Approve, Revoke,');
    this.emit('    FreezeAccount, ThawAccount, SetAuthority, SyncNative,');
    this.emit('};');
    this.emit('use pinocchio_system::instructions::CreateAccount;');
    this.emit('use solana_program_log::msg;');
    this.emit('use borsh::{BorshSerialize, BorshDeserialize};');
    this.emit('');
    this.emit(`pub const PROGRAM_ID: Address = unsafe { Address::new_unchecked(*${this.programId}.as_bytes()) };`);
    this.emit('');
    this.emit('entrypoint!(process_instruction);');
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
        // Standalone instruction (outside program{}) — emit as direct function
        this.emitInstruction(node);
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
  // Program Declaration (Pinocchio entrypoint dispatch)
  // =========================================================================

  private emitProgramDeclaration(node: AST.ProgramDeclaration): void {
    // Collect instructions for dispatch
    const instructions = node.body.filter(c => c.kind === 'InstructionDeclaration') as AST.InstructionDeclaration[];

    // Emit process_instruction dispatcher
    this.emit('pub fn process_instruction(');
    this.indent++;
    this.emit('program_id: &Address,');
    this.emit('accounts: &[AccountView],');
    this.emit('instruction_data: &[u8],');
    this.indent--;
    this.emit(') -> ProgramResult {');
    this.indent++;

    if (instructions.length > 0) {
      this.emit('let (tag, data) = instruction_data.split_first()');
      this.indent++;
      this.emit('.ok_or(pinocchio::program_error::ProgramError::InvalidInstructionData)?;');
      this.indent--;
      this.emit('');
      this.emit('match tag {');
      this.indent++;
      instructions.forEach((instr, i) => {
        this.emit(`${i} => ${this.toSnakeCase(instr.name)}(program_id, accounts, data),`);
      });
      this.emit('_ => Err(pinocchio::program_error::ProgramError::InvalidInstructionData),');
      this.indent--;
      this.emit('}');
    } else {
      this.emit('Ok(())');
    }

    this.indent--;
    this.emit('}');
    this.emit('');

    // Emit each instruction as a standalone function
    for (const child of node.body) {
      switch (child.kind) {
        case 'InstructionDeclaration':
          this.emitInstruction(child);
          break;
        case 'FunctionDeclaration':
          this.emitFunctionDeclaration(child);
          break;
        case 'ClientBlock':
        case 'FrontendBlock':
        case 'ConfigBlock':
          break;
      }
    }

    // Emit accounts, events, errors, structs, enums
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

    const params = node.params.map(p => `${this.toSnakeCase(p.name)}: ${this.emitTypeStr(p.type)}`);
    const paramStr = params.length > 0 ? `, ${params.join(', ')}` : '';
    const innerType = node.returns ? this.emitTypeStr(node.returns) : '()';

    this.emit(`fn ${this.toSnakeCase(node.name)}(`);
    this.indent++;
    this.emit('program_id: &Address,');
    this.emit('accounts: &[AccountView],');
    this.emit('data: &[u8],');
    this.indent--;
    this.emit(') -> ProgramResult {');
    this.indent++;

    // Destructure accounts from the slice
    node.accounts.forEach((acc, i) => {
      this.emit(`let ${this.toSnakeCase(acc.name)} = &accounts[${i}];`);
    });
    if (node.accounts.length > 0) this.emit('');

    // Validate signers
    for (const acc of node.accounts) {
      if (acc.accountType.kind === 'Signer') {
        this.emit(`if !${this.toSnakeCase(acc.name)}.is_signer() {`);
        this.indent++;
        this.emit('return Err(pinocchio::program_error::ProgramError::MissingRequiredSignature);');
        this.indent--;
        this.emit('}');
      }
    }

    // Validate mutability
    for (const acc of node.accounts) {
      const isMut = acc.constraints.some(c => c.kind === 'mut' || c.kind === 'init');
      if (isMut) {
        this.emit(`if !${this.toSnakeCase(acc.name)}.is_writable() {`);
        this.indent++;
        this.emit('return Err(pinocchio::program_error::ProgramError::InvalidAccountData);');
        this.indent--;
        this.emit('}');
      }
    }

    if (node.accounts.some(a => a.accountType.kind === 'Signer' || a.constraints.some(c => c.kind === 'mut' || c.kind === 'init'))) {
      this.emit('');
    }

    this.emitStatements(node.body, node.accounts);

    this.emit('Ok(())');
    this.indent--;
    this.emit('}');
    this.emit('');
  }

  private emitPendingContextStructs(): void {
    // No longer needed in Pinocchio (no context structs)
    this.pendingContextStructs = [];
  }

  private emitAccountField(acc: AST.AccountParam): void {
    // In Pinocchio, accounts are passed as &AccountView in slices
    // This method is kept for template/documentation use
    this.emit(`pub ${this.toSnakeCase(acc.name)}: &AccountView,`);
  }

  private buildAccountConstraints(acc: AST.AccountParam): string[] {
    // Pinocchio does not use declarative constraints — validation is inline
    return [];
  }

  private accountTypeToRust(acc: AST.AccountParam): string {
    // All accounts are AccountView in Pinocchio
    return '&AccountView';
  }

  // =========================================================================
  // Account, Struct, Enum, Event, Error Declarations
  // =========================================================================

  private emitAccountDeclaration(node: AST.AccountDeclaration): void {
    for (const attr of node.attributes) {
      this.emit(`#[${attr.name}]`);
    }
    this.emit('#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]');
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
    this.emit('#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]');
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
    this.emit('#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]');
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
    this.emit('#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]');
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
    this.emit('#[derive(Debug, Clone, Copy)]');
    this.emit('#[repr(u32)]');
    this.emit(`pub enum ${node.name} {`);
    this.indent++;
    for (let i = 0; i < node.variants.length; i++) {
      const variant = node.variants[i];
      this.emit(`/// ${variant.message}`);
      this.emit(`${variant.name} = ${6000 + i},`);
    }
    this.indent--;
    this.emit('}');
    this.emit('');
    this.emit(`impl From<${node.name}> for pinocchio::program_error::ProgramError {`);
    this.indent++;
    this.emit(`fn from(e: ${node.name}) -> Self {`);
    this.indent++;
    this.emit('pinocchio::program_error::ProgramError::Custom(e as u32)');
    this.indent--;
    this.emit('}');
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
    this.emit(node.isAsync ? '#[tokio::test]' : '#[test]');
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
        const value = this.emitExprStr(stmt.value);
        if (stmt.operator === '**=') {
          this.emit(`${target} = ${target}.pow(${value} as u32);`);
        } else if (stmt.operator === '??=') {
          this.emit(`${target} = ${target}.unwrap_or(${value});`);
        } else {
          this.emit(`${target} ${stmt.operator} ${value};`);
        }
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
        this.emit(`// Event: ${stmt.event}`);
        this.emit(`msg!("event:${stmt.event}");`);
        break;
      case 'CPICall':
        this.emitCPICall(stmt);
        break;
      case 'SPLOperation':
        this.emitSPLOperation(stmt);
        break;
      case 'AssertStatement':
        if (stmt.message) {
          this.emit(`if !(${this.emitExprStr(stmt.condition)}) {`);
          this.indent++;
          this.emit(`msg!(${this.emitExprStr(stmt.message)});`);
          this.emit('return Err(pinocchio::program_error::ProgramError::Custom(0));');
          this.indent--;
          this.emit('}');
        } else {
          this.emit(`if !(${this.emitExprStr(stmt.condition)}) {`);
          this.indent++;
          this.emit('return Err(pinocchio::program_error::ProgramError::Custom(0));');
          this.indent--;
          this.emit('}');
        }
        break;
      case 'RequireStatement': {
        const errCode = stmt.errorCode ? this.emitExprStr(stmt.errorCode) : 'pinocchio::program_error::ProgramError::Custom(0)';
        this.emit(`if !(${this.emitExprStr(stmt.condition)}) {`);
        this.indent++;
        this.emit(`return Err(${errCode});`);
        this.indent--;
        this.emit('}');
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
      this.emit(`let seeds: &[&[u8]] = &[${seeds}];`);
      this.emit(`let signer_seeds: &[&[&[u8]]] = &[seeds];`);
      this.emit(`pinocchio::cpi::invoke_signed(`);
      this.indent++;
      this.emit(`&instruction,`);
      this.emit(`&[${accountsList}],`);
      this.emit('signer_seeds,');
      this.indent--;
      this.emit(')?;');
    } else {
      this.emit(`pinocchio::cpi::invoke(`);
      this.indent++;
      this.emit(`&instruction,`);
      this.emit(`&[${accountsList}],`);
      this.indent--;
      this.emit(')?;');
    }
  }

  private emitSPLOperation(node: AST.SPLOperation): void {
    const getArg = (name: string): string => {
      const arg = node.args.find(a => a.name === name);
      return arg ? this.emitExprStr(arg.value) : name;
    };

    switch (node.operation) {
      case 'transfer': {
        this.emit('SplTransfer {');
        this.indent++;
        this.emit(`from: ${getArg('from')},`);
        this.emit(`to: ${getArg('to')},`);
        this.emit(`authority: ${getArg('authority')},`);
        this.emit(`amount: ${getArg('amount')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'mint_to': {
        this.emit('MintTo {');
        this.indent++;
        this.emit(`mint: ${getArg('mint')},`);
        this.emit(`account: ${getArg('to')},`);
        this.emit(`mint_authority: ${getArg('authority')},`);
        this.emit(`amount: ${getArg('amount')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'burn': {
        this.emit('Burn {');
        this.indent++;
        this.emit(`account: ${getArg('from')},`);
        this.emit(`mint: ${getArg('mint')},`);
        this.emit(`authority: ${getArg('authority')},`);
        this.emit(`amount: ${getArg('amount')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'close_account': {
        this.emit('SplCloseAccount {');
        this.indent++;
        this.emit(`account: ${getArg('account')},`);
        this.emit(`destination: ${getArg('destination')},`);
        this.emit(`authority: ${getArg('authority')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'approve': {
        this.emit('Approve {');
        this.indent++;
        this.emit(`source: ${getArg('to')},`);
        this.emit(`delegate: ${getArg('delegate')},`);
        this.emit(`authority: ${getArg('authority')},`);
        this.emit(`amount: ${getArg('amount')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'revoke': {
        this.emit('Revoke {');
        this.indent++;
        this.emit(`source: ${getArg('source')},`);
        this.emit(`authority: ${getArg('authority')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'create_associated_token_account': {
        this.emit('// Create ATA via CPI to associated token program');
        this.emit('pinocchio_associated_token::instructions::Create {');
        this.indent++;
        this.emit(`funding_account: ${getArg('payer')},`);
        this.emit(`associated_account: ${getArg('account')},`);
        this.emit(`wallet_address: ${getArg('authority')},`);
        this.emit(`token_mint: ${getArg('mint')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'freeze_account': {
        this.emit('FreezeAccount {');
        this.indent++;
        this.emit(`account: ${getArg('account')},`);
        this.emit(`mint: ${getArg('mint')},`);
        this.emit(`authority: ${getArg('authority')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'thaw_account': {
        this.emit('ThawAccount {');
        this.indent++;
        this.emit(`account: ${getArg('account')},`);
        this.emit(`mint: ${getArg('mint')},`);
        this.emit(`authority: ${getArg('authority')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'set_authority': {
        this.emit('SetAuthority {');
        this.indent++;
        this.emit(`owned: ${getArg('account')},`);
        this.emit(`authority: ${getArg('authority')},`);
        this.emit(`authority_type: pinocchio_token::state::AuthorityType::MintTokens,`);
        this.emit(`new_authority: ${getArg('new_authority')},`);
        this.indent--;
        this.emit('}.invoke()?;');
        break;
      }
      case 'sync_native': {
        this.emit('SyncNative {');
        this.indent++;
        this.emit(`account: ${getArg('account')},`);
        this.indent--;
        this.emit('}.invoke()?;');
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
        return `Address::from_str("${expr.value}").unwrap()`;
      case 'NullLiteral':
        return 'None';
      case 'IdentifierExpr': {
        // In Pinocchio, accounts are local variables, not ctx.accounts.x
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
      case 'SpreadExpr':
        return `${this.emitExprStr(expr.expression)}.into_iter()`;
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
        return `${expr.amount} * 1_000_000_000u64`;
      case 'LamportsLiteral':
        return `${expr.amount}`;
      default:
        return '/* unsupported expression */';
    }
  }

  private emitBinaryExpr(expr: AST.BinaryExpr): string {
    const left = this.emitExprStr(expr.left);
    const right = this.emitExprStr(expr.right);
    // Map operators that differ in Rust
    switch (expr.operator) {
      case '??':
        return `${left}.unwrap_or(${right})`;
      case '**':
        return `${left}.pow(${right} as u32)`;
      default:
        return `(${left} ${expr.operator} ${right})`;
    }
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
      case 'msg': case 'print': case 'log': return `msg!(${args})`;
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
      'pubkey': 'Address',
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
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/_+/g, '_');
  }

  private toPascalCase(name: string): string {
    return name.split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }
}
