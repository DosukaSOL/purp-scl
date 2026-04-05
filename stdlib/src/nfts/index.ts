// Purp Standard Library — NFTs Module
// NFT, Metaplex, and Compressed NFT helpers

import { createHash } from 'crypto';

export const METAPLEX_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
export const BUBBLEGUM_PROGRAM_ID = 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
export const TOKEN_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
export const CANDY_MACHINE_V3_ID = 'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR';

// ---- Types ----

export interface NFTMetadata {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: NFTCreator[];
  collection?: { verified: boolean; key: string };
  uses?: { useMethod: UseMethod; remaining: number; total: number };
  isMutable?: boolean;
  primarySaleHappened?: boolean;
  tokenStandard?: TokenStandard;
}

export interface NFTCreator {
  address: string;
  verified: boolean;
  share: number;
}

export enum UseMethod {
  Burn = 0,
  Multiple = 1,
  Single = 2,
}

export enum TokenStandard {
  NonFungible = 0,
  FungibleAsset = 1,
  Fungible = 2,
  NonFungibleEdition = 3,
  ProgrammableNonFungible = 4,
}

export interface CompressedNFTConfig {
  maxDepth: number;
  maxBufferSize: number;
  canopyDepth?: number;
}

export interface OffChainMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  animationUrl?: string;
  externalUrl?: string;
  attributes: { traitType: string; value: string | number }[];
  properties: {
    files: { uri: string; type: string }[];
    category: 'image' | 'video' | 'audio' | 'vr' | 'html';
    creators: { address: string; share: number }[];
  };
}

export interface CollectionConfig {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  maxSupply?: number;
  creators: NFTCreator[];
}

// ---- URI ----

export function createMetadataUri(baseUri: string, tokenId: string): string {
  return `${baseUri}/${tokenId}.json`;
}

export function createArweaveUri(txId: string): string {
  return `https://arweave.net/${txId}`;
}

export function createIpfsUri(cid: string, filename?: string): string {
  return filename ? `ipfs://${cid}/${filename}` : `ipfs://${cid}`;
}

export function ipfsToHttp(ipfsUri: string, gateway: string = 'https://nftstorage.link/ipfs/'): string {
  return ipfsUri.replace('ipfs://', gateway);
}

// ---- Validation ----

export function validateCreatorShares(creators: NFTCreator[]): boolean {
  const totalShares = creators.reduce((sum, c) => sum + c.share, 0);
  return totalShares === 100;
}

export function validateMetadata(metadata: NFTMetadata): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!metadata.name || metadata.name.length > 32) errors.push('Name must be 1-32 characters');
  if (!metadata.symbol || metadata.symbol.length > 10) errors.push('Symbol must be 1-10 characters');
  if (!metadata.uri || metadata.uri.length > 200) errors.push('URI must be 1-200 characters');
  if (metadata.sellerFeeBasisPoints < 0 || metadata.sellerFeeBasisPoints > 10000) {
    errors.push('Seller fee basis points must be 0-10000');
  }
  if (!metadata.creators || metadata.creators.length === 0) errors.push('At least one creator is required');
  if (metadata.creators && metadata.creators.length > 5) errors.push('Maximum 5 creators allowed');
  if (metadata.creators && !validateCreatorShares(metadata.creators)) errors.push('Creator shares must sum to 100');
  return { valid: errors.length === 0, errors };
}

export function validateOffChainMetadata(meta: OffChainMetadata): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!meta.name) errors.push('Name is required');
  if (!meta.image) errors.push('Image is required');
  if (!meta.properties?.files?.length) errors.push('At least one file is required');
  if (meta.attributes) {
    for (const attr of meta.attributes) {
      if (!attr.traitType) errors.push('Attribute traitType is required');
    }
  }
  return { valid: errors.length === 0, errors };
}

// ---- Off-Chain Metadata Generation ----

export function buildOffChainMetadata(
  name: string,
  description: string,
  imageUri: string,
  attributes: { traitType: string; value: string | number }[],
  creators: { address: string; share: number }[]
): OffChainMetadata {
  return {
    name,
    symbol: '',
    description,
    image: imageUri,
    attributes,
    properties: {
      files: [{ uri: imageUri, type: 'image/png' }],
      category: 'image',
      creators,
    },
  };
}

export function serializeOffChainMetadata(metadata: OffChainMetadata): string {
  return JSON.stringify(metadata, null, 2);
}

// ---- Merkle Tree / Compressed NFTs ----

export function estimateMerkleTreeSize(maxDepth: number, maxBufferSize: number): number {
  const nodeSize = 32;
  const nodes = Math.pow(2, maxDepth + 1) - 1;
  return nodes * nodeSize + maxBufferSize * 64 + 256;
}

export function estimateMerkleTreeCost(maxDepth: number, maxBufferSize: number, lamportsPerByte: number = 6960): number {
  const size = estimateMerkleTreeSize(maxDepth, maxBufferSize);
  return size * lamportsPerByte;
}

export function maxNFTsForDepth(maxDepth: number): number {
  return Math.pow(2, maxDepth);
}

/**
 * Compute a simple Merkle leaf hash for a compressed NFT.
 */
export function computeLeafHash(
  owner: string,
  delegate: string,
  nonce: number,
  dataHash: Uint8Array
): Uint8Array {
  const encoder = new TextEncoder();
  const hash = createHash('sha256');
  hash.update(encoder.encode(owner));
  hash.update(encoder.encode(delegate));
  const nonceBuf = new Uint8Array(8);
  new DataView(nonceBuf.buffer).setBigUint64(0, BigInt(nonce), true);
  hash.update(nonceBuf);
  hash.update(dataHash);
  return new Uint8Array(hash.digest());
}

export const DEFAULT_CNFT_CONFIG: CompressedNFTConfig = {
  maxDepth: 14,
  maxBufferSize: 64,
  canopyDepth: 11,
};

// Recommended configs by collection size
export const CNFT_CONFIGS: Record<string, CompressedNFTConfig> = {
  'small': { maxDepth: 3, maxBufferSize: 8, canopyDepth: 0 },       // up to 8 NFTs
  'medium': { maxDepth: 14, maxBufferSize: 64, canopyDepth: 11 },    // up to 16,384
  'large': { maxDepth: 20, maxBufferSize: 256, canopyDepth: 14 },    // up to 1M
  'xlarge': { maxDepth: 24, maxBufferSize: 512, canopyDepth: 17 },   // up to 16M
  'max': { maxDepth: 30, maxBufferSize: 2048, canopyDepth: 20 },     // up to 1B
};

// ---- Royalty Helpers ----

export function basisPointsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

export function calculateRoyalty(salePrice: number, basisPoints: number): number {
  return Math.floor(salePrice * basisPoints / 10000);
}

export function splitRoyalties(royaltyAmount: number, creators: NFTCreator[]): Map<string, number> {
  const splits = new Map<string, number>();
  for (const creator of creators) {
    splits.set(creator.address, Math.floor(royaltyAmount * creator.share / 100));
  }
  return splits;
}
