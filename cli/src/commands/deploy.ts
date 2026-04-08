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

function createCargoToml(programName: string): string {
  return `[package]
name = "${programName}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]

[dependencies]
pinocchio = "0.10"
pinocchio-token = "0.5"
pinocchio-system = "0.4"
borsh = "0.10"
pinocchio-log = "0.4"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
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
  const hasCargo = checkTool('cargo');
  const hasBuildSbf = checkTool('cargo-build-sbf');

  if (!hasSolana) {
    console.error('\x1b[31m✖ Solana CLI not found.\x1b[0m Install: sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"');
    process.exit(1);
  }
  if (!hasCargo) {
    console.error('\x1b[31m✖ Cargo not found.\x1b[0m Install Rust: https://rustup.rs');
    process.exit(1);
  }
  if (!hasBuildSbf) {
    console.error('\x1b[31m✖ cargo-build-sbf not found.\x1b[0m Install Solana CLI tools: sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"');
    process.exit(1);
  }

  console.log('\x1b[32m✓\x1b[0m Dependencies verified (solana, cargo, cargo-build-sbf)');

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

  // Step 4: Ensure project structure
  ensureTargetDir();
  const targetDir = path.join(process.cwd(), 'target', 'rust');

  // Write Cargo.toml if missing
  const cargoToml = path.join(targetDir, 'Cargo.toml');
  if (!fs.existsSync(cargoToml)) {
    const programName = path.basename(process.cwd()).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    fs.writeFileSync(cargoToml, createCargoToml(programName));
    console.log('\x1b[32m✓\x1b[0m Generated Cargo.toml (Pinocchio)');
  }

  if (config.dryRun) {
    console.log('');
    console.log('\x1b[33m⟡\x1b[0m Dry run — skipping actual deployment.');
    console.log('  Generated files are in target/rust/');
    console.log('  Run without --dry-run to deploy.');
    return;
  }

  // Step 5: Build with cargo-build-sbf
  console.log('\x1b[36m⟡\x1b[0m Running cargo-build-sbf...');
  const buildResult = spawnSync('cargo-build-sbf', [], { cwd: targetDir, stdio: 'inherit' });
  if (buildResult.status !== 0) {
    console.error('\x1b[31m✖ cargo-build-sbf failed.\x1b[0m');
    console.log('  Check the generated Rust code in target/rust/');
    process.exit(1);
  }
  console.log('\x1b[32m✓\x1b[0m Build succeeded');

  // Step 6: Deploy with solana program deploy
  const deployDir = path.join(targetDir, 'target', 'deploy');
  const programName = path.basename(process.cwd()).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const soPath = path.join(deployDir, `${programName}.so`);

  if (!fs.existsSync(soPath)) {
    // Fallback: find any .so file in the deploy dir
    const soFiles = fs.existsSync(deployDir) ? fs.readdirSync(deployDir).filter(f => f.endsWith('.so')) : [];
    if (soFiles.length === 0) {
      console.error('\x1b[31m✖ No .so file found in target/deploy/\x1b[0m');
      process.exit(1);
    }
  }

  const deployArgs = ['program', config.upgrade ? 'upgrade' : 'deploy', soPath];

  if (config.keypair) deployArgs.push('--keypair', config.keypair);
  if (config.programId && config.upgrade) deployArgs.push(config.programId);

  console.log(`\x1b[36m⟡\x1b[0m Deploying to ${config.network}...`);
  const deployResult = spawnSync('solana', deployArgs, { cwd: targetDir, stdio: 'inherit' });
  if (deployResult.status !== 0) {
    console.error(`\x1b[31m✖ Deployment failed.\x1b[0m`);
    process.exit(1);
  }

  console.log('');
  console.log(`\x1b[32m✓\x1b[0m \x1b[1mProgram deployed to ${config.network}!\x1b[0m`);
  console.log(`  View on Solana Explorer: https://explorer.solana.com?cluster=${config.network}`);
}

