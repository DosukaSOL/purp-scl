// ============================================================================
// purp init / purp new — Project scaffolding
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir } from '../utils/index.js';

const PURP_TOML = (name: string) => `# Purp Project Configuration
# https://purplang.dev/docs/config

[project]
name = "${name}"
version = "0.1.0"
description = ""
authors = []
license = "MIT"

[build]
source = "src"
output = "target"
target = "both"     # rust | typescript | both

[solana]
cluster = "devnet"  # devnet | testnet | mainnet-beta
program_id = ""

[dependencies]
# purp-std = "0.1"

[scripts]
build = "purp build"
test = "purp test"
deploy = "purp deploy"
`;

const HELLO_PURP = `// My First Purp Program
// Learn more at https://purplang.dev

program HelloPurp {

  account GreetingAccount {
    count: u64,
    message: string
  }

  pub instruction initialize(
    #[mut] signer payer,
    #[init] account greeting
  ) {
    greeting.count = 0;
    greeting.message = "Hello, Purp!";
  }

  pub instruction greet(
    signer user,
    #[mut] account greeting
  ) {
    greeting.count += 1;
    emit GreetEvent(user, greeting.count);
  }

  event GreetEvent {
    user: pubkey,
    count: u64
  }
}
`;

const GITIGNORE = `# Purp build output
target/
dist/
node_modules/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Solana
test-ledger/
*.so

# Keys — NEVER commit
*.json
!package.json
!purp.toml
!tsconfig.json
`;

export async function initCommand(args: string[]): Promise<void> {
  const name = path.basename(process.cwd());
  console.log(`\x1b[35m⟡\x1b[0m \x1b[1mInitializing Purp project: ${name}\x1b[0m`);

  scaffold(process.cwd(), name);

  console.log('');
  console.log('\x1b[32m✓ Project initialized!\x1b[0m');
  console.log('');
  console.log('  Next steps:');
  console.log('    \x1b[36mpurp build\x1b[0m        Compile your project');
  console.log('    \x1b[36mpurp dev\x1b[0m          Start dev mode');
  console.log('    \x1b[36mpurp doctor\x1b[0m       Check dependencies');
}

export async function newCommand(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error('\x1b[31m✖ Please provide a project name:\x1b[0m purp new <name>');
    process.exit(1);
  }

  const projectDir = path.resolve(process.cwd(), name);
  if (fs.existsSync(projectDir)) {
    console.error(`\x1b[31m✖ Directory '${name}' already exists\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[35m⟡\x1b[0m \x1b[1mCreating new Purp project: ${name}\x1b[0m`);

  fs.mkdirSync(projectDir, { recursive: true });
  scaffold(projectDir, name);

  console.log('');
  console.log('\x1b[32m✓ Project created!\x1b[0m');
  console.log('');
  console.log(`  cd ${name}`);
  console.log('  purp build');
}

function scaffold(dir: string, name: string): void {
  ensureDir(path.join(dir, 'src'));
  ensureDir(path.join(dir, 'tests'));
  ensureDir(path.join(dir, 'target'));

  writeIfMissing(path.join(dir, 'purp.toml'), PURP_TOML(name));
  writeIfMissing(path.join(dir, 'src', 'main.purp'), HELLO_PURP);
  writeIfMissing(path.join(dir, '.gitignore'), GITIGNORE);
  writeIfMissing(path.join(dir, '.env.example'), '# Solana Configuration\n# NEVER commit real keys!\n\nSOLANA_CLUSTER=devnet\n# WALLET_PATH=~/.config/solana/id.json\n');
  writeIfMissing(path.join(dir, 'README.md'), `# ${name}\n\nA Purp project. Built with [Purp — The Solana Coding Language](https://purplang.dev).\n\n## Build\n\n\`\`\`bash\npurp build\n\`\`\`\n`);

  console.log('  Created src/main.purp');
  console.log('  Created purp.toml');
  console.log('  Created .gitignore');
  console.log('  Created .env.example');
}

function writeIfMissing(filePath: string, content: string): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
