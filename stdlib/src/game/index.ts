// Purp Standard Library — Game Module
// Game primitive helpers for Solana games

export interface GameState {
  gameId: string;
  players: string[];
  status: 'waiting' | 'active' | 'finished';
  round: number;
  data: Record<string, unknown>;
}

export interface PlayerState {
  address: string;
  score: number;
  data: Record<string, unknown>;
}

export function createGameState(gameId: string, creator: string): GameState {
  return { gameId, players: [creator], status: 'waiting', round: 0, data: {} };
}

export function addPlayer(state: GameState, player: string): GameState {
  if (state.players.includes(player)) return state;
  return { ...state, players: [...state.players, player] };
}

export function calculateLeaderboard(players: PlayerState[]): PlayerState[] {
  return [...players].sort((a, b) => b.score - a.score);
}

export function generateRandomSeed(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
