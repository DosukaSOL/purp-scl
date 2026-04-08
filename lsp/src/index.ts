// ============================================================================
// Purp Language Server Protocol (LSP) v1.0.0
// Provides IDE support: diagnostics, hover, completions, go-to-definition
// ============================================================================

import { Lexer } from '../compiler/src/lexer/index.js';
import { Parser } from '../compiler/src/parser/index.js';
import { SemanticAnalyzer } from '../compiler/src/semantic/index.js';
import * as AST from '../compiler/src/ast/index.js';

// ═══════════════════════════════════════════════════════════════════
// LSP Types (subset of Language Server Protocol spec)
// ═══════════════════════════════════════════════════════════════════

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Diagnostic {
  range: Range;
  severity: DiagnosticSeverity;
  message: string;
  source: string;
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export enum CompletionItemKind {
  Keyword = 14,
  Function = 3,
  Variable = 6,
  Struct = 22,
  Enum = 13,
  Field = 5,
  Snippet = 15,
  Type = 25,
}

export interface HoverResult {
  contents: string;
  range?: Range;
}

export interface DefinitionResult {
  uri: string;
  range: Range;
}

// ═══════════════════════════════════════════════════════════════════
// Purp Language Server
// ═══════════════════════════════════════════════════════════════════

export class PurpLanguageServer {
  private documents: Map<string, string> = new Map();
  private asts: Map<string, AST.ProgramNode> = new Map();
  private symbols: Map<string, SymbolInfo[]> = new Map();

  // Update document and re-analyze
  updateDocument(uri: string, content: string): Diagnostic[] {
    this.documents.set(uri, content);
    return this.analyze(uri, content);
  }

  // Get diagnostics for a document
  analyze(uri: string, content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    try {
      const lexer = new Lexer(content, uri);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, uri);
      const ast = parser.parse();
      this.asts.set(uri, ast);

      // Collect symbols
      this.collectSymbols(uri, ast);

      // Run semantic analysis
      const analyzer = new SemanticAnalyzer(uri);
      const diags = analyzer.analyze(ast);

      for (const d of diags.getAll()) {
        diagnostics.push({
          range: {
            start: { line: (d.location?.line ?? 1) - 1, character: (d.location?.column ?? 1) - 1 },
            end: { line: (d.location?.line ?? 1) - 1, character: (d.location?.column ?? 1) + 10 },
          },
          severity: d.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
          message: d.description,
          source: 'purp',
        });
      }
    } catch (err: any) {
      diagnostics.push({
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 100 } },
        severity: DiagnosticSeverity.Error,
        message: err.message ?? String(err),
        source: 'purp',
      });
    }

    return diagnostics;
  }

  // Get completions at a position
  getCompletions(uri: string, position: Position): CompletionItem[] {
    const items: CompletionItem[] = [];
    const content = this.documents.get(uri);
    const ast = this.asts.get(uri);

    // Context detection: look at text before cursor
    const line = content?.split('\n')[position.line] ?? '';
    const textBefore = line.slice(0, position.character);

    // After a dot — suggest fields of the type
    if (textBefore.match(/(\w+)\.\s*$/) && ast) {
      const objName = textBefore.match(/(\w+)\.\s*$/)![1];
      return this.getFieldCompletions(uri, objName);
    }

    // After #[ — suggest constraints
    if (textBefore.match(/#\[\s*$/)) {
      const constraints = ['init', 'mut', 'seeds', 'bump', 'has_one', 'constraint', 'close', 'payer', 'space'];
      for (const c of constraints) {
        items.push({ label: c, kind: CompletionItemKind.Keyword, detail: `Account constraint` });
      }
      return items;
    }

    // Keywords
    const keywords = [
      'program', 'instruction', 'account', 'struct', 'enum', 'fn', 'pub',
      'let', 'mut', 'const', 'return', 'if', 'else', 'match', 'for', 'while',
      'loop', 'break', 'continue', 'import', 'from', 'event', 'emit', 'error',
      'trait', 'impl', 'type', 'async', 'await', 'try', 'catch', 'throw',
      'assert', 'require', 'test', 'signer', 'init', 'pda', 'cpi', 'transfer',
      'mint_to', 'burn', 'close_account', 'seeds', 'bump', 'payer', 'space',
      'state', 'machine', 'transition', 'guard',
    ];

    for (const kw of keywords) {
      items.push({ label: kw, kind: CompletionItemKind.Keyword });
    }

    // Types
    const types = [
      'u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128',
      'f32', 'f64', 'bool', 'string', 'pubkey', 'bytes',
      'Vec', 'Option', 'Result', 'Pubkey', 'Signer',
    ];

    for (const t of types) {
      items.push({ label: t, kind: CompletionItemKind.Type });
    }

    // Symbols from current document
    const docSymbols = this.symbols.get(uri) ?? [];
    for (const sym of docSymbols) {
      items.push({
        label: sym.name,
        kind: sym.symbolKind,
        detail: sym.detail,
      });
    }

    // Snippets
    items.push({
      label: 'instruction',
      kind: CompletionItemKind.Snippet,
      detail: 'Create an instruction',
      insertText: 'pub instruction ${1:name}(\n  #[mut] signer ${2:authority}\n) {\n  $0\n}',
    });
    items.push({
      label: 'account',
      kind: CompletionItemKind.Snippet,
      detail: 'Create an account',
      insertText: 'account ${1:Name} {\n  ${2:field}: ${3:type}\n}',
    });
    items.push({
      label: 'program',
      kind: CompletionItemKind.Snippet,
      detail: 'Create a program',
      insertText: 'program ${1:Name} {\n  $0\n}',
    });
    items.push({
      label: 'state machine',
      kind: CompletionItemKind.Snippet,
      detail: 'Create a state machine',
      insertText: 'state machine ${1:Name} {\n  state ${2:Initial}\n  state ${3:Final}\n\n  transition ${4:action}: ${2} -> ${3}\n}',
    });

    return items;
  }

  // Get field completions for a type
  private getFieldCompletions(uri: string, objectName: string): CompletionItem[] {
    const items: CompletionItem[] = [];
    const ast = this.asts.get(uri);
    if (!ast) return items;

    // Find the account or struct that matches
    const findDecl = (nodes: AST.TopLevelNode[]): void => {
      for (const node of nodes) {
        if (node.kind === 'ProgramDeclaration') {
          findDecl(node.body);
        }
        // Match by name (PascalCase) or lowercase name
        const targetName = objectName.charAt(0).toUpperCase() + objectName.slice(1);
        if (node.kind === 'AccountDeclaration' && (node.name === targetName || node.name === objectName)) {
          for (const field of node.fields) {
            items.push({
              label: field.name,
              kind: CompletionItemKind.Field,
              detail: this.typeToString(field.type),
            });
          }
        }
        if (node.kind === 'StructDeclaration' && (node.name === targetName || node.name === objectName)) {
          for (const field of node.fields) {
            items.push({
              label: field.name,
              kind: CompletionItemKind.Field,
              detail: this.typeToString(field.type),
            });
          }
        }
        if (node.kind === 'EnumDeclaration' && (node.name === targetName || node.name === objectName)) {
          for (const variant of node.variants) {
            items.push({
              label: variant.name,
              kind: CompletionItemKind.Enum,
              detail: 'enum variant',
            });
          }
        }
        if (node.kind === 'ErrorDeclaration' && (node.name === targetName || node.name === objectName)) {
          for (const variant of node.variants) {
            items.push({
              label: variant.name,
              kind: CompletionItemKind.Enum,
              detail: `error (code ${variant.code}): ${variant.message}`,
            });
          }
        }
      }
    };
    findDecl(ast.body);

    // Built-in member completions
    if (objectName === 'Clock') {
      items.push({ label: 'timestamp', kind: CompletionItemKind.Field, detail: 'i64 — Current Unix timestamp' });
      items.push({ label: 'slot', kind: CompletionItemKind.Field, detail: 'u64 — Current slot' });
      items.push({ label: 'epoch', kind: CompletionItemKind.Field, detail: 'u64 — Current epoch' });
    }

    return items;
  }

  private typeToString(type: AST.TypeAnnotation): string {
    switch (type.kind) {
      case 'PrimitiveType': return type.name;
      case 'NamedType': return type.typeArgs ? `${type.name}<${type.typeArgs.map(t => this.typeToString(t)).join(', ')}>` : type.name;
      case 'ArrayType': return type.size ? `[${this.typeToString(type.element)}; ${type.size}]` : `Vec<${this.typeToString(type.element)}>`;
      case 'OptionType': return `Option<${this.typeToString(type.inner)}>`;
      case 'ResultType': return `Result<${this.typeToString(type.ok)}, ${this.typeToString(type.err)}>`;
      case 'TupleType': return `(${type.elements.map(t => this.typeToString(t)).join(', ')})`;
      default: return 'unknown';
    }
  }

  // Get hover info at a position
  getHover(uri: string, position: Position): HoverResult | null {
    const content = this.documents.get(uri);
    if (!content) return null;

    const word = this.getWordAtPosition(content, position);
    if (!word) return null;

    // Check for rich symbol info from AST
    const ast = this.asts.get(uri);
    if (ast) {
      const rich = this.getRichHover(ast, word);
      if (rich) return rich;
    }

    // Check symbols
    const docSymbols = this.symbols.get(uri) ?? [];
    const sym = docSymbols.find(s => s.name === word);
    if (sym) {
      return { contents: `**${sym.name}** — ${sym.detail ?? sym.symbolKind}` };
    }

    // Check built-in types
    const typeInfo: Record<string, string> = {
      'u8': '**u8** — 8-bit unsigned integer (0 to 255)',
      'u16': '**u16** — 16-bit unsigned integer (0 to 65,535)',
      'u32': '**u32** — 32-bit unsigned integer (0 to 4,294,967,295)',
      'u64': '**u64** — 64-bit unsigned integer (0 to 18.4 quintillion)',
      'u128': '**u128** — 128-bit unsigned integer',
      'i8': '**i8** — 8-bit signed integer (-128 to 127)',
      'i16': '**i16** — 16-bit signed integer',
      'i32': '**i32** — 32-bit signed integer',
      'i64': '**i64** — 64-bit signed integer',
      'i128': '**i128** — 128-bit signed integer',
      'f32': '**f32** — 32-bit floating point number',
      'f64': '**f64** — 64-bit floating point number',
      'bool': '**bool** — Boolean (true or false)',
      'string': '**string** — UTF-8 string',
      'bytes': '**bytes** — Raw byte array',
      'pubkey': '**pubkey** — Solana public key (32 bytes)',
      'Signer': '**Signer** — A verified transaction signer',
      'Pubkey': '**Pubkey** — Solana public key',
      'Vec': '**Vec\\<T\\>** — Dynamic-size array',
      'Option': '**Option\\<T\\>** — Optional value (Some or None)',
      'Result': '**Result\\<T, E\\>** — Success or error value',
      'program': '**program** — Declares a Solana program module',
      'instruction': '**instruction** — Declares an on-chain instruction handler',
      'account': '**account** — Declares an on-chain account data structure',
      'emit': '**emit** — Emit an event log',
      'assert': '**assert** — Assert a condition (fails transaction if false)',
      'require': '**require** — Require a condition with custom error',
      'cpi': '**cpi** — Cross-Program Invocation — call another Solana program',
      'seeds': '**seeds** — PDA seeds for deriving program addresses',
      'init': '**#[init]** — Initialize a new account',
      'mut': '**#[mut]** — Mark account as mutable',
      'payer': '**payer** — Account that pays for new account creation',
      'space': '**space** — Byte size allocation for new accounts',
      'client': '**client** — Client-side SDK logic block',
      'frontend': '**frontend** — Frontend React component block',
      'test': '**test** — Test block for assertion-based testing',
    };

    if (typeInfo[word]) {
      return { contents: typeInfo[word] };
    }

    return null;
  }

  // Rich hover from AST declarations
  private getRichHover(ast: AST.ProgramNode, word: string): HoverResult | null {
    const search = (nodes: AST.TopLevelNode[]): HoverResult | null => {
      for (const node of nodes) {
        if (node.kind === 'ProgramDeclaration') {
          if (node.name === word) return { contents: `**program ${node.name}**\n\n${node.body.length} members` };
          const inner = search(node.body);
          if (inner) return inner;
        }
        if (node.kind === 'InstructionDeclaration' && node.name === word) {
          const accs = node.accounts.map(a => `  ${a.accountType.kind} ${a.name}`).join('\n');
          const params = node.params.map(p => `${p.name}: ${this.typeToString(p.type)}`).join(', ');
          return { contents: `**instruction ${node.name}**(${params})\n\n**Accounts:**\n\`\`\`\n${accs}\n\`\`\`` };
        }
        if (node.kind === 'AccountDeclaration' && node.name === word) {
          const fields = node.fields.map(f => `  ${f.name}: ${this.typeToString(f.type)}`).join('\n');
          return { contents: `**account ${node.name}**\n\`\`\`\n${fields}\n\`\`\`` };
        }
        if (node.kind === 'StructDeclaration' && node.name === word) {
          const fields = node.fields.map(f => `  ${f.name}: ${this.typeToString(f.type)}`).join('\n');
          const gen = node.genericParams?.map(g => g.name).join(', ');
          return { contents: `**struct ${node.name}${gen ? `<${gen}>` : ''}**\n\`\`\`\n${fields}\n\`\`\`` };
        }
        if (node.kind === 'EnumDeclaration' && node.name === word) {
          const variants = node.variants.map(v => `  ${v.name}${v.fields ? ` { ${v.fields.map(f => `${f.name}: ${this.typeToString(f.type)}`).join(', ')} }` : ''}`).join('\n');
          return { contents: `**enum ${node.name}**\n\`\`\`\n${variants}\n\`\`\`` };
        }
        if (node.kind === 'ErrorDeclaration' && node.name === word) {
          const variants = node.variants.map(v => `  ${v.name} = ${v.code} — "${v.message}"`).join('\n');
          return { contents: `**error ${node.name}**\n\`\`\`\n${variants}\n\`\`\`` };
        }
        if (node.kind === 'FunctionDeclaration' && node.name === word) {
          const params = node.params.map(p => `${p.name}: ${this.typeToString(p.type)}`).join(', ');
          const ret = node.returnType ? ` -> ${this.typeToString(node.returnType)}` : '';
          return { contents: `**fn ${node.name}**(${params})${ret}` };
        }
        if (node.kind === 'EventDeclaration' && node.name === word) {
          const fields = node.fields.map(f => `  ${f.name}: ${this.typeToString(f.type)}`).join('\n');
          return { contents: `**event ${node.name}**\n\`\`\`\n${fields}\n\`\`\`` };
        }
        if (node.kind === 'TraitDeclaration' && node.name === word) {
          const methods = node.methods.map(m => `  fn ${m.name}(${m.params.map(p => p.name).join(', ')})`).join('\n');
          return { contents: `**trait ${node.name}**\n\`\`\`\n${methods}\n\`\`\`` };
        }
        if (node.kind === 'StateMachineDeclaration' && node.name === word) {
          const states = node.states.map(s => s.name).join(', ');
          const trans = node.transitions.map(t => `  ${t.name}: ${t.from.join(' | ')} → ${t.to}`).join('\n');
          return { contents: `**state machine ${node.name}**\n\nStates: ${states}\n\`\`\`\n${trans}\n\`\`\`` };
        }
      }
      return null;
    };
    return search(ast.body);
  }

  // Get definition location
  getDefinition(uri: string, position: Position): DefinitionResult | null {
    const content = this.documents.get(uri);
    if (!content) return null;

    const word = this.getWordAtPosition(content, position);
    if (!word) return null;

    const docSymbols = this.symbols.get(uri) ?? [];
    const sym = docSymbols.find(s => s.name === word);
    if (sym) {
      return {
        uri,
        range: {
          start: { line: sym.line, character: sym.column },
          end: { line: sym.line, character: sym.column + sym.name.length },
        },
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Symbol Collection
  // ═══════════════════════════════════════════════════════════════════

  private collectSymbols(uri: string, ast: AST.ProgramNode): void {
    const symbols: SymbolInfo[] = [];

    for (const node of ast.body) {
      this.collectNodeSymbols(node, symbols);
    }

    this.symbols.set(uri, symbols);
  }

  private collectNodeSymbols(node: AST.TopLevelNode, symbols: SymbolInfo[]): void {
    switch (node.kind) {
      case 'ProgramDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Struct,
          detail: 'Solana program',
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        for (const child of node.body) this.collectNodeSymbols(child, symbols);
        break;
      case 'InstructionDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Function,
          detail: `instruction(${node.accounts.length} accounts, ${node.params.length} params)`,
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'AccountDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Struct,
          detail: `account (${node.fields.length} fields)`,
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'StructDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Struct,
          detail: `struct (${node.fields.length} fields)`,
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'EnumDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Enum,
          detail: `enum (${node.variants.length} variants)`,
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'FunctionDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Function,
          detail: `fn(${node.params.map(p => p.name).join(', ')})`,
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'EventDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Struct,
          detail: 'event',
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'ConstDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Variable,
          detail: 'constant',
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'ErrorDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Enum,
          detail: `error (${node.variants.length} variants)`,
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'TraitDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Struct,
          detail: 'trait',
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'TypeAlias':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Type,
          detail: 'type alias',
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
      case 'ImportDeclaration':
        for (const item of node.items) {
          symbols.push({
            name: item.alias ?? item.name,
            symbolKind: CompletionItemKind.Variable,
            detail: `imported from ${node.path}`,
            line: node.span.start.line - 1,
            column: node.span.start.column - 1,
          });
        }
        break;
      case 'StateMachineDeclaration':
        symbols.push({
          name: node.name,
          symbolKind: CompletionItemKind.Enum,
          detail: `state machine (${node.states.length} states, ${node.transitions.length} transitions)`,
          line: node.span.start.line - 1,
          column: node.span.start.column - 1,
        });
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════

  private getWordAtPosition(content: string, position: Position): string | null {
    const lines = content.split('\n');
    const line = lines[position.line];
    if (!line) return null;

    let start = position.character;
    let end = position.character;

    while (start > 0 && /\w/.test(line[start - 1])) start--;
    while (end < line.length && /\w/.test(line[end])) end++;

    const word = line.slice(start, end);
    return word.length > 0 ? word : null;
  }
}

interface SymbolInfo {
  name: string;
  symbolKind: CompletionItemKind;
  detail?: string;
  line: number;
  column: number;
}
