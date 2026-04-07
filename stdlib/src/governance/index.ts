// Purp Standard Library — Governance / DAO Module
// On-chain governance primitives for DAOs on Solana

import { checkedMul, checkedDiv, checkedAdd } from '../math/index.js';

// ============================================================================
// Constants
// ============================================================================

export const SPL_GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVRs6muVjhRQnR5a7fR2g6';
export const SQUADS_PROGRAM_ID = 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu';

// ============================================================================
// Core Types
// ============================================================================

export type VoteType = 'single-choice' | 'multiple-choice' | 'weighted' | 'quadratic' | 'conviction';
export type ProposalState = 'draft' | 'active' | 'succeeded' | 'defeated' | 'queued' | 'executed' | 'cancelled' | 'expired';
export type VoteChoice = 'for' | 'against' | 'abstain';

export interface GovernanceConfig {
  name: string;
  votingPeriod: bigint;        // Duration in slots
  cooldownPeriod: bigint;      // Delay before execution (slots)
  quorumBps: number;           // Minimum participation (basis points)
  approvalThresholdBps: number;// % of 'for' votes to pass (basis points)
  minTokensToPropose: bigint;  // Minimum token balance to create proposal
  voteType: VoteType;
  maxVotingTime: bigint;       // Max voting duration (slots)
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  state: ProposalState;
  votesFor: bigint;
  votesAgainst: bigint;
  votesAbstain: bigint;
  startSlot: bigint;
  endSlot: bigint;
  executionSlot?: bigint;
  instructions: ProposalInstruction[];
  createdAt: bigint;
}

export interface ProposalInstruction {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: Uint8Array;
}

export interface Vote {
  voter: string;
  proposal: string;
  choice: VoteChoice;
  weight: bigint;
  timestamp: bigint;
}

export interface TreasuryConfig {
  authority: string;
  guardians: string[];
  threshold: number;        // Multi-sig threshold (e.g., 3 of 5)
  spendingLimit: bigint;    // Max per-proposal spend
  cooldownPeriod: bigint;
}

// ============================================================================
// Vote Weight Calculation
// ============================================================================

/**
 * Calculate token-weighted vote power (1 token = 1 vote).
 */
export function tokenWeightedVote(tokenBalance: bigint): bigint {
  return tokenBalance;
}

/**
 * Calculate quadratic vote weight (1 token = 1 vote, 4 tokens = 2 votes, etc.).
 */
export function quadraticVoteWeight(tokenBalance: bigint): bigint {
  return sqrt(tokenBalance);
}

/**
 * Calculate conviction-weighted vote power.
 * Longer lock = more power (1x for no lock, up to maxMultiplier for max lock).
 */
export function convictionVoteWeight(
  tokenBalance: bigint,
  lockDuration: bigint,
  maxLockDuration: bigint,
  maxMultiplier: bigint = 6n,
): bigint {
  if (lockDuration >= maxLockDuration) {
    return checkedMul(tokenBalance, maxMultiplier);
  }
  const multiplier = checkedAdd(1n, checkedDiv(checkedMul(lockDuration, maxMultiplier - 1n), maxLockDuration));
  return checkedMul(tokenBalance, multiplier);
}

/**
 * Calculate vote weight based on governance config.
 */
export function calculateVoteWeight(
  config: GovernanceConfig,
  tokenBalance: bigint,
  lockDuration: bigint = 0n,
  maxLockDuration: bigint = 0n,
): bigint {
  switch (config.voteType) {
    case 'quadratic':
      return quadraticVoteWeight(tokenBalance);
    case 'conviction':
      return convictionVoteWeight(tokenBalance, lockDuration, maxLockDuration);
    default:
      return tokenWeightedVote(tokenBalance);
  }
}

// ============================================================================
// Proposal Lifecycle
// ============================================================================

/**
 * Create a new proposal.
 */
export function createProposal(
  id: string,
  title: string,
  description: string,
  proposer: string,
  config: GovernanceConfig,
  currentSlot: bigint,
  instructions: ProposalInstruction[] = [],
): Proposal {
  return {
    id,
    title,
    description,
    proposer,
    state: 'active',
    votesFor: 0n,
    votesAgainst: 0n,
    votesAbstain: 0n,
    startSlot: currentSlot,
    endSlot: currentSlot + config.votingPeriod,
    instructions,
    createdAt: currentSlot,
  };
}

/**
 * Check if voting is still open for a proposal.
 */
