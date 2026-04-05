// ============================================================================
// purp clean — Remove build artifacts
// ============================================================================

import * as fs from 'node:fs';

export async function cleanCommand(): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Clean\x1b[0m');

  const dirs = ['target', 'dist', '.purp-cache'];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  Removed ${dir}/`);
    }
  }

  console.log('\x1b[32m✓ Clean complete\x1b[0m');
}
