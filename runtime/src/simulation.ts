// Purp Runtime — Simulation Engine
// Simulates Solana transactions locally for testing and compute estimation

export interface SimulationResult {
  success: boolean;
  logs: string[];
  unitsConsumed: number;
  error?: string;
  accountChanges: AccountDelta[];
  fee: number;
}

export interface AccountDelta {
  pubkey: string;
  lamportsBefore: number;
  lamportsAfter: number;
  dataBefore: Uint8Array | null;
  dataAfter: Uint8Array | null;
}

export interface SimulatedAccount {
  pubkey: string;
  lamports: number;
  owner: string;
  data: Uint8Array;
  executable: boolean;
}

export interface SimulationInstruction {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: Uint8Array;
}

const SYSTEM_PROGRAM = '11111111111111111111111111111111';

export class SimulationEngine {
  private logs: string[] = [];
  private accounts: Map<string, SimulatedAccount> = new Map();
  private time: number = Date.now();

  /** Preload accounts into the simulation environment */
  setAccount(pubkey: string, account: SimulatedAccount): void {
    this.accounts.set(pubkey, { ...account });
  }

  /** Set the simulated clock time */
  setClock(unixTimestamp: number): void {
    this.time = unixTimestamp;
  }

  /** Simulate a single instruction */
  simulate(instruction: SimulationInstruction): SimulationResult {
    this.logs = [];
    const changes: AccountDelta[] = [];
    let unitsConsumed = 0;

    this.log(`Program ${instruction.programId} invoke [1]`);

    // Validate signers
    for (const acc of instruction.accounts) {
      if (acc.isSigner && !this.accounts.has(acc.pubkey)) {
        // Create a default signer account
        this.accounts.set(acc.pubkey, {
          pubkey: acc.pubkey,
          lamports: 1_000_000_000, // 1 SOL default
          owner: SYSTEM_PROGRAM,
          data: new Uint8Array(0),
          executable: false,
        });
      }
    }

    // Simulate based on program
    try {
      if (instruction.programId === SYSTEM_PROGRAM) {
        unitsConsumed += this.simulateSystemProgram(instruction, changes);
      } else {
        // Generic program — estimate compute
        unitsConsumed += this.estimateFromInstruction(instruction);
        this.log(`Program ${instruction.programId} success`);

        // Record account changes for writable accounts
        for (const acc of instruction.accounts) {
          if (acc.isWritable) {
            const before = this.accounts.get(acc.pubkey);
            changes.push({
              pubkey: acc.pubkey,
              lamportsBefore: before?.lamports ?? 0,
              lamportsAfter: before?.lamports ?? 0,
              dataBefore: before?.data ?? null,
              dataAfter: before?.data ?? null,
            });
          }
        }
      }

      const fee = this.calculateFee(unitsConsumed);
      this.log(`Compute units consumed: ${unitsConsumed}`);

      return {
        success: true,
        logs: [...this.logs],
        unitsConsumed,
        accountChanges: changes,
        fee,
      };
    } catch (e: any) {
      this.log(`Program ${instruction.programId} failed: ${e.message}`);
      return {
        success: false,
        logs: [...this.logs],
        unitsConsumed,
        error: e.message,
        accountChanges: changes,
        fee: 0,
      };
    }
  }

  /** Simulate a full transaction (multiple instructions) */
  simulateTransaction(instructions: SimulationInstruction[], feePayer: string): SimulationResult {
    this.logs = [];
    let totalUnits = 0;
    const allChanges: AccountDelta[] = [];

    for (let i = 0; i < instructions.length; i++) {
      const result = this.simulate(instructions[i]);
      totalUnits += result.unitsConsumed;
      allChanges.push(...result.accountChanges);

      if (!result.success) {
        return {
          success: false,
          logs: [...this.logs, ...result.logs],
          unitsConsumed: totalUnits,
          error: `Instruction ${i} failed: ${result.error}`,
          accountChanges: allChanges,
          fee: 0,
        };
      }
    }

    const fee = this.calculateFee(totalUnits);

    // Deduct fee from fee payer
    const payer = this.accounts.get(feePayer);
    if (payer) {
      if (payer.lamports < fee) {
        return {
          success: false,
          logs: [...this.logs],
          unitsConsumed: totalUnits,
          error: 'Insufficient lamports for transaction fee',
          accountChanges: allChanges,
          fee,
        };
      }
      payer.lamports -= fee;
    }

    return {
      success: true,
      logs: [...this.logs],
      unitsConsumed: totalUnits,
      accountChanges: allChanges,
      fee,
    };
  }

