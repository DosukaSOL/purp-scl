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
      console.log('\x1b[36m⟡\x1b[0m Linting... (not yet implemented in v0.1)');
      break;
    case 'format':
      console.log('\x1b[36m⟡\x1b[0m Formatting... (not yet implemented in v0.1)');
      break;
    case 'run':
      return runCommand(args);
    case 'deploy':
      return deployCommand(args);
    case 'doctor':
      return doctorCommand();
    case 'generate':
      return generateCommand(args);
    case 'docs':
      console.log('\x1b[36m⟡\x1b[0m Opening docs → https://purplang.dev/docs');
      break;
    case 'example': {
      const name = args[0] ?? 'hello-world';
      console.log(`\x1b[36m⟡\x1b[0m Loading example: ${name}`);
      console.log('  See /examples directory for all examples.');
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
