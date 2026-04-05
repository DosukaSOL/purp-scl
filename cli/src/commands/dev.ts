// ============================================================================
// purp dev — Development mode with file watching
// ============================================================================

export async function devCommand(args: string[]): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Dev Mode\x1b[0m');
  console.log('');
  console.log('  Watching for changes in src/**/*.purp');
  console.log('  Press Ctrl+C to stop');
  console.log('');

  // In v0.1, we simulate watch mode by doing an initial build
  const { buildCommand } = await import('./build.js');
  await buildCommand(args);

  console.log('');
  console.log('\x1b[36m⟡\x1b[0m File watching requires chokidar (planned for v0.2)');
  console.log('  For now, run \x1b[36mpurp build\x1b[0m after changes.');
}