  private simulateSystemProgram(ix: SimulationInstruction, changes: AccountDelta[]): number {
    if (ix.data.length < 4) {
      throw new Error('Invalid system instruction data');
    }

    const instruction = ix.data[0]; // instruction index byte

    switch (instruction) {
      case 2: { // Transfer
        const from = ix.accounts[0];
        const to = ix.accounts[1];
        const lamports = this.readU64LE(ix.data, 4);

        const fromAcc = this.accounts.get(from.pubkey);
        const toAcc = this.accounts.get(to.pubkey) ?? {
          pubkey: to.pubkey, lamports: 0, owner: SYSTEM_PROGRAM,
          data: new Uint8Array(0), executable: false,
        };

        if (!fromAcc || fromAcc.lamports < lamports) {
          throw new Error('insufficient lamports');
        }

        const fromBefore = fromAcc.lamports;
        const toBefore = toAcc.lamports;

        fromAcc.lamports -= lamports;
        toAcc.lamports += lamports;
        this.accounts.set(to.pubkey, toAcc);

        changes.push(
          { pubkey: from.pubkey, lamportsBefore: fromBefore, lamportsAfter: fromAcc.lamports, dataBefore: null, dataAfter: null },
          { pubkey: to.pubkey, lamportsBefore: toBefore, lamportsAfter: toAcc.lamports, dataBefore: null, dataAfter: null }
        );

        this.log(`Transfer: ${lamports} lamports from ${from.pubkey} to ${to.pubkey}`);
        this.log('Program 11111111111111111111111111111111 success');
        return 150;
      }
      case 0: { // CreateAccount
        const lamports = this.readU64LE(ix.data, 4);
        const space = this.readU64LE(ix.data, 12);
        this.log(`CreateAccount: ${space} bytes, ${lamports} lamports`);
        this.log('Program 11111111111111111111111111111111 success');
        return 300;
      }
      default:
        this.log(`System instruction ${instruction}`);
        this.log('Program 11111111111111111111111111111111 success');
        return 150;
    }
  }

  private estimateFromInstruction(ix: SimulationInstruction): number {
    // Base cost + per-account cost + data cost
    const base = 25_000;
    const perAccount = 5_000 * ix.accounts.length;
    const dataOverhead = ix.data.length * 10;
    const writableCost = ix.accounts.filter(a => a.isWritable).length * 10_000;
    return base + perAccount + dataOverhead + writableCost;
  }

  private calculateFee(computeUnits: number, priorityFee: number = 0): number {
    // Base fee: 5000 lamports per signature + priority fee
    return 5000 + Math.ceil(computeUnits * 0.000001 * 1_000_000_000) * 0 + priorityFee;
  }

  private readU64LE(data: Uint8Array, offset: number): number {
    let value = 0;
    for (let i = 0; i < 8 && offset + i < data.length; i++) {
      value += data[offset + i] * Math.pow(256, i);
    }
    return value;
  }

  private log(message: string): void {
    this.logs.push(`[SIM] ${message}`);
  }

  /** Estimate compute units for a program based on complexity */
  estimateComputeUnits(complexity: 'low' | 'medium' | 'high'): number {
    return { low: 25_000, medium: 150_000, high: 600_000 }[complexity];
  }

  /** Estimate transaction fee */
  estimateFee(numInstructions: number, priorityFee: number = 0): number {
    return 5000 * numInstructions + priorityFee;
  }

  /** Get account balance */
  getBalance(pubkey: string): number {
    return this.accounts.get(pubkey)?.lamports ?? 0;
  }

  /** Airdrop lamports (for testing) */
  airdrop(pubkey: string, lamports: number): void {
    const acc = this.accounts.get(pubkey) ?? {
      pubkey, lamports: 0, owner: SYSTEM_PROGRAM,
      data: new Uint8Array(0), executable: false,
    };
    acc.lamports += lamports;
    this.accounts.set(pubkey, acc);
  }
}

