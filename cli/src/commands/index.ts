// ============================================================================
// Purp CLI Commands Router
// ============================================================================

import { buildCommand } from './build.js';
import { initCommand, newCommand } from './init.js';
import { devCommand } from './dev.js';
import { checkCommand } from './check.js';
import { doctorCommand } from './doctor.js';
import { generateCommand } from './generate.js';
import { cleanCommand } from './clean.js';
import { auditCommand } from './audit.js';
import { testCommand } from './test.js';
import { runCommand } from './run.js';
import { deployCommand } from './deploy.js';
import { lintCommand } from './lint.js';
import { formatCommand } from './format.js';
import { installCommand, publishCommand } from './install.js';

export async function handleCommand(command: string, args: string[]): Promise<void> {
  const debug = args.includes('--debug');

  switch (command) {
    case 'init':
      return initCommand(args);
    case 'new':
      return newCommand(args);
    case 'build':
      return buildCommand(args);
    case 'dev':
      return devCommand(args);
    case 'test':
      return testCommand(args);
    case 'check':
      return checkCommand(args);
    case 'lint':
      return lintCommand(args);
    case 'format':
      return formatCommand(args);
    case 'run':
      return runCommand(args);
    case 'deploy':
      return deployCommand(args);
    case 'install':
      return installCommand(args);
    case 'publish':
      return publishCommand(args);
    case 'doctor':
      return doctorCommand();
    case 'generate':
      return generateCommand(args);
    case 'docs': {
      console.log('\x1b[36m⟡\x1b[0m Purp Documentation');
      console.log('');
      console.log('  Website:       https://purplang.dev/docs');
      console.log('  GitHub:        https://github.com/DosukaSOL/purp-scl');
      console.log('');
      console.log('  Quick Reference:');
      console.log('    purp init              Create a new Purp project');
      console.log('    purp build             Compile .purp → Rust + TypeScript');
      console.log('    purp test              Run test blocks');
      console.log('    purp run <file>        Compile and execute a .purp file');
      console.log('    purp deploy            Deploy to Solana (devnet/mainnet)');
      console.log('    purp dev               Watch mode with auto-rebuild');
      console.log('    purp check             Type-check without compiling');
      console.log('    purp lint              Lint .purp files');
      console.log('    purp format            Format .purp files');
      console.log('    purp generate <type>   Generate boilerplate code');
      console.log('    purp install <pkg>     Install a Purp package');
      console.log('    purp publish           Publish package to registry');
      console.log('    purp audit             Security audit');
      console.log('    purp doctor            Check development dependencies');
      console.log('    purp clean             Remove build artifacts');
      console.log('');
      break;
    }
    case 'example': {
      const name = args[0];
      const examples: Record<string, string> = {
        'hello-world': `program HelloWorld {
  instruction greet(message: string) {
    account signer: Signer
    msg("Hello: ", message)
  }
}`,
        'token': `program MyToken {
  account TokenMeta {
    name: string
    symbol: string
    supply: u64
    decimals: u8
  }
  instruction mint(amount: u64) {
    account signer: Signer
    account #[init, payer = signer] token: Account<TokenMeta>
    token.supply += amount
    emit MintEvent { to: signer.key(), amount }
  }
  event MintEvent { to: pubkey, amount: u64 }
}`,
        'nft': `program NftCollection {
  account NFT {
    owner: pubkey
    name: string
    uri: string
    minted: bool
  }
  instruction mint_nft(name: string, uri: string) {
    account signer: Signer
    account #[init, payer = signer, space = 256] nft: Account<NFT>
    nft.owner = signer.key()
    nft.name = name
    nft.uri = uri
    nft.minted = true
  }
}`,
        'counter': `program Counter {
  account CounterState { count: u64 }
  instruction increment() {
    account signer: Signer
    account #[mut] counter: Account<CounterState>
    counter.count += 1
    msg("Count is now: ", counter.count)
  }
}`,
      };

      if (!name) {
        console.log('\x1b[36m⟡\x1b[0m Available examples:');
        console.log('');
        for (const key of Object.keys(examples)) {
          console.log(`    purp example ${key}`);
        }
        console.log('');
      } else if (examples[name]) {
        console.log(`\x1b[35m⟡\x1b[0m Example: ${name}`);
        console.log('');
        console.log(examples[name]);
        console.log('');
      } else {
        console.error(`\x1b[31mUnknown example: ${name}\x1b[0m`);
        console.log('Available:', Object.keys(examples).join(', '));
      }
      break;
    }
    case 'audit':
      return auditCommand(args);
    case 'clean':
      return cleanCommand();
    default:
      console.error(`\x1b[31mUnknown command: ${command}\x1b[0m`);
      console.log('Run \x1b[36mpurp --help\x1b[0m for usage information.');
      process.exit(1);
  }
}
