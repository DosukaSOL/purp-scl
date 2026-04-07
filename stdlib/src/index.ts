// ============================================================================
// Purp Standard Library — Entry Point
// ============================================================================

export * from './accounts/index.js';
export * from './tokens/index.js';
// NFTs: exclude names that collide with math module
export { METAPLEX_PROGRAM_ID, BUBBLEGUM_PROGRAM_ID, TOKEN_METADATA_PROGRAM_ID, CANDY_MACHINE_V3_ID } from './nfts/index.js';
export { type NFTMetadata, type NFTCreator, type CompressedNFTConfig, type OffChainMetadata, type CollectionConfig } from './nfts/index.js';
export { UseMethod, TokenStandard } from './nfts/index.js';
export { createMetadataUri, createArweaveUri, createIpfsUri, ipfsToHttp } from './nfts/index.js';
export { validateCreatorShares, validateMetadata, validateOffChainMetadata } from './nfts/index.js';
export { buildOffChainMetadata, serializeOffChainMetadata } from './nfts/index.js';
export { estimateMerkleTreeSize, estimateMerkleTreeCost, maxNFTsForDepth, computeLeafHash } from './nfts/index.js';
export { DEFAULT_CNFT_CONFIG, CNFT_CONFIGS } from './nfts/index.js';
export { calculateRoyalty, splitRoyalties } from './nfts/index.js';
export * from './pdas/index.js';
export { type AccountMeta, type CPIContext, type CPIResult, type CPIBuilder } from './cpi/index.js';
export { SYSTEM_PROGRAM_ID, SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID as CPI_ASSOCIATED_TOKEN_PROGRAM_ID, RENT_PROGRAM_ID, CLOCK_PROGRAM_ID, STAKE_PROGRAM_ID, MEMO_PROGRAM_ID, METADATA_PROGRAM_ID } from './cpi/index.js';
export { writable, readonly, signer } from './cpi/index.js';
export { buildTransferCPI, buildCreateAccountCPI, buildTokenTransferCPI, buildMintToCPI, buildMemoCPI, validateCPIContext } from './cpi/index.js';
export * from './events/index.js';
export * from './math/index.js';
export * from './serialization/index.js';
// Wallet: exclude names that collide with math module (lamportsToSol, solToLamports)
export { type WalletAdapter, type WalletConfig, type WalletName, type WalletInfo } from './wallet/index.js';
export { KNOWN_WALLETS, CLUSTER_ENDPOINTS, getEndpoint } from './wallet/index.js';
export { formatAddress, isValidSolanaAddress, getExplorerUrl, getSolscanUrl } from './wallet/index.js';
export { createWalletConfig, generateWalletSetupCode, formatSol } from './wallet/index.js';
export * from './frontend/index.js';
export * from './game/index.js';
export * from './web/index.js';
export * from './ai/index.js';

// DeFi: selective exports to avoid collisions
export { type PoolState, type SwapResult, type AddLiquidityResult, type RemoveLiquidityResult } from './defi/index.js';
export { type LendingPool, type InterestRateModel, type BorrowPosition } from './defi/index.js';
export { type StakingPool, type StakePosition, type OraclePrice } from './defi/index.js';
export { createPool, calculateSwap, calculateSwapWithSlippage, addLiquidity, removeLiquidity, getSpotPrice, estimateImpermanentLoss } from './defi/index.js';
export { utilizationRate, borrowRate, supplyRate, isLiquidatable, maxBorrowable, healthFactor } from './defi/index.js';
export { rewardPerToken, pendingRewards, stakingAPR } from './defi/index.js';
export { parsePythPrice, oraclePriceToNumber, validateOracleFreshness, validateOracleConfidence, calculateTWAP } from './defi/index.js';

// Token-2022 Extensions
export * from './token-extensions/index.js';

// Governance/DAO
export { type GovernanceConfig, type Proposal, type Vote, type TreasuryConfig } from './governance/index.js';
export { tokenWeightedVote, quadraticVoteWeight, convictionVoteWeight, calculateVoteWeight } from './governance/index.js';
export { createProposal, isVotingOpen, totalVotes, hasQuorum, hasPassed, resolveProposal } from './governance/index.js';
export { validateTreasurySpend, isThresholdMet, formatProposalState, DAO_PRESETS } from './governance/index.js';

// Social
export { type Profile, type Post, type Follow, type Reaction as SocialReaction, type TipRecord, type ReputationScore } from './social/index.js';
export { profileSeeds, postSeeds, followSeeds, reactionSeeds } from './social/index.js';
export { arweaveUri, ipfsUri, shadowDriveUri, detectStorageType, validateUsername } from './social/index.js';
export { calculateReputation, reputationLevel, sortByEngagement, sortChronological, filterByTags, buildThread } from './social/index.js';
export { validateTip, tipPlatformFee, netTipAmount } from './social/index.js';
