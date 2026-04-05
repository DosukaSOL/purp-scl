// ============================================================================
// purp run — Run a Purp script
// ============================================================================

import * as fs from 'node:fs';
import { compile } from '../../../compiler/src/index.js';

export async function runCommand(args: string[]): Promise<void> {
  const file = args[0] ?? 'src/main.purp';

  if (!fs.existsSync(file)) {
    console.error(`\x1b[31m✖ File not found: ${file}\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[35m⟡\x1b[0m Running ${file}...`);
  console.log('');

  const source = fs.readFileSync(file, 'utf-8');
  const result = compile(source, { file, target: 'typescript', debug: args.includes('--debug') });

  if (!result.success) {
    console.error(result.diagnostics.format());
    process.exit(1);
  }

  if (result.typescript) {
    console.log('Generated TypeScript output:');
    console.log('─'.repeat(60));
    console.log(result.typescript);
    console.log('─'.repeat(60));
  }
}
