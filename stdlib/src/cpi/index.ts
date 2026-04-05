// Purp Standard Library — CPI Module
// Cross-Program Invocation helpers for composable Solana programs

export interface AccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface CPIContext {
  program: string;
  accounts: AccountMeta[];
  data: Uint8Array;
  signerSeeds?: Uint8Array[][];  // PDA signer seeds for invoke_signed
}

export interface CPIResult {
  success: boolean;
  logs?: string[];
  returnData?: Uint8Array;
  error?: string;
  computeUnitsConsumed?: number;
}

// ---- Well-Known Program IDs ----

export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
export const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const RENT_PROGRAM_ID = 'SysvarRent111111111111111111111111111111111';
export const CLOCK_PROGRAM_ID = 'SysvarC1ock11111111111111111111111111111111';
export const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

// ---- Account Meta Builders ----

export function writable(pubkey: string, isSigner = false): AccountMeta {
  return { pubkey, isSigner, isWritable: true };
}

export function readonly(pubkey: string, isSigner = false): AccountMeta {
  return { pubkey, isSigner, isWritable: false };
}

export function signer(pubkey: string, isWritable = true): AccountMeta {
  return { pubkey, isSigner: true, isWritable };
}

// ---- CPI Context Builder ----

export class CPIBuilder {
  private programId: string;
  private accountsList: AccountMeta[] = [];
  private instructionData: Uint8Array = new Uint8Array(0);
  private pdaSeeds: Uint8Array[][] = [];

  constructor(programId: string) {
    this.programId = programId;
  }

  addAccount(meta: AccountMeta): this {
    this.accountsList.push(meta);
    return this;
  }

  addWritable(pubkey: string, isSigner = false): this {
    return this.addAccount(writable(pubkey, isSigner));
  }

  addReadonly(pubkey: string, isSigner = false): this {
    return this.addAccount(readonly(pubkey, isSigner));
  }

  addSigner(pubkey: string, isWritable = true): this {
    return this.addAccount(signer(pubkey, isWritable));
  }

  setData(data: Uint8Array): this {
    this.instructionData = data;
    return this;
  }

  addSignerSeeds(seeds: Uint8Array[]): this {
    this.pdaSeeds.push(seeds);
    return this;
  }

  build(): CPIContext {
    return {
      program: this.programId,
      accounts: [...this.accountsList],
      data: this.instructionData,
      ...(this.pdaSeeds.length > 0 ? { signerSeeds: this.pdaSeeds } : {}),
    };
  }
}

// ---- Common CPI Instructions ----

export function buildTransferCPI(from: string, to: string, lamports: number | bigint): CPIContext {
  const amount = typeof lamports === 'bigint' ? lamports : BigInt(lamports);
  return new CPIBuilder(SYSTEM_PROGRAM_ID)
    .addSigner(from)
    .addWritable(to)
    .setData(new Uint8Array([2, 0, 0, 0, ...bigintToLE(amount, 8)]))
    .build();
}

export function buildCreateAccountCPI(
  payer: string,
  newAccount: string,
  lamports: number | bigint,
  space: number,
  owner: string
): CPIContext {
  const amount = typeof lamports === 'bigint' ? lamports : BigInt(lamports);
  const data = new Uint8Array(4 + 8 + 8 + 32);
  data.set([0, 0, 0, 0]); // SystemInstruction::CreateAccount
  const view = new DataView(data.buffer);
  view.setBigUint64(4, amount, true);
  view.setBigUint64(12, BigInt(space), true);
  data.set(new TextEncoder().encode(owner.slice(0, 32)), 20);
  return new CPIBuilder(SYSTEM_PROGRAM_ID)
    .addSigner(payer)
    .addSigner(newAccount)
    .setData(data)
    .build();
}

export function buildTokenTransferCPI(
  source: string,
  destination: string,
  authority: string,
  amount: bigint
): CPIContext {
  return new CPIBuilder(SPL_TOKEN_PROGRAM_ID)
    .addWritable(source)
    .addWritable(destination)
    .addSigner(authority, false)
    .setData(new Uint8Array([3, ...bigintToLE(amount, 8)]))
    .build();
}

export function buildMintToCPI(
  mint: string,
  destination: string,
  authority: string,
  amount: bigint
): CPIContext {
  return new CPIBuilder(SPL_TOKEN_PROGRAM_ID)
    .addWritable(mint)
    .addWritable(destination)
    .addSigner(authority, false)
    .setData(new Uint8Array([7, ...bigintToLE(amount, 8)]))
    .build();
}

export function buildMemoCPI(message: string): CPIContext {
  return new CPIBuilder(MEMO_PROGRAM_ID)
    .setData(new TextEncoder().encode(message))
    .build();
}

// ---- Utilities ----

function bigintToLE(value: bigint, bytes: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < bytes; i++) {
    result.push(Number(value & 0xffn));
    value = value >> 8n;
  }
  return result;
}

export function validateCPIContext(ctx: CPIContext): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!ctx.program) errors.push('Program ID is required');
  if (ctx.accounts.length === 0) errors.push('At least one account is required');
  if (ctx.accounts.length > 32) errors.push('Maximum 32 accounts per instruction');
  if (ctx.data.length > 1232) errors.push('Instruction data exceeds maximum size (1232 bytes)');
  const signerCount = ctx.accounts.filter(a => a.isSigner).length;
  if (signerCount === 0) errors.push('At least one signer is typically required');
  return { valid: errors.length === 0, errors };
}
