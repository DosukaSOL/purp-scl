// ============================================================================
// purp build — Compile Purp to Rust + TypeScript
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { compile } from '../../../compiler/src/index.js';
import { findPurpFiles, ensureDir, readConfig } from '../utils/index.js';

export async function buildCommand(args: string[]): Promise<void> {
  const debug = args.includes('--debug');
  const targetArg = args.find((a, i) => args[i - 1] === '--target') ?? 'both';
  const target = targetArg as 'rust' | 'typescript' | 'both';

  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Build\x1b[0m');
  console.log('');

  const config = readConfig();
  const srcDir = config?.source ?? 'src';
  const outDir = config?.output ?? 'target';

  // Find all .purp files
  const files = findPurpFiles(srcDir);

  if (files.length === 0) {
    console.log('\x1b[33m⚠\x1b[0m No .purp files found in', srcDir);
    console.log('  Create a .purp file or run \x1b[36mpurp init\x1b[0m');
    return;
  }

  console.log(`  Found ${files.length} source file(s)`);

  const rustOutDir = path.join(outDir, 'rust', 'src');
  const tsOutDir = path.join(outDir, 'typescript', 'src');
  const frontendOutDir = path.join(outDir, 'frontend', 'src');

  if (target === 'rust' || target === 'both') ensureDir(rustOutDir);
  if (target === 'typescript' || target === 'both') {
    ensureDir(tsOutDir);
    ensureDir(frontendOutDir);
  }

  let errors = 0;
  let warnings = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(process.cwd(), file);
    const baseName = path.basename(file, '.purp');

    process.stdout.write(`  Compiling ${relPath}... `);

    const result = compile(source, { file, target, debug });

    if (!result.success) {
      console.log('\x1b[31m✖\x1b[0m');
      console.error(result.diagnostics.format());
      errors += result.diagnostics.getErrors().length;
      continue;
    }

    warnings += result.diagnostics.getWarnings().length;

    if (result.rust) {
      const outPath = path.join(rustOutDir, `${baseName}.rs`);
      fs.writeFileSync(outPath, result.rust, 'utf-8');
    }

    if (result.typescript) {
      const outPath = path.join(tsOutDir, `${baseName}.ts`);
      fs.writeFileSync(outPath, result.typescript, 'utf-8');
    }

    if (result.frontend) {
      const outPath = path.join(frontendOutDir, `${baseName}.tsx`);
      fs.writeFileSync(outPath, result.frontend, 'utf-8');
    }

    console.log('\x1b[32m✓\x1b[0m');
  }

  console.log('');
  if (errors > 0) {
    console.log(`\x1b[31m✖ Build failed with ${errors} error(s)\x1b[0m`);
    process.exit(1);
  }

  if (warnings > 0) {
    console.log(`\x1b[33m⚠ Build succeeded with ${warnings} warning(s)\x1b[0m`);
  } else {
    console.log('\x1b[32m✓ Build successful\x1b[0m');
  }

  if (target === 'rust' || target === 'both') {
    console.log(`  Rust output:       ${rustOutDir}/`);
  }
  if (target === 'typescript' || target === 'both') {
    console.log(`  TypeScript output:  ${tsOutDir}/`);
    console.log(`  Frontend output:    ${frontendOutDir}/`);
  }
}
