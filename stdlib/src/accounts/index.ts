// Purp Standard Library — Accounts Module
// Helpers for Solana account operations

export interface AccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface AccountInfo {
  pubkey: string;
  lamports: number;
  owner: string;
  data: Uint8Array;
  executable: boolean;
  rentEpoch: number;
}

export function createAccountMeta(pubkey: string, isSigner: boolean, isWritable: boolean): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

export function calculateSpace(fields: { type: string; size: number }[]): number {
  // 8 bytes for discriminator
  let space = 8;
  for (const field of fields) {
    space += field.size;
  }
  return space;
}

export function calculateRent(space: number, lamportsPerByte: number = 6960): number {
  return space * lamportsPerByte + 2_039_280; // minimum rent-exempt balance approximation
}

export const ACCOUNT_DISCRIMINATOR_SIZE = 8;
export const PUBKEY_SIZE = 32;
export const U64_SIZE = 8;
export const U128_SIZE = 16;
export const BOOL_SIZE = 1;
export const STRING_PREFIX_SIZE = 4;
