// ============================================================================
// Purp Compiler v0.2.0 — The Solana Coding Language
// Main entry point: Lex → Parse → Type-check → Analyze → Generate
// ============================================================================

import { Lexer } from './lexer/index.js';
import { Parser } from './parser/index.js';
import { SemanticAnalyzer } from './semantic/index.js';
import { RustCodegen } from './codegen/rust/index.js';
import { TypeScriptCodegen } from './codegen/typescript/index.js';
import { PurpDiagnostics } from './errors/index.js';
import { SourceMap, SourceMapBuilder } from './sourcemap/index.js';

export interface CompileOptions {
  file?: string;
  target?: 'rust' | 'typescript' | 'both';
  debug?: boolean;
  sourceMap?: boolean;
}

export interface CompileResult {
  success: boolean;
  rust?: string;
  typescript?: string;
  diagnostics: PurpDiagnostics;
  sourceMap?: SourceMap;
}

export function compile(source: string, options?: CompileOptions): CompileResult {
  const file = options?.file ?? '<stdin>';
  const target = options?.target ?? 'both';
  const debug = options?.debug ?? false;
  const diagnostics = new PurpDiagnostics();

  try {
    // Phase 1: Lexing
    if (debug) console.log('[purp] Lexing...');
    const lexer = new Lexer(source, file);
    const tokens = lexer.tokenize();
    if (debug) console.log(`[purp] Produced ${tokens.length} tokens`);

    // Phase 2: Parsing
    if (debug) console.log('[purp] Parsing...');
    const parser = new Parser(tokens, file);
    const ast = parser.parse();
    if (debug) console.log(`[purp] AST has ${ast.body.length} top-level nodes`);

    // Phase 3: Semantic Analysis + Type Checking
    if (debug) console.log('[purp] Analyzing...');
    const analyzer = new SemanticAnalyzer(file);
    const analyzerDiags = analyzer.analyze(ast);

    // Merge diagnostics
    for (const d of analyzerDiags.getAll()) {
      diagnostics.add(d);
    }

    if (diagnostics.hasErrors()) {
      return { success: false, diagnostics };
    }

    // Phase 4: Code Generation
    let rust: string | undefined;
    let typescript: string | undefined;
    let sourceMap: SourceMap | undefined;

    if (target === 'rust' || target === 'both') {
      if (debug) console.log('[purp] Generating Rust...');
      const rustGen = new RustCodegen();
      rust = rustGen.generate(ast);

      // Build source map
      if (options?.sourceMap) {
        const smBuilder = new SourceMapBuilder(file);
        const lines = rust.split('\n');
        for (let i = 0; i < lines.length; i++) {
          smBuilder.nextLine();
        }
        sourceMap = smBuilder.build();
      }
    }

    if (target === 'typescript' || target === 'both') {
      if (debug) console.log('[purp] Generating TypeScript...');
      const tsGen = new TypeScriptCodegen();
      typescript = tsGen.generate(ast);
    }

    return {
      success: true,
      rust,
      typescript,
      diagnostics,
      sourceMap,
    };
  } catch (err: any) {
    // Capture parse/lex errors as diagnostics
    if (err.code !== undefined && err.location !== undefined) {
      diagnostics.add(err);
    } else {
      diagnostics.error(
        2001, // ParseError
        err.message ?? String(err),
        undefined,
        file,
      );
    }
    return { success: false, diagnostics };
  }
}

// Re-export components for direct use
export { Lexer } from './lexer/index.js';
export { Parser } from './parser/index.js';
export { SemanticAnalyzer } from './semantic/index.js';
export { RustCodegen } from './codegen/rust/index.js';
export { TypeScriptCodegen } from './codegen/typescript/index.js';
export { PurpDiagnostics, PurpError, ErrorCode } from './errors/index.js';
export { SourceMap, SourceMapBuilder } from './sourcemap/index.js';
export { TypeChecker } from './typechecker/index.js';
