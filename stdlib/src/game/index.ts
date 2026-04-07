// Purp Standard Library — Game Module
// On-chain game primitives: state machines, VRF, turns, clock, inventory

// ============================================================================
// Core Types
// ============================================================================

export type GamePhase = 'lobby' | 'starting' | 'active' | 'paused' | 'finished' | 'cancelled';
export type TurnState = 'waiting' | 'acting' | 'resolved';

export interface GameState {
  gameId: string;
  players: string[];
  status: GamePhase;
  round: number;
  maxPlayers: number;
  minPlayers: number;
  currentTurn: number;
  currentPlayer: string;
  turnTimeout: bigint;       // Max seconds per turn
  lastActionTime: bigint;
  data: Record<string, unknown>;
}

export interface PlayerState {
  address: string;
  score: number;
  lives: number;
  inventory: InventoryItem[];
  stats: Record<string, number>;
  joinedAt: bigint;
  lastActive: bigint;
  data: Record<string, unknown>;
}

export interface InventoryItem {
  id: string;
  name: string;
  itemType: 'weapon' | 'armor' | 'consumable' | 'material' | 'key' | 'cosmetic' | 'currency';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  quantity: number;
  equipped: boolean;
  durability?: number;
  maxDurability?: number;
  attributes: Record<string, number>;
  tradeable: boolean;
  nftMint?: string;          // If backed by an NFT
}

export interface Cooldown {
  action: string;
  lastUsed: bigint;
  duration: bigint;          // In seconds
}

// ============================================================================
// Game State Machine
// ============================================================================

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  lobby: ['starting', 'cancelled'],
  starting: ['active', 'cancelled'],
  active: ['paused', 'finished', 'cancelled'],
  paused: ['active', 'cancelled'],
  finished: [],
  cancelled: [],
};

/**
 * Create a new game in lobby state.
 */
export function createGameState(
  gameId: string,
  creator: string,
  config: { maxPlayers?: number; minPlayers?: number; turnTimeout?: bigint } = {},
): GameState {
  return {
    gameId,
    players: [creator],
    status: 'lobby',
    round: 0,
    maxPlayers: config.maxPlayers ?? 4,
    minPlayers: config.minPlayers ?? 2,
    currentTurn: 0,
    currentPlayer: creator,
    turnTimeout: config.turnTimeout ?? 60n,
    lastActionTime: 0n,
    data: {},
  };
}

/**
 * Transition game to a new phase (validates allowed transitions).
 */
export function transitionPhase(state: GameState, newPhase: GamePhase): GameState {
  const allowed = VALID_TRANSITIONS[state.status];
  if (!allowed.includes(newPhase)) {
    throw new Error(`Invalid transition: ${state.status} → ${newPhase}`);
  }
  return { ...state, status: newPhase };
}

/**
 * Check if a phase transition is valid.
 */
export function canTransition(currentPhase: GamePhase, targetPhase: GamePhase): boolean {
  return VALID_TRANSITIONS[currentPhase].includes(targetPhase);
}

/**
 * Add a player to the game (lobby phase only).
 */
export function addPlayer(state: GameState, player: string): GameState {
  if (state.status !== 'lobby') throw new Error('Can only join during lobby phase');
  if (state.players.length >= state.maxPlayers) throw new Error('Game is full');
  if (state.players.includes(player)) return state;
  return { ...state, players: [...state.players, player] };
}

/**
 * Remove a player from the game.
 */
export function removePlayer(state: GameState, player: string): GameState {
  return { ...state, players: state.players.filter(p => p !== player) };
}

/**
 * Check if enough players to start.
 */
export function canStart(state: GameState): boolean {
  return state.status === 'lobby' && state.players.length >= state.minPlayers;
}

// ============================================================================
// Turn-Based Logic
// ============================================================================

/**
 * Advance to the next turn, cycling through players.
 */
export function nextTurn(state: GameState, currentTime: bigint): GameState {
  const nextIdx = (state.currentTurn + 1) % state.players.length;
  const newRound = nextIdx === 0 ? state.round + 1 : state.round;
  return {
    ...state,
    currentTurn: nextIdx,
    currentPlayer: state.players[nextIdx],
    round: newRound,
    lastActionTime: currentTime,
  };
}

/**
 * Check if the current player's turn has timed out.
 */
