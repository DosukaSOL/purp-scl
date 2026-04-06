// ============================================================================
// Purp IDL Generator v1.1.0 — The Solana Coding Language
// Generates Anchor-compatible IDL JSON from the Purp AST
// ============================================================================

import * as AST from '../../ast/index.js';

export interface IDLAccount {
  name: string;
  type: {
    kind: 'struct';
    fields: { name: string; type: string }[];
  };
}

export interface IDLInstruction {
  name: string;
  accounts: {
    name: string;
    isMut: boolean;
    isSigner: boolean;
    isOptional?: boolean;
    pda?: { seeds: { kind: string; value?: string }[] };
  }[];
  args: { name: string; type: string }[];
}

export interface IDLEvent {
  name: string;
  fields: { name: string; type: string; index: boolean }[];
}

export interface IDLError {
  code: number;
  name: string;
  msg: string;
}

export interface IDLType {
  name: string;
  type: {
    kind: 'struct' | 'enum';
    fields?: { name: string; type: string }[];
    variants?: { name: string; fields?: { name: string; type: string }[] }[];
  };
}

export interface AnchorIDL {
  version: string;
  name: string;
  instructions: IDLInstruction[];
  accounts: IDLAccount[];
  events: IDLEvent[];
  errors: IDLError[];
  types: IDLType[];
  metadata?: { address?: string };
}

export class IDLCodegen {
  private instructions: IDLInstruction[] = [];
  private accounts: IDLAccount[] = [];
  private events: IDLEvent[] = [];
  private errors: IDLError[] = [];
  private types: IDLType[] = [];
  private programName: string = 'unknown';

  generate(ast: AST.ProgramNode): AnchorIDL {
    this.instructions = [];
    this.accounts = [];
    this.events = [];
    this.errors = [];
    this.types = [];
    this.programName = 'unknown';

    for (const node of ast.body) {
      this.processNode(node);
    }

    return {
      version: '0.1.0',
      name: this.toSnakeCase(this.programName),
      instructions: this.instructions,
      accounts: this.accounts,
      events: this.events,
      errors: this.errors,
      types: this.types,
    };
  }

  generateJSON(ast: AST.ProgramNode): string {
    return JSON.stringify(this.generate(ast), null, 2);
  }

  private processNode(node: AST.ASTNode): void {
    switch (node.kind) {
      case 'ProgramDeclaration': {
        const prog = node as AST.ProgramDeclaration;
        this.programName = prog.name;
        for (const child of prog.body) {
          this.processNode(child);
        }
        break;
      }
      case 'AccountDeclaration': {
        const acc = node as AST.AccountDeclaration;
        this.accounts.push({
          name: acc.name,
          type: {
            kind: 'struct',
            fields: acc.fields.map(f => ({
              name: this.toSnakeCase(f.name),
              type: this.mapType(f.type),
            })),
          },
        });
        break;
      }
      case 'InstructionDeclaration': {
        const instr = node as AST.InstructionDeclaration;
        this.instructions.push({
          name: this.toSnakeCase(instr.name),
          accounts: instr.accounts.map(a => ({
            name: this.toSnakeCase(a.name),
            isMut: a.constraints?.some((c: AST.AccountConstraint) => c.kind === 'mut' || c.kind === 'init') ?? false,
            isSigner: a.accountType.kind === 'Signer',
            pda: this.extractPDA(a),
          })),
          args: instr.params.map(p => ({
            name: this.toSnakeCase(p.name),
            type: this.mapType(p.type),
          })),
        });
        break;
      }
      case 'EventDeclaration': {
        const event = node as AST.EventDeclaration;
        this.events.push({
          name: event.name,
          fields: event.fields.map(f => ({
            name: this.toSnakeCase(f.name),
            type: this.mapType(f.type),
            index: false,
          })),
        });
        break;
      }
      case 'ErrorDeclaration': {
        const err = node as AST.ErrorDeclaration;
        err.variants.forEach((v, i) => {
          this.errors.push({
            code: 6000 + i,
            name: v.name,
            msg: v.message,
          });
        });
        break;
      }
      case 'StructDeclaration': {
        const s = node as AST.StructDeclaration;
        this.types.push({
          name: s.name,
          type: {
            kind: 'struct',
            fields: s.fields.map(f => ({
              name: this.toSnakeCase(f.name),
              type: this.mapType(f.type),
            })),
          },
        });
        break;
      }
      case 'EnumDeclaration': {
        const e = node as AST.EnumDeclaration;
        this.types.push({
          name: e.name,
          type: {
            kind: 'enum',
            variants: e.variants.map(v => ({
              name: v.name,
              fields: v.fields?.map(f => ({
                name: this.toSnakeCase(f.name),
                type: this.mapType(f.type),
              })),
            })),
          },
        });
        break;
      }
    }
  }

  private extractPDA(acc: AST.AccountParam): { seeds: { kind: string; value?: string }[] } | undefined {
    const seedsConstraint = acc.constraints?.find((c: AST.AccountConstraint) => c.kind === 'seeds');
    if (!seedsConstraint) return undefined;
    return {
      seeds: [{ kind: 'const', value: 'program_seed' }],
    };
  }

  private mapType(type: AST.TypeAnnotation): string {
    switch (type.kind) {
      case 'PrimitiveType':
        return this.mapPrimitiveType(type.name);
      case 'NamedType':
        if (type.typeArgs && type.typeArgs.length > 0) {
          return `${type.name}<${type.typeArgs.map(t => this.mapType(t)).join(', ')}>`;
        }
        return type.name;
      case 'ArrayType':
        if (type.size !== undefined) {
          return `[${this.mapType(type.element)}; ${type.size}]`;
        }
        return `Vec<${this.mapType(type.element)}>`;
      case 'OptionType':
        return `Option<${this.mapType(type.inner)}>`;
      case 'ResultType':
        return type.err
          ? `Result<${this.mapType(type.ok)}, ${this.mapType(type.err)}>`
          : `Result<${this.mapType(type.ok)}>`;
      case 'TupleType':
        return `(${type.elements.map(t => this.mapType(t)).join(', ')})`;
      default:
        return 'bytes';
    }
  }

  private mapPrimitiveType(name: string): string {
    const map: Record<string, string> = {
      u8: 'u8', u16: 'u16', u32: 'u32', u64: 'u64', u128: 'u128',
      i8: 'i8', i16: 'i16', i32: 'i32', i64: 'i64', i128: 'i128',
      f32: 'f32', f64: 'f64',
      bool: 'bool',
      string: 'string',
      pubkey: 'publicKey',
      bytes: 'bytes',
    };
    return map[name] ?? name;
  }

  private toSnakeCase(name: string): string {
    return name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/__+/g, '_');
  }
}

export function generateIDL(ast: AST.ProgramNode): AnchorIDL {
  const gen = new IDLCodegen();
  return gen.generate(ast);
}

export function generateIDLJSON(ast: AST.ProgramNode): string {
  const gen = new IDLCodegen();
  return gen.generateJSON(ast);
}
