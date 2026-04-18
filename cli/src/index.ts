#!/usr/bin/env node
// ============================================================================
// Purp CLI — The Solana Coding Language
// Developer command-line interface
// ============================================================================

import { parseArgs } from 'node:util';
import { handleCommand } from './commands/index.js';

const VERSION = '1.2.0';

const HELP = `
\x1b[35m██████╗ ██╗   ██╗██████╗ ██████╗
██╔══██╗██║   ██║██╔══██╗██╔══██╗
██████╔╝██║   ██║██████╔╝██████╔╝
██╔═══╝ ██║   ██║██╔══██╗██╔═══╝
██║     ╚██████╔╝██║  ██║██║
╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝\x1b[0m

\x1b[1mPurp v${VERSION}\x1b[0m — The Solana Coding Language

\x1b[1mUSAGE:\x1b[0m
  purp <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[36minit\x1b[0m              Initialize a new Purp project
  \x1b[36mnew\x1b[0m <name>        Create a new Purp project
  \x1b[36mbuild\x1b[0m             Compile Purp to Rust + TypeScript
  \x1b[36mdev\x1b[0m               Start development mode (watch + rebuild)
  \x1b[36mtest\x1b[0m              Run tests
  \x1b[36mcheck\x1b[0m             Type-check without building
  \x1b[36mlint\x1b[0m              Lint Purp source files
  \x1b[36mformat\x1b[0m            Format Purp source files
  \x1b[36mrun\x1b[0m               Run a Purp script
  \x1b[36mdeploy\x1b[0m            Deploy to Solana
  \x1b[36minstall\x1b[0m           Install Purp packages
  \x1b[36mpublish\x1b[0m           Publish a Purp package
  \x1b[36mdoctor\x1b[0m            Check system dependencies
  \x1b[36mgenerate\x1b[0m <type>   Generate boilerplate (instruction, account, etc.)
  \x1b[36mdocs\x1b[0m              Open Purp documentation
  \x1b[36mexample\x1b[0m <name>    Show an example
  \x1b[36maudit\x1b[0m             Security audit your project
  \x1b[36mclean\x1b[0m             Remove build artifacts

\x1b[1mOPTIONS:\x1b[0m
  --version, -v     Show version
  --help, -h        Show help
  --debug           Enable debug output
  --target <t>      Build target: rust, typescript, both (default: both)

\x1b[1mEXAMPLES:\x1b[0m
  purp new my-token
  purp build --target rust
  purp dev
  purp deploy --network devnet

\x1b[35mhttps://purplang.dev\x1b[0m
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`purp v${VERSION}`);
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    await handleCommand(command, commandArgs);
  } catch (err: any) {
    console.error(`\x1b[31m✖ Error:\x1b[0m ${err.message}`);
    if (commandArgs.includes('--debug')) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
