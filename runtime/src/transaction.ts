// Purp Runtime — Transaction Builders

export interface InstructionData {
  programId: string;
  keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: Uint8Array;
}

export class InstructionBuilder {
  private programId: string;
  private keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[] = [];
  private data: Uint8Array = new Uint8Array(0);

  constructor(programId: string) {
    this.programId = programId;
  }

  addSigner(pubkey: string, writable: boolean = false): this {
    this.keys.push({ pubkey, isSigner: true, isWritable: writable });
    return this;
  }

  addAccount(pubkey: string, writable: boolean = false): this {
    this.keys.push({ pubkey, isSigner: false, isWritable: writable });
    return this;
  }

  setData(data: Uint8Array): this {
    this.data = data;
    return this;
  }

  build(): InstructionData {
    return { programId: this.programId, keys: [...this.keys], data: this.data };
  }
}

export class TransactionBuilder {
  private instructions: InstructionData[] = [];
  private feePayer?: string;
  private recentBlockhash?: string;

  setFeePayer(payer: string): this {
    this.feePayer = payer;
    return this;
  }

  setRecentBlockhash(blockhash: string): this {
    this.recentBlockhash = blockhash;
    return this;
  }

  addInstruction(ix: InstructionData): this {
    this.instructions.push(ix);
    return this;
  }

  build(): { feePayer?: string; recentBlockhash?: string; instructions: InstructionData[] } {
    return {
      feePayer: this.feePayer,
      recentBlockhash: this.recentBlockhash,
      instructions: [...this.instructions],
    };
  }
}
