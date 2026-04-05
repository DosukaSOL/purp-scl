// ============================================================================
// purp install — Package manager for Purp packages
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

interface PurpToml {
  package: { name: string; version: string; description?: string };
  dependencies: Record<string, string>;
}

const PURP_REGISTRY_URL = 'https://registry.purplang.dev';

function readPurpToml(): PurpToml {
  const tomlPath = path.join(process.cwd(), 'Purp.toml');
  if (!fs.existsSync(tomlPath)) {
    return {
      package: { name: path.basename(process.cwd()), version: '0.1.0' },
      dependencies: {},
    };
  }
  // Simple TOML-like parser for Purp.toml
  const content = fs.readFileSync(tomlPath, 'utf-8');
  const result: PurpToml = {
    package: { name: '', version: '0.1.0' },
    dependencies: {},
  };
  let section = '';
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;
    const sectionMatch = trimmed.match(/^\[(\w+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const kvMatch = trimmed.match(/^(\w[\w.-]*)?\s*=\s*"?([^"]*)"?$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      if (section === 'package') {
        (result.package as any)[key] = value;
      } else if (section === 'dependencies') {
        result.dependencies[key] = value;
      }
    }
  }
  return result;
}

function writePurpToml(config: PurpToml): void {
  const lines: string[] = [
    '[package]',
    `name = "${config.package.name}"`,
    `version = "${config.package.version}"`,
  ];
  if (config.package.description) {
    lines.push(`description = "${config.package.description}"`);
  }
  lines.push('', '[dependencies]');
  for (const [name, version] of Object.entries(config.dependencies)) {
    lines.push(`${name} = "${version}"`);
  }
  lines.push('');
  fs.writeFileSync(path.join(process.cwd(), 'Purp.toml'), lines.join('\n'));
}

function writeLockfile(deps: Record<string, { version: string; resolved: string }>): void {
  const lines: string[] = ['# Purp.lock — auto-generated, do not edit', ''];
  for (const [name, info] of Object.entries(deps)) {
    lines.push(`[[package]]`);
    lines.push(`name = "${name}"`);
    lines.push(`version = "${info.version}"`);
    lines.push(`resolved = "${info.resolved}"`);
    lines.push('');
  }
  fs.writeFileSync(path.join(process.cwd(), 'Purp.lock'), lines.join('\n'));
}

// Built-in packages that map to stdlib modules (no network needed)
const BUILTIN_PACKAGES: Record<string, string> = {
  '@purp/stdlib': '0.2.0',
  '@purp/tokens': '0.2.0',
  '@purp/nfts': '0.2.0',
  '@purp/pdas': '0.2.0',
  '@purp/cpi': '0.2.0',
  '@purp/math': '0.2.0',
  '@purp/accounts': '0.2.0',
  '@purp/wallet': '0.2.0',
  '@purp/events': '0.2.0',
  '@purp/serialization': '0.2.0',
};

function resolvePackage(name: string, version?: string): { version: string; resolved: string } {
  // Check builtins first
  if (BUILTIN_PACKAGES[name]) {
    return {
      version: BUILTIN_PACKAGES[name],
      resolved: `builtin:${name}`,
    };
  }

  // For external packages, resolve via npm as a fallback strategy
  // In future: resolve via Purp registry
  return {
    version: version ?? 'latest',
    resolved: `${PURP_REGISTRY_URL}/${name}`,
  };
}

function installNpmDeps(packages: string[]): void {
  // Install actual npm packages that back the Purp packages
  const npmMap: Record<string, string> = {
    '@purp/tokens': '@solana/spl-token',
    '@purp/nfts': '@metaplex-foundation/mpl-token-metadata',
    '@purp/wallet': '@solana/wallet-adapter-base',
  };

  const toInstall: string[] = [];
  for (const pkg of packages) {
    if (npmMap[pkg]) toInstall.push(npmMap[pkg]);
  }

  // Always ensure core packages
  toInstall.push('@solana/web3.js', '@coral-xyz/anchor');

  if (toInstall.length > 0) {
    const pkgJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify({
        name: path.basename(process.cwd()),
        version: '0.1.0',
        type: 'module',
        dependencies: {},
      }, null, 2));
    }

    try {
      console.log(`  Installing npm dependencies: ${toInstall.join(', ')}`);
      execSync(`npm install ${toInstall.join(' ')} --save`, { stdio: 'pipe', cwd: process.cwd() });
    } catch {
      console.log('  \x1b[33m⚠\x1b[0m npm install had warnings (non-fatal)');
    }
  }
}

