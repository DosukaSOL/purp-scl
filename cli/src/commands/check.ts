// ============================================================================
// purp check — Type-check without full build
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Lexer } from '../../../compiler/src/lexer/index.js';
import { Parser } from '../../../compiler/src/parser/index.js';
import { SemanticAnalyzer } from '../../../compiler/src/semantic/index.js';
import { findPurpFiles, readConfig } from '../utils/index.js';

export async function checkCommand(args: string[]): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Check\x1b[0m');
  console.log('');

  const config = readConfig();
  const srcDir = config?.source ?? 'src';
  const files = findPurpFiles(srcDir);

  if (files.length === 0) {
    console.log('\x1b[33m⚠\x1b[0m No .purp files found');
    return;
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(process.cwd(), file);

    try {
      const lexer = new Lexer(source, file);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, file);
      const ast = parser.parse();
      const analyzer = new SemanticAnalyzer(file);
      const diags = analyzer.analyze(ast);

      const errors = diags.getErrors().length;
      const warnings = diags.getWarnings().length;
      totalErrors += errors;
      totalWarnings += warnings;

      if (errors > 0) {
        console.log(`  \x1b[31m✖\x1b[0m ${relPath} — ${errors} error(s)`);
        console.log(diags.format());
      } else if (warnings > 0) {
        console.log(`  \x1b[33m⚠\x1b[0m ${relPath} — ${warnings} warning(s)`);
      } else {
        console.log(`  \x1b[32m✓\x1b[0m ${relPath}`);
      }
    } catch (err: any) {
      totalErrors++;
      console.log(`  \x1b[31m✖\x1b[0m ${relPath} — ${err.message}`);
    }
  }

  console.log('');
  if (totalErrors > 0) {
    console.log(`\x1b[31m✖ ${totalErrors} error(s), ${totalWarnings} warning(s)\x1b[0m`);
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(`\x1b[33m⚠ ${totalWarnings} warning(s)\x1b[0m`);
  } else {
    console.log('\x1b[32m✓ All checks passed\x1b[0m');
  }
}
