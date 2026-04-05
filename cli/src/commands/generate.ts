// ============================================================================
// purp generate — Code generation scaffolding
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';

const TEMPLATES: Record<string, string> = {
  instruction: `pub instruction {{name}}(
  signer payer,
  #[mut] account data
) {
  // TODO: implement
}
`,
  account: `account {{Name}} {
  authority: pubkey,
  data: u64,
  created_at: i64
}
`,
  event: `event {{Name}}Event {
  user: pubkey,
  timestamp: i64
}
`,
  error: `error {{Name}}Error {
  Unauthorized = "Not authorized",
  InvalidInput = "Invalid input provided",
  AccountNotFound = "Account not found"
}
`,
  token: `// Token mint instruction
pub instruction create_{{name}}(
  #[mut] signer payer,
  #[init] mint token_mint
) {
  // Initialize mint with 9 decimals
  token_mint.decimals = 9;
  token_mint.authority = payer;
}
`,
  nft: `// NFT mint instruction
pub instruction mint_{{name}}(
  #[mut] signer creator,
  #[init] mint nft_mint,
  #[init] account metadata
) {
  nft_mint.decimals = 0;
  nft_mint.supply = 1;
  metadata.name = "My NFT";
  metadata.uri = "https://example.com/metadata.json";
}
`,
};

export async function generateCommand(args: string[]): Promise<void> {
  const type = args[0];
  const name = args[1];

  if (!type) {
    console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Generate\x1b[0m');
    console.log('');
    console.log('  Available generators:');
    for (const key of Object.keys(TEMPLATES)) {
      console.log(`    \x1b[36m${key}\x1b[0m`);
    }
    console.log('');
    console.log('  Usage: \x1b[36mpurp generate <type> <name>\x1b[0m');
    return;
  }

  const template = TEMPLATES[type];
  if (!template) {
    console.error(`\x1b[31m✖ Unknown generator: ${type}\x1b[0m`);
    console.log('  Available:', Object.keys(TEMPLATES).join(', '));
    return;
  }

  const itemName = name ?? type;
  const pascalName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
  const code = template
    .replace(/\{\{name\}\}/g, itemName)
    .replace(/\{\{Name\}\}/g, pascalName);

  const outDir = 'src';
  const outFile = path.join(outDir, `${itemName}.purp`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  if (fs.existsSync(outFile)) {
    // Append to existing file
    fs.appendFileSync(outFile, '\n' + code, 'utf-8');
    console.log(`\x1b[32m✓\x1b[0m Appended ${type} '${itemName}' to ${outFile}`);
  } else {
    fs.writeFileSync(outFile, code, 'utf-8');
    console.log(`\x1b[32m✓\x1b[0m Created ${outFile}`);
  }
}
