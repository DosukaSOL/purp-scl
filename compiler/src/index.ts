// ============================================================================
// Purp Compiler — The Solana Coding Language
// Main compiler entry point: source → lex → parse → analyze → codegen
// ============================================================================

import { Lexer } from './lexer/index.js';
import { Parser } from './parser/index.js';
import { SemanticAnalyzer } from './semantic/index.js';
import { RustCodegen } from './codegen/rust/index.js';
import { TypeScriptCodegen } from './codegen/typescript/index.js';
import { PurpDiagnostics } from './errors/index.js';
import type { ProgramNode } from './ast/index.js';

export interface CompileOptions {
  file?: string;
  target?: 'rust' | 'typescript' | 'both';
  debug?: boolean;
  skipValidation?: boolean;
}

export interface CompileResult {
  success: boolean;
  ast?: ProgramNode;
  rust?: string;
  typescript?: string;
  diagnostics: PurpDiagnostics;
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const file = options.file ?? '<stdin>';
  const target = options.target ?? 'both';
  const diagnostics = new PurpDiagnostics();

  try {
    // 1. Lex
    if (options.debug) console.log('[purp] Lexing...');
    const lexer = new Lexer(source, file);
    const tokens = lexer.tokenize();
    if (options.debug) console.log(`[purp] ${tokens.length} tokens`);

    // 2. Parse
    if (options.debug) console.log('[purp] Parsing...');
    const parser = new Parser(tokens, file);
    const ast = parser.parse();
    if (options.debug) console.log(`[purp] AST: ${ast.body.length} top-level nodes`);

    // 3. Semantic analysis
    if (!options.skipValidation) {
      if (options.debug) console.log('[purp] Analyzing...');
      const analyzer = new SemanticAnalyzer(file);
      const analysisDiags = analyzer.analyze(ast);
      for (const d of analysisDiags.getAll()) {
        diagnostics.add(d);
      }
      if (diagnostics.hasErrors()) {
        return { success: false, ast, diagnostics };
      }
    }

    // 4. Codegen
    let rust: string | undefined;
    let typescript: string | undefined;

    if (target === 'rust' || target === 'both') {
      if (options.debug) console.log('[purp] Generating Rust...');
      const rustGen = new RustCodegen();
      rust = rustGen.generate(ast);
    }

    if (target === 'typescript' || target === 'both') {
      if (options.debug) console.log('[purp] Generating TypeScript...');
      const tsGen = new TypeScriptCodegen();
      typescript = tsGen.generate(ast);
    }

    return { success: true, ast, rust, typescript, diagnostics };
  } catch (err: any) {
    diagnostics.error(
      2001,
      err.message ?? String(err),
      undefined,
      file,
    );
    return { success: false, diagnostics };
  }
}

// Re-export everything
export { Lexer } from './lexer/index.js';
export { Parser } from './parser/index.js';
export { SemanticAnalyzer } from './semantic/index.js';
export { RustCodegen } from './codegen/rust/index.js';
export { TypeScriptCodegen } from './codegen/typescript/index.js';
export { PurpError, PurpDiagnostics, ErrorCode, ErrorSeverity } from './errors/index.js';
export * from './ast/index.js';
export { TokenType, type Token, KEYWORDS } from './lexer/tokens.js';
