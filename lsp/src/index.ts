// ============================================================================
// Purp Language Server Protocol (LSP) v0.2.0
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

    // Keywords
    const keywords = [
      'program', 'instruction', 'account', 'struct', 'enum', 'fn', 'pub',
      'let', 'mut', 'const', 'return', 'if', 'else', 'match', 'for', 'while',
      'loop', 'break', 'continue', 'import', 'from', 'event', 'emit', 'error',
      'trait', 'impl', 'type', 'async', 'await', 'try', 'catch', 'throw',
      'assert', 'require', 'test', 'signer', 'init', 'pda', 'cpi', 'transfer',
      'mint_to', 'burn', 'close_account', 'seeds', 'bump', 'payer', 'space',
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

    return items;
  }

  // Get hover info at a position
  getHover(uri: string, position: Position): HoverResult | null {
    const content = this.documents.get(uri);
    if (!content) return null;

    const word = this.getWordAtPosition(content, position);
    if (!word) return null;

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
      'i64': '**i64** — 64-bit signed integer',
      'f64': '**f64** — 64-bit floating point number',
      'bool': '**bool** — Boolean (true or false)',
      'string': '**string** — UTF-8 string',
      'pubkey': '**pubkey** — Solana public key (32 bytes)',
      'Signer': '**Signer** — A verified transaction signer',
      'Pubkey': '**Pubkey** — Solana public key',
    };

    if (typeInfo[word]) {
      return { contents: typeInfo[word] };
    }

    return null;
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
