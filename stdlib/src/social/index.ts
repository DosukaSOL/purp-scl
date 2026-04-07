// Purp Standard Library — Social Module
// On-chain social protocol primitives for Solana social apps

// ============================================================================
// Core Types
// ============================================================================

export interface Profile {
  authority: string;
  username: string;
  displayName: string;
  avatar: string;          // URI (Arweave/IPFS/HTTP)
  bio: string;
  website: string;
  followers: number;
  following: number;
  postCount: number;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface Post {
  id: string;
  author: string;
  content: string;
  contentUri?: string;     // Off-chain content (Arweave/IPFS)
  mediaUri?: string;       // Image/video URI
  mediaType?: 'image' | 'video' | 'audio' | 'link';
  replyTo?: string;        // Parent post ID (for threads)
  repostOf?: string;       // Original post ID (for reposts)
  likes: number;
  replies: number;
  reposts: number;
  tips: bigint;            // Total tips in lamports
  createdAt: bigint;
  tags: string[];
}

export interface Follow {
  follower: string;
  following: string;
  timestamp: bigint;
}

export interface Reaction {
  user: string;
  post: string;
  kind: 'like' | 'dislike' | 'love' | 'fire' | 'sad' | 'laugh';
  timestamp: bigint;
}

export interface TipRecord {
  sender: string;
  receiver: string;
  post?: string;
  amount: bigint;
  mint?: string;           // SPL token mint (null = SOL)
  timestamp: bigint;
}

export interface ReputationScore {
  user: string;
  score: bigint;
  level: number;
  postKarma: bigint;
  commentKarma: bigint;
  tipKarma: bigint;
  lastUpdated: bigint;
}

// ============================================================================
// PDA Seed Helpers (for deriving social account addresses)
// ============================================================================

export const PROFILE_SEED = 'profile';
export const POST_SEED = 'post';
export const FOLLOW_SEED = 'follow';
export const REACTION_SEED = 'reaction';
export const REPUTATION_SEED = 'reputation';

/**
 * Get the seeds for a profile PDA.
 */
export function profileSeeds(authority: string): string[] {
  return [PROFILE_SEED, authority];
}

/**
 * Get the seeds for a post PDA.
 */
export function postSeeds(author: string, postId: string): string[] {
  return [POST_SEED, author, postId];
}

/**
 * Get the seeds for a follow relationship PDA.
 */
export function followSeeds(follower: string, following: string): string[] {
  return [FOLLOW_SEED, follower, following];
}

/**
 * Get the seeds for a reaction PDA.
 */
export function reactionSeeds(user: string, post: string): string[] {
  return [REACTION_SEED, user, post];
}

// ============================================================================
// Content Addressing (Arweave / IPFS)
// ============================================================================

/**
 * Generate an Arweave URI from a transaction ID.
 */
export function arweaveUri(txId: string): string {
  return `https://arweave.net/${txId}`;
}

/**
 * Generate an IPFS HTTP gateway URI.
 */
export function ipfsUri(cid: string, gateway: string = 'https://ipfs.io'): string {
  return `${gateway}/ipfs/${cid}`;
}

/**
 * Generate a Shadow Drive URI.
 */
export function shadowDriveUri(storageAccount: string, filename: string): string {
  return `https://shdw-drive.genesysgo.net/${storageAccount}/${filename}`;
}

/**
 * Detect content storage type from URI.
 */
export function detectStorageType(uri: string): 'arweave' | 'ipfs' | 'shadow' | 'http' | 'unknown' {
  if (uri.includes('arweave.net') || uri.startsWith('ar://')) return 'arweave';
  if (uri.includes('/ipfs/') || uri.startsWith('ipfs://')) return 'ipfs';
  if (uri.includes('shdw-drive.genesysgo.net')) return 'shadow';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return 'http';
  return 'unknown';
}

// ============================================================================
// Username Validation
// ============================================================================

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const RESERVED_USERNAMES = new Set([
  'admin', 'moderator', 'system', 'purp', 'solana', 'official',
  'help', 'support', 'null', 'undefined', 'root', 'superuser',
]);

/**
 * Validate a username for social profiles.
 */
export function validateUsername(username: string): { valid: boolean; reason?: string } {
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, reason: 'Username must be 3-20 characters, alphanumeric or underscore' };
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { valid: false, reason: 'Username is reserved' };
  }
  return { valid: true };
}