export function isTurnTimedOut(state: GameState, currentTime: bigint): boolean {
  if (state.lastActionTime === 0n) return false;
  return (currentTime - state.lastActionTime) > state.turnTimeout;
}

/**
 * Validate that a player is the current player and it's their turn.
 */
export function validateTurn(state: GameState, player: string): boolean {
  return state.status === 'active' && state.currentPlayer === player;
}

// ============================================================================
// Leaderboard / Scoring
// ============================================================================

/**
 * Calculate leaderboard sorted by score.
 */
export function calculateLeaderboard(players: PlayerState[]): PlayerState[] {
  return [...players].sort((a, b) => b.score - a.score);
}

/**
 * Calculate ELO rating change after a match.
 * K-factor determines rating sensitivity.
 */
export function eloRatingChange(
  winnerRating: number,
  loserRating: number,
  kFactor: number = 32,
  isDraw: boolean = false,
): { winnerDelta: number; loserDelta: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;
  const actualWinner = isDraw ? 0.5 : 1;
  const actualLoser = isDraw ? 0.5 : 0;
  return {
    winnerDelta: Math.round(kFactor * (actualWinner - expectedWinner)),
    loserDelta: Math.round(kFactor * (actualLoser - expectedLoser)),
  };
}

// ============================================================================
// Inventory System
// ============================================================================

/**
 * Add an item to player inventory.
 */
export function addItem(player: PlayerState, item: InventoryItem): PlayerState {
  const existing = player.inventory.find(i => i.id === item.id && !i.nftMint);
  if (existing && item.itemType !== 'key') {
    // Stack stackable items
    return {
      ...player,
      inventory: player.inventory.map(i =>
        i.id === item.id && !i.nftMint ? { ...i, quantity: i.quantity + item.quantity } : i
      ),
    };
  }
  return { ...player, inventory: [...player.inventory, item] };
}

/**
 * Remove an item (or quantity) from player inventory.
 */
export function removeItem(player: PlayerState, itemId: string, quantity: number = 1): PlayerState {
  const existing = player.inventory.find(i => i.id === itemId);
  if (!existing) throw new Error(`Item '${itemId}' not found in inventory`);
  if (existing.quantity < quantity) throw new Error(`Insufficient quantity: have ${existing.quantity}, need ${quantity}`);
  return {
    ...player,
    inventory: player.inventory
      .map(i => i.id === itemId ? { ...i, quantity: i.quantity - quantity } : i)
      .filter(i => i.quantity > 0),
  };
}

/**
 * Equip an item (marks it as equipped, unequips conflicting items of same type).
 */
export function equipItem(player: PlayerState, itemId: string): PlayerState {
  const item = player.inventory.find(i => i.id === itemId);
  if (!item) throw new Error('Item not found');
  if (item.itemType === 'consumable' || item.itemType === 'material') {
    throw new Error('Cannot equip consumables or materials');
  }
  return {
    ...player,
    inventory: player.inventory.map(i => {
      if (i.id === itemId) return { ...i, equipped: true };
      if (i.equipped && i.itemType === item.itemType) return { ...i, equipped: false };
      return i;
    }),
  };
}

/**
 * Check if player has a specific item.
 */
export function hasItem(player: PlayerState, itemId: string, quantity: number = 1): boolean {
  const item = player.inventory.find(i => i.id === itemId);
  return item !== undefined && item.quantity >= quantity;
}

/**
 * Calculate total stat bonuses from equipped items.
 */
export function equippedStats(player: PlayerState): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const item of player.inventory.filter(i => i.equipped)) {
    for (const [key, value] of Object.entries(item.attributes)) {
      stats[key] = (stats[key] ?? 0) + value;
    }
  }
  return stats;
}

/**
 * Apply durability wear to equipped items.
 */
export function wearEquipment(player: PlayerState, wearAmount: number = 1): PlayerState {
  return {
    ...player,
    inventory: player.inventory.map(i => {
      if (!i.equipped || i.durability === undefined) return i;
      const newDurability = Math.max(0, i.durability - wearAmount);
      return {
        ...i,
        durability: newDurability,
        equipped: newDurability > 0 ? i.equipped : false, // Auto-unequip broken items
      };
    }),
  };
}

// ============================================================================
// Cooldown System
// ============================================================================

/**
 * Check if a cooldown has expired.
 */
export function isCooldownReady(cooldown: Cooldown, currentTime: bigint): boolean {
  return (currentTime - cooldown.lastUsed) >= cooldown.duration;
}

