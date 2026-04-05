// Purp Standard Library — NFTs Module
// NFT and Compressed NFT helpers

export const METAPLEX_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
export const BUBBLEGUM_PROGRAM_ID = 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';

export interface NFTMetadata {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: NFTCreator[];
  collection?: { verified: boolean; key: string };
  uses?: { useMethod: number; remaining: number; total: number };
}

export interface NFTCreator {
  address: string;
  verified: boolean;
  share: number;
}

export interface CompressedNFTConfig {
  maxDepth: number;
  maxBufferSize: number;
  canopyDepth?: number;
}

export function createMetadataUri(baseUri: string, tokenId: string): string {
  return `${baseUri}/${tokenId}.json`;
}

export function validateCreatorShares(creators: NFTCreator[]): boolean {
  const totalShares = creators.reduce((sum, c) => sum + c.share, 0);
  return totalShares === 100;
}

export function estimateMerkleTreeSize(maxDepth: number, maxBufferSize: number): number {
  // Approximate size calculation for Merkle tree account
  const nodeSize = 32; // 32 bytes per hash
  const nodes = Math.pow(2, maxDepth + 1) - 1;
  return nodes * nodeSize + maxBufferSize * 64 + 256;
}

export const DEFAULT_CNFT_CONFIG: CompressedNFTConfig = {
  maxDepth: 14,
  maxBufferSize: 64,
  canopyDepth: 11,
};