// ============================================================================
// Reputation / Karma System
// ============================================================================

const KARMA_WEIGHTS = {
  like_received: 1n,
  reply_received: 2n,
  repost_received: 3n,
  tip_received: 5n,
  post_created: 1n,
  tip_sent: 2n,
};

/**
 * Calculate reputation score from activity.
 */
export function calculateReputation(activity: {
  likesReceived: number;
  repliesReceived: number;
  repostsReceived: number;
  tipsReceived: number;
  postsCreated: number;
  tipsSent: number;
}): bigint {
  let score = 0n;
  score += BigInt(activity.likesReceived) * KARMA_WEIGHTS.like_received;
  score += BigInt(activity.repliesReceived) * KARMA_WEIGHTS.reply_received;
  score += BigInt(activity.repostsReceived) * KARMA_WEIGHTS.repost_received;
  score += BigInt(activity.tipsReceived) * KARMA_WEIGHTS.tip_received;
  score += BigInt(activity.postsCreated) * KARMA_WEIGHTS.post_created;
  score += BigInt(activity.tipsSent) * KARMA_WEIGHTS.tip_sent;
  return score;
}

/**
 * Get user level from reputation score.
 */
export function reputationLevel(score: bigint): number {
  // Level thresholds: 0, 10, 50, 200, 500, 1000, 5000, 10000, 50000, 100000
  const thresholds = [0n, 10n, 50n, 200n, 500n, 1_000n, 5_000n, 10_000n, 50_000n, 100_000n];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (score >= thresholds[i]) return i;
  }
  return 0;
}

// ============================================================================
// Feed / Timeline Helpers
// ============================================================================

/**
 * Sort posts by engagement score (likes + replies*2 + reposts*3 + tips*5).
 */
export function sortByEngagement(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const scoreA = a.likes + a.replies * 2 + a.reposts * 3 + Number(a.tips / 1_000_000n);
    const scoreB = b.likes + b.replies * 2 + b.reposts * 3 + Number(b.tips / 1_000_000n);
    return scoreB - scoreA;
  });
}

/**
 * Sort posts chronologically (newest first).
 */
export function sortChronological(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => Number(b.createdAt - a.createdAt));
}

/**
 * Filter posts by tags.
 */
export function filterByTags(posts: Post[], tags: string[]): Post[] {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  return posts.filter(p => p.tags.some(t => tagSet.has(t.toLowerCase())));
}

/**
 * Build a thread from a reply chain.
 */
export function buildThread(posts: Post[], rootPostId: string): Post[] {
  const thread: Post[] = [];
  const postMap = new Map(posts.map(p => [p.id, p]));
  const root = postMap.get(rootPostId);
  if (!root) return [];

  thread.push(root);
  const replies = posts
    .filter(p => p.replyTo === rootPostId)
    .sort((a, b) => Number(a.createdAt - b.createdAt));
  thread.push(...replies);
  return thread;
}

// ============================================================================
// Tipping
// ============================================================================

/**
 * Validate a tip amount (minimum thresholds).
 */
export function validateTip(amount: bigint, isSOL: boolean): { valid: boolean; reason?: string } {
  const minTip = isSOL ? 1_000_000n : 1n; // 0.001 SOL or 1 token unit
  if (amount < minTip) return { valid: false, reason: 'Tip below minimum amount' };
  return { valid: true };
}

/**
 * Calculate platform fee on tips.
 */
export function tipPlatformFee(amount: bigint, feeBps: number = 100): bigint {
  return (amount * BigInt(feeBps)) / 10_000n;
}

/**
 * Calculate net tip after platform fee.
 */
export function netTipAmount(amount: bigint, feeBps: number = 100): { net: bigint; fee: bigint } {
  const fee = tipPlatformFee(amount, feeBps);
  return { net: amount - fee, fee };
}
