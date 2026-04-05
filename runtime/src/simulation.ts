// Purp Runtime — Simulation Engine

export interface SimulationResult {
  success: boolean;
  logs: string[];
  unitsConsumed: number;
  error?: string;
}

export class SimulationEngine {
  private logs: string[] = [];

  simulate(instruction: string, accounts: string[]): SimulationResult {
    this.logs = [];
    this.log(`Simulating instruction: ${instruction}`);
    this.log(`Accounts: ${accounts.join(', ')}`);
    this.log('Simulation complete (v0.1 placeholder)');
    return { success: true, logs: [...this.logs], unitsConsumed: 200_000 };
  }

  private log(message: string): void { this.logs.push(`[SIM] ${message}`); }

  estimateComputeUnits(complexity: 'low' | 'medium' | 'high'): number {
    return { low: 50_000, medium: 200_000, high: 800_000 }[complexity];
  }

  estimateFee(numInstructions: number, priorityFee: number = 0): number {
    return 5000 * numInstructions + priorityFee;
  }
}
