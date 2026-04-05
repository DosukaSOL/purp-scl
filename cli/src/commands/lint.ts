// ============================================================================
// purp lint — Lint Purp source files
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Lexer } from '../../../compiler/src/lexer/index.js';
import { Parser } from '../../../compiler/src/parser/index.js';
import { PurpLinter } from '../../../compiler/src/linter/index.js';
import { findPurpFiles, readConfig } from '../utils/index.js';

export async function lintCommand(args: string[]): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Lint\x1b[0m');
  console.log('');

  const config = readConfig();
  const srcDir = config?.source ?? 'src';
  const files = findPurpFiles(srcDir);

  if (files.length === 0) {
    console.log('\x1b[33m⚠\x1b[0m No .purp files found');
    return;
  }

  const linter = new PurpLinter();
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
      const result = linter.lint(ast, file);

      totalErrors += result.errors;
      totalWarnings += result.warnings;

      if (result.errors > 0 || result.warnings > 0) {
        console.log(`  ${result.errors > 0 ? '\x1b[31m✖\x1b[0m' : '\x1b[33m⚠\x1b[0m'} ${relPath} — ${result.errors} error(s), ${result.warnings} warning(s)`);
        console.log(result.diagnostics.format());
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
    console.log('\x1b[32m✓ No lint issues found\x1b[0m');
  }
}
