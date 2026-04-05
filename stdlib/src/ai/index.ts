// Purp Standard Library — AI Module
// AI agent hooks, tool definitions, and Solana x AI integration

// ---- Types ----

export interface AIAgentConfig {
  name: string;
  model: string;
  walletAddress?: string;
  capabilities: AICapability[];
  maxActionsPerTurn?: number;
  requireApproval?: boolean;
  systemPrompt?: string;
}

export type AICapability = 'transfer' | 'swap' | 'mint' | 'burn' | 'query' | 'stake' | 'vote' | 'nft' | 'defi' | 'custom';

export interface AIAction {
  id: string;
  type: AICapability;
  params: Record<string, unknown>;
  requiresSignature: boolean;
  estimatedCost?: number;  // in lamports
  description: string;
}

export interface AIActionResult {
  actionId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  txSignature?: string;
  timestamp: number;
}

export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
  handler: string;  // function name to call
}

export interface AIConversation {
  messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string }[];
  agentConfig: AIAgentConfig;
  actionHistory: AIActionResult[];
}

// ---- Agent Config ----

export function createAgentConfig(
  name: string,
  capabilities: AICapability[],
  options: Partial<AIAgentConfig> = {}
): AIAgentConfig {
  return {
    name,
    model: options.model ?? 'gpt-4',
    capabilities,
    maxActionsPerTurn: options.maxActionsPerTurn ?? 5,
    requireApproval: options.requireApproval ?? true,
    walletAddress: options.walletAddress,
    systemPrompt: options.systemPrompt,
  };
}

// ---- Action Validation ----

export function validateAction(action: AIAction, config: AIAgentConfig): { valid: boolean; reason?: string } {
  if (!action.type) return { valid: false, reason: 'Action type is required' };
  if (!action.params) return { valid: false, reason: 'Action params are required' };
  if (!action.description) return { valid: false, reason: 'Action description is required' };
  if (!config.capabilities.includes(action.type)) {
    return { valid: false, reason: `Agent does not have '${action.type}' capability` };
  }
  return { valid: true };
}

export function createAction(
  type: AICapability,
  params: Record<string, unknown>,
  description: string,
  requiresSignature: boolean = true
): AIAction {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    params,
    requiresSignature,
    description,
  };
}

// ---- Tool Definitions (for function-calling LLMs) ----

export const SOLANA_TOOLS: AITool[] = [
  {
    name: 'transfer_sol',
    description: 'Transfer SOL from the agent wallet to a recipient',
    parameters: {
      type: 'object',
      properties: {
        recipient: { type: 'string', description: 'Recipient wallet address (base58)' },
        amount: { type: 'number', description: 'Amount in SOL' },
      },
      required: ['recipient', 'amount'],
    },
    handler: 'handleTransferSol',
  },
  {
    name: 'get_balance',
    description: 'Get the SOL balance of a wallet address',
    parameters: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address to check' },
      },
      required: ['address'],
    },
    handler: 'handleGetBalance',
  },
  {
    name: 'get_token_balance',
    description: 'Get the token balance of a wallet for a specific mint',
    parameters: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address' },
        mint: { type: 'string', description: 'Token mint address' },
      },
      required: ['address', 'mint'],
    },
    handler: 'handleGetTokenBalance',
  },
  {
    name: 'transfer_token',
    description: 'Transfer SPL tokens from agent wallet to a recipient',
    parameters: {
      type: 'object',
      properties: {
        recipient: { type: 'string', description: 'Recipient wallet address' },
        mint: { type: 'string', description: 'Token mint address' },
        amount: { type: 'number', description: 'Amount in token units' },
      },
      required: ['recipient', 'mint', 'amount'],
    },
    handler: 'handleTransferToken',
  },
  {
    name: 'swap_tokens',
    description: 'Swap tokens using Jupiter or Raydium',
    parameters: {
      type: 'object',
      properties: {
        inputMint: { type: 'string', description: 'Input token mint address' },
        outputMint: { type: 'string', description: 'Output token mint address' },
        amount: { type: 'number', description: 'Amount of input token' },
        slippage: { type: 'number', description: 'Slippage tolerance in basis points' },
      },
      required: ['inputMint', 'outputMint', 'amount'],
    },
    handler: 'handleSwapTokens',
  },
  {
    name: 'get_transaction',
    description: 'Get details of a transaction by signature',
    parameters: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'Transaction signature' },
      },
      required: ['signature'],
    },
    handler: 'handleGetTransaction',
  },
];

export function getToolsForCapabilities(capabilities: AICapability[]): AITool[] {
  const capabilityToolMap: Record<AICapability, string[]> = {
    transfer: ['transfer_sol'],
    query: ['get_balance', 'get_token_balance', 'get_transaction'],
    swap: ['swap_tokens'],
    mint: [],
    burn: [],
    stake: [],
    vote: [],
    nft: [],
    defi: ['swap_tokens'],
    custom: [],
  };
  const toolNames = new Set<string>();
  for (const cap of capabilities) {
    for (const name of capabilityToolMap[cap] ?? []) toolNames.add(name);
  }
  // Always include query tools
  for (const name of capabilityToolMap.query) toolNames.add(name);
  return SOLANA_TOOLS.filter(t => toolNames.has(t.name));
}

// ---- System Prompt Generation ----

export function generateSystemPrompt(config: AIAgentConfig): string {
  const base = config.systemPrompt ?? `You are ${config.name}, a Solana AI agent.`;
  const caps = config.capabilities.join(', ');
  const approval = config.requireApproval
    ? 'Always describe what you plan to do and wait for user approval before executing transactions.'
    : 'You may execute transactions autonomously within your capabilities.';
  return `${base}

Capabilities: ${caps}
Max actions per turn: ${config.maxActionsPerTurn}
${config.walletAddress ? `Agent wallet: ${config.walletAddress}` : ''}
${approval}

Always validate addresses before sending transactions. Never send more than requested. Explain fees and risks.`;
}

// ---- Formatting ----

export function formatActionDescription(action: AIAction): string {
  return `[${action.id}] ${action.type}: ${action.description}${action.requiresSignature ? ' (requires signature)' : ''}`;
}

export function formatActionResult(result: AIActionResult): string {
  const status = result.success ? '✓' : '✗';
  const sig = result.txSignature ? ` | tx: ${result.txSignature.slice(0, 8)}...` : '';
  const err = result.error ? ` | error: ${result.error}` : '';
  return `[${status}] ${result.actionId}${sig}${err}`;
}

// ---- Conversation ----

export function createConversation(config: AIAgentConfig): AIConversation {
  return {
    messages: [{ role: 'system', content: generateSystemPrompt(config) }],
    agentConfig: config,
    actionHistory: [],
  };
}

export function addUserMessage(convo: AIConversation, message: string): void {
  convo.messages.push({ role: 'user', content: message });
}

export function addAssistantMessage(convo: AIConversation, message: string): void {
  convo.messages.push({ role: 'assistant', content: message });
}

export function addActionResult(convo: AIConversation, result: AIActionResult): void {
  convo.actionHistory.push(result);
  convo.messages.push({
    role: 'tool',
    content: JSON.stringify(result),
    toolCallId: result.actionId,
  });
}
