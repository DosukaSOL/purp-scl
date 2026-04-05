// Purp Standard Library — AI Module
// AI agent hooks and scaffolding for Solana x AI apps

export interface AIAgentConfig {
  name: string;
  model?: string;
  walletAddress?: string;
  capabilities: string[];
}

export interface AIAction {
  type: 'transfer' | 'swap' | 'mint' | 'query' | 'custom';
  params: Record<string, unknown>;
  requiresSignature: boolean;
}

export function createAgentConfig(name: string, capabilities: string[]): AIAgentConfig {
  return { name, capabilities };
}

export function validateAction(action: AIAction): { valid: boolean; reason?: string } {
  if (!action.type) return { valid: false, reason: 'Action type is required' };
  if (!action.params) return { valid: false, reason: 'Action params are required' };
  return { valid: true };
}

export function formatActionDescription(action: AIAction): string {
  return `[AI Action] ${action.type}: ${JSON.stringify(action.params)}${action.requiresSignature ? ' (requires signature)' : ''}`;
}
