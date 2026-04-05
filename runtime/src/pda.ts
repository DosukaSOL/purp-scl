// Purp Runtime — PDA Helpers

export class PDAHelper {
  static formatSeeds(seeds: (string | Uint8Array | number)[]): string[] {
    return seeds.map(seed => {
      if (typeof seed === 'string') return `Buffer.from("${seed}")`;
      if (typeof seed === 'number') return `new BN(${seed}).toArrayLike(Buffer, "le", 8)`;
      return `Buffer.from([${Array.from(seed).join(', ')}])`;
    });
  }

  static generateDerivation(programId: string, seeds: string[]): string {
    const seedsStr = seeds.join(',\n      ');
    return `const [pda, bump] = PublicKey.findProgramAddressSync(\n    [\n      ${seedsStr}\n    ],\n    new PublicKey("${programId}")\n  );`;
  }

  static validateSeeds(seeds: Uint8Array[]): { valid: boolean; error?: string } {
    if (seeds.length > 16) return { valid: false, error: 'PDA cannot have more than 16 seeds' };
    for (let i = 0; i < seeds.length; i++) {
      if (seeds[i].length > 32) return { valid: false, error: `Seed ${i} exceeds 32 bytes` };
    }
    return { valid: true };
  }
}
