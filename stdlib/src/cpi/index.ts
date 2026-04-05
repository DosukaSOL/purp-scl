// Purp Standard Library — CPI Module
// Cross-Program Invocation helpers

export interface CPIContext {
  program: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: Uint8Array;
}

export interface CPIResult {
  success: boolean;
  logs?: string[];
  error?: string;
}

export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
export const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const RENT_PROGRAM_ID = 'SysvarRent111111111111111111111111111111111';
export const CLOCK_PROGRAM_ID = 'SysvarC1ock11111111111111111111111111111111';

export function buildTransferCPI(from: string, to: string, lamports: number): CPIContext {
  return {
    program: SYSTEM_PROGRAM_ID,
    accounts: [
      { pubkey: from, isSigner: true, isWritable: true },
      { pubkey: to, isSigner: false, isWritable: true },
    ],
    data: new Uint8Array([2, 0, 0, 0, ...numberToLE(lamports, 8)]), // SystemInstruction::Transfer
  };
}

function numberToLE(value: number, bytes: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < bytes; i++) {
    result.push(value & 0xff);
    value = Math.floor(value / 256);
  }
  return result;
}
