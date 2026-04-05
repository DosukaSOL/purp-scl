// Purp Standard Library — PDAs Module
// Program Derived Address helpers

export interface PDADerivation {
  seeds: (string | Uint8Array | number[])[];
  programId: string;
  address?: string;
  bump?: number;
}

export function encodeSeed(value: string | number | Uint8Array): Uint8Array {
  if (typeof value === 'string') {
    return new TextEncoder().encode(value);
  }
  if (typeof value === 'number') {
    const buf = new Uint8Array(8);
    const view = new DataView(buf.buffer);
    view.setBigUint64(0, BigInt(value), true); // little-endian
    return buf;
  }
  return value;
}

export function formatSeeds(seeds: (string | number | Uint8Array)[]): string {
  return seeds.map(s => {
    if (typeof s === 'string') return `b"${s}"`;
    if (typeof s === 'number') return `${s}.to_le_bytes()`;
    return `[${Array.from(s).join(', ')}]`;
  }).join(', ');
}

export function pdaDescription(name: string, seeds: string[], programId: string): string {
  return `PDA "${name}" derived from seeds [${seeds.join(', ')}] under program ${programId}`;
}
