// ============================================================================
// purp deploy — Deploy to Solana
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

interface DeployConfig {
  network: string;
  programId?: string;
  keypair?: string;
  skipBuild: boolean;
  upgrade: boolean;
  dryRun: boolean;
}

function parseArgs(args: string[]): DeployConfig {
  const config: DeployConfig = {
    network: 'devnet',
    skipBuild: false,
    upgrade: false,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--network' || arg === '-n') config.network = args[++i] ?? 'devnet';
    else if (arg === '--program-id') config.programId = args[++i];
    else if (arg === '--keypair' || arg === '-k') config.keypair = args[++i];
    else if (arg === '--skip-build') config.skipBuild = true;
    else if (arg === '--upgrade') config.upgrade = true;
    else if (arg === '--dry-run') config.dryRun = true;
  }
  return config;
}

function checkTool(name: string): boolean {
  try {
    execSync(`which ${name}`, { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function ensureTargetDir(): void {
  const rustDir = path.join(process.cwd(), 'target', 'rust');
  if (!fs.existsSync(rustDir)) {
    fs.mkdirSync(rustDir, { recursive: true });
  }
}

function createAnchorToml(network: string, programId?: string): string {
  const cluster = network === 'mainnet' ? 'mainnet-beta' : network;
  const id = programId ?? 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS';
  return `[features]
seeds = false
skip-lint = false

[programs.${cluster}]
purp_program = "${id}"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "${cluster}"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
`;
}

export async function deployCommand(args: string[]): Promise<void> {
  const config = parseArgs(args);

  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Deploy\x1b[0m');
  console.log(`  Network:    ${config.network}`);
  console.log(`  Upgrade:    ${config.upgrade}`);
  console.log(`  Dry run:    ${config.dryRun}`);
  console.log('');

  // Step 1: Check dependencies
  const hasSolana = checkTool('solana');
  const hasAnchor = checkTool('anchor');
  const hasCargo = checkTool('cargo');

  if (!hasSolana) {
    console.error('\x1b[31m✖ Solana CLI not found.\x1b[0m Install: sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"');
    process.exit(1);
  }
  if (!hasAnchor) {
    console.error('\x1b[31m✖ Anchor CLI not found.\x1b[0m Install: cargo install --git https://github.com/coral-xyz/anchor avm --locked');
    process.exit(1);
  }
  if (!hasCargo) {
    console.error('\x1b[31m✖ Cargo not found.\x1b[0m Install Rust: https://rustup.rs');
    process.exit(1);
  }

  console.log('\x1b[32m✓\x1b[0m Dependencies verified (solana, anchor, cargo)');

  // Step 2: Set Solana cluster
  try {
    const cluster = config.network === 'mainnet' ? 'mainnet-beta' : config.network;
    execSync(`solana config set --url ${cluster}`, { stdio: 'pipe' });
    console.log(`\x1b[32m✓\x1b[0m Solana cluster set to ${cluster}`);
  } catch (e: any) {
    console.error(`\x1b[31m✖ Failed to set cluster: ${e.message}\x1b[0m`);
    process.exit(1);
  }

  // Step 3: Compile Purp → Rust
  if (!config.skipBuild) {
    console.log('\x1b[36m⟡\x1b[0m Compiling Purp → Rust...');
    const { buildCommand } = await import('./build.js');
    await buildCommand(['--target', 'rust']);
    console.log('\x1b[32m✓\x1b[0m Compilation complete');
  }

  // Step 4: Ensure Anchor project structure
  ensureTargetDir();
  const targetDir = path.join(process.cwd(), 'target', 'rust');

  // Write Anchor.toml if missing
  const anchorToml = path.join(targetDir, 'Anchor.toml');
  if (!fs.existsSync(anchorToml)) {
    fs.writeFileSync(anchorToml, createAnchorToml(config.network, config.programId));
    console.log('\x1b[32m✓\x1b[0m Generated Anchor.toml');
  }

  // Write Cargo.toml if missing
  const cargoToml = path.join(targetDir, 'Cargo.toml');
  if (!fs.existsSync(cargoToml)) {
    fs.writeFileSync(cargoToml, `[workspace]
members = ["programs/*"]
resolver = "2"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
`);
    console.log('\x1b[32m✓\x1b[0m Generated Cargo.toml');
  }

  if (config.dryRun) {
    console.log('');
    console.log('\x1b[33m⟡\x1b[0m Dry run — skipping actual deployment.');
    console.log('  Generated files are in target/rust/');
    console.log('  Run without --dry-run to deploy.');
    return;
  }

  // Step 5: Run Anchor build + deploy
  console.log('\x1b[36m⟡\x1b[0m Running Anchor build...');
  const buildResult = spawnSync('anchor', ['build'], { cwd: targetDir, stdio: 'inherit' });
  if (buildResult.status !== 0) {
    console.error('\x1b[31m✖ Anchor build failed.\x1b[0m');
    console.log('  Check the generated Rust code in target/rust/');
    process.exit(1);
  }
  console.log('\x1b[32m✓\x1b[0m Anchor build succeeded');

  const deployArgs = config.upgrade ? ['upgrade'] : ['deploy'];
  if (config.keypair) deployArgs.push('--provider.wallet', config.keypair);

  console.log(`\x1b[36m⟡\x1b[0m Deploying to ${config.network}...`);
  const deployResult = spawnSync('anchor', deployArgs, { cwd: targetDir, stdio: 'inherit' });
  if (deployResult.status !== 0) {
    console.error(`\x1b[31m✖ Deployment failed.\x1b[0m`);
    process.exit(1);
  }

  console.log('');
  console.log(`\x1b[32m✓\x1b[0m \x1b[1mProgram deployed to ${config.network}!\x1b[0m`);
  console.log(`  View on Solana Explorer: https://explorer.solana.com?cluster=${config.network}`);
}

