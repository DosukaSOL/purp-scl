// Purp Standard Library — Tokens Module
// SPL Token helpers

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

export function deriveAssociatedTokenAddress(wallet: string, mint: string): string {
  // Placeholder — actual derivation requires PDA calculation
  return `ata:${wallet}:${mint}`;
}

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
