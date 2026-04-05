// ============================================================================
// purp format — Format Purp source files
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { formatPurpFile } from '../../../compiler/src/formatter/index.js';
import { findPurpFiles, readConfig } from '../utils/index.js';

export async function formatCommand(args: string[]): Promise<void> {
  const check = args.includes('--check');

  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Format\x1b[0m');
  console.log('');

  const config = readConfig();
  const srcDir = config?.source ?? 'src';
  const files = findPurpFiles(srcDir);

  if (files.length === 0) {
    console.log('\x1b[33m⚠\x1b[0m No .purp files found');
    return;
  }

  let changed = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(process.cwd(), file);
    const formatted = formatPurpFile(source);

    if (source !== formatted) {
      if (check) {
        console.log(`  \x1b[33m⚠\x1b[0m ${relPath} needs formatting`);
        changed++;
      } else {
        fs.writeFileSync(file, formatted, 'utf-8');
        console.log(`  \x1b[32m✓\x1b[0m Formatted ${relPath}`);
        changed++;
      }
    } else {
      console.log(`  \x1b[32m✓\x1b[0m ${relPath}`);
    }
  }

  console.log('');
  if (check && changed > 0) {
    console.log(`\x1b[33m⚠ ${changed} file(s) need formatting\x1b[0m`);
    console.log('  Run \x1b[36mpurp format\x1b[0m to fix.');
    process.exit(1);
  } else if (changed > 0) {
    console.log(`\x1b[32m✓ Formatted ${changed} file(s)\x1b[0m`);
  } else {
    console.log('\x1b[32m✓ All files already formatted\x1b[0m');
  }
}