/**
 * Get remaining cooldown time in seconds.
 */
export function cooldownRemaining(cooldown: Cooldown, currentTime: bigint): bigint {
  const elapsed = currentTime - cooldown.lastUsed;
  if (elapsed >= cooldown.duration) return 0n;
  return cooldown.duration - elapsed;
}

/**
 * Reset a cooldown after use.
 */
export function resetCooldown(cooldown: Cooldown, currentTime: bigint): Cooldown {
  return { ...cooldown, lastUsed: currentTime };
}

// ============================================================================
// VRF / Randomness
// ============================================================================

export const SWITCHBOARD_VRF_PROGRAM_ID = 'SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f';

/**
 * Generate a deterministic seed from on-chain data (slot hash + pubkey + nonce).
 * This is NOT cryptographically secure — use VRF for real randomness.
 */
export function deterministicSeed(slotHash: string, pubkey: string, nonce: number): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${slotHash}:${pubkey}:${nonce}`);
  // Simple hash (FNV-1a) — for display only; on-chain uses slot_hashes
  let hash = 0x811c9dc5;
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  const result = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    result[i] = (hash >> (i % 4) * 8) & 0xff;
    hash = Math.imul(hash, 0x01000193) ^ i;
  }
  return result;
}

/**
 * Get a random number in range from a seed (0 to max-1).
 */
export function randomFromSeed(seed: Uint8Array, max: number): number {
  const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
  const value = Number(view.getBigUint64(0, true));
  return value % max;
}

/**
 * Shuffle an array using Fisher-Yates with a deterministic seed.
 */
export function shuffleWithSeed<T>(array: T[], seed: Uint8Array): T[] {
  const result = [...array];
  const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
  for (let i = result.length - 1; i > 0; i--) {
    const byteIdx = (i * 8) % seed.byteLength;
    const j = Number(view.getBigUint64(byteIdx % (seed.byteLength - 7), true)) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Roll dice with a deterministic seed.
 */
export function rollDice(seed: Uint8Array, sides: number = 6, count: number = 1): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i * 8) % (seed.byteLength - 7);
    const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
    results.push(Number(view.getBigUint64(offset, true)) % sides + 1);
  }
  return results;
}

// ============================================================================
// Rarity / Loot Tables
// ============================================================================

export interface LootEntry {
  item: InventoryItem;
  weight: number;           // Relative drop weight
}

/**
 * Select a random item from a loot table using weighted selection.
 */
export function rollLootTable(table: LootEntry[], seed: Uint8Array): InventoryItem {
  const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);
  const roll = randomFromSeed(seed, totalWeight);
  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.weight;
    if (roll < cumulative) return entry.item;
  }
  return table[table.length - 1].item;
}

/**
 * Rarity drop rates (standard gacha-style).
 */
export const RARITY_WEIGHTS = {
  common: 5000,
  uncommon: 2500,
  rare: 1500,
  epic: 700,
  legendary: 250,
  mythic: 50,
} as const;

// ============================================================================
// Clock / Time Helpers
// ============================================================================

/**
 * Estimate Solana slot from a wall clock time.
 * Solana averages ~400ms per slot.
 */
export function estimateSlotFromTime(timestampSeconds: bigint, genesisTime: bigint, msPerSlot: number = 400): bigint {
  const elapsed = timestampSeconds - genesisTime;
  return (elapsed * 1000n) / BigInt(msPerSlot);
}

/**
 * Calculate daily reset time (0:00 UTC) from a slot timestamp.
 */
export function dailyResetTime(currentTimestamp: bigint): bigint {
  const secondsPerDay = 86400n;
  return (currentTimestamp / secondsPerDay) * secondsPerDay;
}

/**
 * Check if a daily reward is claimable.
 */
export function isDailyClaimable(lastClaim: bigint, currentTimestamp: bigint): boolean {
  return dailyResetTime(currentTimestamp) > dailyResetTime(lastClaim);
}

/**
 * Calculate consecutive day streak.
 */
export function calculateStreak(claimTimestamps: bigint[]): number {
  if (claimTimestamps.length === 0) return 0;
  const sorted = [...claimTimestamps].sort((a, b) => Number(b - a));
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const dayA = sorted[i - 1] / 86400n;
    const dayB = sorted[i] / 86400n;
    if (dayA - dayB === 1n) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
