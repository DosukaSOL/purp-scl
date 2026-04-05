// ============================================================================
// purp deploy — Deploy to Solana
// ============================================================================

export async function deployCommand(args: string[]): Promise<void> {
  const network = args.find((a, i) => args[i - 1] === '--network') ?? 'devnet';

  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Deploy\x1b[0m');
  console.log(`  Network: ${network}`);
  console.log('');

  // Build first
  const { buildCommand } = await import('./build.js');
  await buildCommand(['--target', 'rust']);

  console.log('');
  console.log('\x1b[36m⟡\x1b[0m Deploy Integration');
  console.log('  To deploy the generated Rust program:');
  console.log('');
  console.log('  1. cd target/rust');
  console.log('  2. anchor build');
  console.log(`  3. anchor deploy --provider.cluster ${network}`);
  console.log('');
  console.log('  Full deploy integration coming in v0.2');
}
