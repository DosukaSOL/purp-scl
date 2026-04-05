// Purp Standard Library — Math Module
// Math utilities for Solana programs

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const MAX_U64 = BigInt('18446744073709551615');
export const MAX_U128 = BigInt('340282366920938463463374607431768211455');

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
  if (result < a) throw new Error('Arithmetic overflow');
  return result;
}

export function checkedSub(a: bigint, b: bigint): bigint {
  if (b > a) throw new Error('Arithmetic underflow');
  return a - b;
}

export function checkedMul(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const result = a * b;
  if (result / a !== b) throw new Error('Arithmetic overflow');
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
