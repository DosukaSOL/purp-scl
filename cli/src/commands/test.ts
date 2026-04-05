// ============================================================================
// purp test — Run project tests
// ============================================================================

export async function testCommand(args: string[]): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Test\x1b[0m');
  console.log('');

  // In v0.1, delegate to node --test or show placeholder
  const { execSync } = await import('node:child_process');
  try {
    console.log('  Running tests...');
    execSync('node --test tests/**/*.test.ts 2>&1 || true', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch {
    console.log('  \x1b[33m⚠\x1b[0m No tests found or test runner not available.');
    console.log('  Create test files in tests/ directory.');
  }
}