export function isVotingOpen(proposal: Proposal, currentSlot: bigint): boolean {
  return proposal.state === 'active' && currentSlot <= proposal.endSlot;
}

/**
 * Calculate total votes cast on a proposal.
 */
export function totalVotes(proposal: Proposal): bigint {
  return checkedAdd(checkedAdd(proposal.votesFor, proposal.votesAgainst), proposal.votesAbstain);
}

/**
 * Check if a proposal has reached quorum.
 */
export function hasQuorum(proposal: Proposal, totalSupply: bigint, quorumBps: number): boolean {
  const total = totalVotes(proposal);
  const required = checkedDiv(checkedMul(totalSupply, BigInt(quorumBps)), 10_000n);
  return total >= required;
}

/**
 * Check if a proposal has passed (quorum + threshold met).
 */
export function hasPassed(proposal: Proposal, totalSupply: bigint, config: GovernanceConfig): boolean {
  if (!hasQuorum(proposal, totalSupply, config.quorumBps)) return false;
  const votedTotal = checkedAdd(proposal.votesFor, proposal.votesAgainst);
  if (votedTotal === 0n) return false;
  const approvalBps = checkedDiv(checkedMul(proposal.votesFor, 10_000n), votedTotal);
  return approvalBps >= BigInt(config.approvalThresholdBps);
}

/**
 * Resolve proposal state after voting ends.
 */
export function resolveProposal(
  proposal: Proposal,
  totalSupply: bigint,
  config: GovernanceConfig,
  currentSlot: bigint,
): ProposalState {
  if (proposal.state === 'cancelled') return 'cancelled';
  if (currentSlot <= proposal.endSlot) return 'active';
  if (currentSlot > proposal.endSlot + config.maxVotingTime) return 'expired';
  if (hasPassed(proposal, totalSupply, config)) {
    if (config.cooldownPeriod > 0n && currentSlot < proposal.endSlot + config.cooldownPeriod) {
      return 'queued';
    }
    return 'succeeded';
  }
  return 'defeated';
}

// ============================================================================
// Treasury
// ============================================================================

/**
 * Validate a treasury spend proposal.
 */
export function validateTreasurySpend(
  amount: bigint,
  treasuryBalance: bigint,
  config: TreasuryConfig,
): { valid: boolean; reason?: string } {
  if (amount > treasuryBalance) return { valid: false, reason: 'Insufficient treasury balance' };
  if (amount > config.spendingLimit) return { valid: false, reason: `Exceeds spending limit of ${config.spendingLimit}` };
  return { valid: true };
}

/**
 * Check if a multi-sig threshold is met.
 */
export function isThresholdMet(signatures: string[], guardians: string[], threshold: number): boolean {
  const validSigners = signatures.filter(s => guardians.includes(s));
  return validSigners.length >= threshold;
}

// ============================================================================
// Utilities
// ============================================================================

function sqrt(value: bigint): bigint {
  if (value <= 0n) return 0n;
  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + value / x) / 2n; }
  return x;
}

/**
 * Format a proposal state for display.
 */
export function formatProposalState(state: ProposalState): string {
  const labels: Record<ProposalState, string> = {
    draft: '📝 Draft',
    active: '🗳️ Active',
    succeeded: '✅ Succeeded',
    defeated: '❌ Defeated',
    queued: '⏳ Queued',
    executed: '🚀 Executed',
    cancelled: '🚫 Cancelled',
    expired: '⌛ Expired',
  };
  return labels[state];
}

/**
 * Default governance config for common DAO types.
 */
export const DAO_PRESETS = {
  standard: {
    votingPeriod: 216_000n,     // ~3 days at 2 slots/sec
    cooldownPeriod: 43_200n,    // ~12 hours
    quorumBps: 1000,            // 10%
    approvalThresholdBps: 5000, // 50%
    minTokensToPropose: 1_000n,
    voteType: 'single-choice' as VoteType,
    maxVotingTime: 604_800n,    // 7 days
  },
  multisig: {
    votingPeriod: 86_400n,
    cooldownPeriod: 0n,
    quorumBps: 10000,
    approvalThresholdBps: 6000,
    minTokensToPropose: 1n,
    voteType: 'single-choice' as VoteType,
    maxVotingTime: 259_200n,
  },
  quadratic: {
    votingPeriod: 432_000n,
    cooldownPeriod: 86_400n,
    quorumBps: 500,
    approvalThresholdBps: 5000,
    minTokensToPropose: 100n,
    voteType: 'quadratic' as VoteType,
    maxVotingTime: 864_000n,
  },
} as const;
