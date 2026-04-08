// Purp Standard Library — Math Module
// Math utilities for Solana programs

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const MAX_U64 = BigInt('18446744073709551615');
export const MAX_U128 = BigInt('340282366920938463463374607431768211455');

// Solana runtime constants (from official docs)
export const MAX_TRANSACTION_SIZE = 1232;           // bytes (IPv6 MTU - headers)
export const MAX_ACCOUNTS_PER_TX = 64;              // accounts per transaction
export const BLOCKHASH_EXPIRY_SLOTS = 150;          // slots until blockhash expires
export const BASE_FEE_PER_SIGNATURE = 5000;         // lamports
export const DEFAULT_CU_PER_INSTRUCTION = 200_000;  // compute units
export const MAX_CU_PER_TX = 1_400_000;             // compute units
export const MICRO_LAMPORTS_PER_LAMPORT = 1_000_000;
export const MAX_SEED_LENGTH = 32;                  // bytes per PDA seed
export const MAX_SEEDS = 16;                        // max seeds per PDA
export const MAX_ACCOUNT_DATA_SIZE = 10_485_760;    // 10 MiB
export const DISCRIMINATOR_SIZE = 8;               // bytes (alias for account discriminator)
export const SLOTS_PER_SEC = 2;                     // approximate (~400ms slots)

/**
 * Calculate the rent-exempt minimum for an account.
 * Formula: (data_size + 128) * 3480 * 2
 * Source: Solana docs - Accounts - Rent-exempt minimum
 */
export function rentExemptMinimum(dataSize: number): bigint {
  return (BigInt(dataSize) + 128n) * 3480n * 2n;
}

/**
 * Calculate account space: 8 byte discriminator + data fields.
 */
export function accountSpace(dataSize: number): number {
  return DISCRIMINATOR_SIZE + dataSize;
}

/**
 * Calculate priority fee in lamports.
 * Formula: ceil(computeUnitPrice * computeUnitLimit / 1_000_000)
 */
export function calculatePriorityFee(computeUnitPrice: bigint, computeUnitLimit: bigint): bigint {
  const microLamports = computeUnitPrice * computeUnitLimit;
  return (microLamports + BigInt(MICRO_LAMPORTS_PER_LAMPORT - 1)) / BigInt(MICRO_LAMPORTS_PER_LAMPORT);
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
}

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

export function basisPointsToPercent(bp: number): number {
  return bp / 100;
}

export function percentToBasisPoints(percent: number): number {
  return Math.floor(percent * 100);
}

export function checkedAdd(a: bigint, b: bigint): bigint {
  const result = a + b;
  if (result > MAX_U64) throw new Error('Arithmetic overflow');
  if (result < 0n) throw new Error('Arithmetic underflow');
  return result;
}

export function checkedSub(a: bigint, b: bigint): bigint {
  if (b > a) throw new Error('Arithmetic underflow');
  return a - b;
}

export function checkedMul(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const result = a * b;
  if (result > MAX_U64) throw new Error('Arithmetic overflow');
  if (result < 0n) throw new Error('Arithmetic underflow');
  return result;
}

export function checkedDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('Division by zero');
  return a / b;
}

export function proportionalAmount(amount: bigint, numerator: bigint, denominator: bigint): bigint {
  return checkedDiv(checkedMul(amount, numerator), denominator);
}

export function clamp(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
