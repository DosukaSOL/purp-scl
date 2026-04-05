// Purp Standard Library — Tokens Module
// SPL Token helpers for creating, minting, transferring, and burning tokens
// Works with @solana/spl-token under the hood

export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export interface TokenMintConfig {
  decimals: number;
  mintAuthority: string;
  freezeAuthority?: string;
  initialSupply?: number;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints?: number;
  creators?: { address: string; share: number }[];
}

export interface TokenTransferParams {
  from: string;
  to: string;
  authority: string;
  amount: bigint;
  mint: string;
  decimals: number;
}

export interface TokenMintParams {
  mint: string;
  destination: string;
  authority: string;
  amount: bigint;
}

export interface TokenBurnParams {
  account: string;
  mint: string;
  authority: string;
  amount: bigint;
}

export interface TokenAccountInfo {
  mint: string;
  owner: string;
  amount: bigint;
  delegate: string | null;
  state: 'initialized' | 'frozen' | 'uninitialized';
  isNative: boolean;
  delegatedAmount: bigint;
  closeAuthority: string | null;
}

// ---- Derivation ----

export function deriveAssociatedTokenAddress(wallet: string, mint: string, programId: string = TOKEN_PROGRAM_ID): string {
  // Deterministic derivation: seeds = [wallet, token_program, mint] under ATA program
  // In actual deployment, this is done via findProgramAddressSync
  // Here we provide the seed components for the codegen to use
  return `ata:${wallet}:${mint}:${programId}`;
}

export function deriveAssociatedTokenAddressSeeds(wallet: string, mint: string): Uint8Array[] {
  const encoder = new TextEncoder();
  return [
    encoder.encode(wallet),
    encoder.encode(TOKEN_PROGRAM_ID),
    encoder.encode(mint),
  ];
}

// ---- Amount Utilities ----

export function toTokenAmount(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

export function fromTokenAmount(amount: bigint, decimals: number): number {
  return Number(amount) / Math.pow(10, decimals);
}

export function formatTokenAmount(amount: bigint, decimals: number, symbol?: string): string {
  const num = fromTokenAmount(amount, decimals);
  const formatted = num.toLocaleString(undefined, { maximumFractionDigits: decimals });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

// ---- Instruction Builders (outputs serialized instruction data) ----

/**
 * Build the instruction data for InitializeMint.
 * Token Program instruction index: 0
 */
export function buildInitializeMintData(decimals: number, mintAuthority: string, freezeAuthority?: string): Uint8Array {
  const encoder = new TextEncoder();
  const data: number[] = [0]; // instruction index
  data.push(decimals);
  data.push(...encoder.encode(mintAuthority));
  if (freezeAuthority) {
    data.push(1); // option tag
    data.push(...encoder.encode(freezeAuthority));
  } else {
    data.push(0);
  }
  return new Uint8Array(data);
}

/**
 * Build the instruction data for Transfer.
 * Token Program instruction index: 3
 */
export function buildTransferData(amount: bigint): Uint8Array {
  const data = new Uint8Array(9);
  data[0] = 3; // instruction index
  const view = new DataView(data.buffer);
  view.setBigUint64(1, amount, true);
  return data;
}

/**
 * Build the instruction data for MintTo.
 * Token Program instruction index: 7
 */
export function buildMintToData(amount: bigint): Uint8Array {
  const data = new Uint8Array(9);
  data[0] = 7;
  const view = new DataView(data.buffer);
  view.setBigUint64(1, amount, true);
  return data;
}

/**
 * Build the instruction data for Burn.
 * Token Program instruction index: 8
 */
export function buildBurnData(amount: bigint): Uint8Array {
  const data = new Uint8Array(9);
  data[0] = 8;
  const view = new DataView(data.buffer);
  view.setBigUint64(1, amount, true);
  return data;
}

/**
 * Build the instruction data for CloseAccount.
 * Token Program instruction index: 9
 */
export function buildCloseAccountData(): Uint8Array {
  return new Uint8Array([9]);
}

// ---- Validation ----

export function validateMintConfig(config: TokenMintConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (config.decimals < 0 || config.decimals > 9) errors.push('Decimals must be 0-9');
  if (!config.mintAuthority) errors.push('Mint authority is required');
  if (config.initialSupply !== undefined && config.initialSupply < 0) errors.push('Initial supply cannot be negative');
  return { valid: errors.length === 0, errors };
}

export function validateTransfer(params: TokenTransferParams): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!params.from) errors.push('Source account is required');
  if (!params.to) errors.push('Destination account is required');
  if (!params.authority) errors.push('Authority is required');
  if (params.amount <= 0n) errors.push('Amount must be positive');
  return { valid: errors.length === 0, errors };
}

// ---- Constants ----

export const MINT_SIZE = 82; // bytes
export const ACCOUNT_SIZE = 165; // bytes
export const MULTISIG_SIZE = 355; // bytes