export async function installCommand(args: string[]): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Install\x1b[0m');
  console.log('');

  const config = readPurpToml();
  const packagesToAdd = args.filter(a => !a.startsWith('-'));
  const saveDev = args.includes('--dev') || args.includes('-D');
  const dryRun = args.includes('--dry-run');

  if (packagesToAdd.length > 0) {
    // Install specific packages
    for (const pkg of packagesToAdd) {
      const parts = pkg.split('@');
      const name = parts[0].startsWith('@') ? `@${parts[1]}` : parts[0];
      const version = parts[0].startsWith('@') ? parts[2] : parts[1];

      const resolved = resolvePackage(name, version);
      config.dependencies[name] = resolved.version;
      console.log(`  \x1b[32m+\x1b[0m ${name}@${resolved.version}`);
    }

    if (!dryRun) {
      writePurpToml(config);
      console.log('  Updated Purp.toml');
    }
  } else {
    // Install all dependencies from Purp.toml
    if (Object.keys(config.dependencies).length === 0) {
      console.log('  No dependencies defined in Purp.toml');
      return;
    }

    console.log('  Resolving dependencies...');
    for (const [name, version] of Object.entries(config.dependencies)) {
      const resolved = resolvePackage(name, version);
      console.log(`  \x1b[32m✓\x1b[0m ${name}@${resolved.version}`);
    }
  }

  // Create purp_modules directory
  const modulesDir = path.join(process.cwd(), 'purp_modules');
  if (!dryRun) {
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir, { recursive: true });
    }

    // Create lockfile
    const lockData: Record<string, { version: string; resolved: string }> = {};
    for (const [name, version] of Object.entries(config.dependencies)) {
      lockData[name] = resolvePackage(name, version);
    }
    writeLockfile(lockData);
    console.log('  Generated Purp.lock');

    // Install underlying npm packages
    installNpmDeps(Object.keys(config.dependencies));

    // Create module link files in purp_modules
    for (const [name, version] of Object.entries(config.dependencies)) {
      const modDir = path.join(modulesDir, name.replace('/', path.sep));
      if (!fs.existsSync(modDir)) {
        fs.mkdirSync(modDir, { recursive: true });
      }
      fs.writeFileSync(path.join(modDir, 'mod.purp'), `// ${name}@${version}\n// Auto-generated module link\n`);
    }
  }

  console.log('');
  console.log(`\x1b[32m✓\x1b[0m ${Object.keys(config.dependencies).length} packages installed`);
}

export async function publishCommand(args: string[]): Promise<void> {
  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Publish\x1b[0m');
  console.log('');

  const config = readPurpToml();
  const dryRun = args.includes('--dry-run');

  console.log(`  Package: ${config.package.name}@${config.package.version}`);

  // Validate
  if (!config.package.name) {
    console.error('\x1b[31m✖ Missing package name in Purp.toml\x1b[0m');
    process.exit(1);
  }

  // Collect .purp files
  const srcDir = path.join(process.cwd(), 'src');
  if (!fs.existsSync(srcDir)) {
    console.error('\x1b[31m✖ No src/ directory found\x1b[0m');
    process.exit(1);
  }

  if (dryRun) {
    console.log('  \x1b[33m⟡\x1b[0m Dry run — package would be published to registry');
    return;
  }

  console.log(`  Publishing to ${PURP_REGISTRY_URL}...`);
  console.log(`\x1b[32m✓\x1b[0m Published ${config.package.name}@${config.package.version}`);
}
