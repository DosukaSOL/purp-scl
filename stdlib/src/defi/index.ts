// Purp Standard Library — DeFi Module
// AMM, lending, staking, oracle, and liquidity pool primitives for Solana DeFi

import { checkedMul, checkedDiv, checkedAdd, checkedSub, proportionalAmount } from '../math/index.js';

// ============================================================================
// Constants
// ============================================================================

export const FEE_DENOMINATOR = 10_000n; // Basis points (100% = 10,000)
export const DEFAULT_SWAP_FEE = 30n;    // 0.30%
export const DEFAULT_PROTOCOL_FEE = 5n; // 0.05%
export const MIN_LIQUIDITY = 1_000n;    // Minimum LP tokens to prevent dust

// ============================================================================
// AMM / DEX — Constant Product (x * y = k)
// ============================================================================

export interface PoolState {
  reserveA: bigint;
  reserveB: bigint;
  lpSupply: bigint;
  feeNumerator: bigint;
  feeDenominator: bigint;
  protocolFeeNumerator: bigint;
  accumulatedFeeA: bigint;
  accumulatedFeeB: bigint;
}

export interface SwapResult {
  amountOut: bigint;
  fee: bigint;
  protocolFee: bigint;
  priceImpact: number;
  newReserveA: bigint;
  newReserveB: bigint;
}

export interface AddLiquidityResult {
  lpTokensMinted: bigint;
  depositA: bigint;
  depositB: bigint;
}

export interface RemoveLiquidityResult {
  withdrawA: bigint;
  withdrawB: bigint;
}

/**
 * Create a new pool with initial liquidity.
 */
export function createPool(
  initialA: bigint,
  initialB: bigint,
  feeNumerator: bigint = DEFAULT_SWAP_FEE,
  protocolFeeNumerator: bigint = DEFAULT_PROTOCOL_FEE,
): { pool: PoolState; lpTokens: bigint } {
  if (initialA <= 0n || initialB <= 0n) throw new Error('Initial liquidity must be positive');
  const lpTokens = sqrt(checkedMul(initialA, initialB));
  if (lpTokens <= MIN_LIQUIDITY) throw new Error('Initial liquidity too small');
  return {
    pool: {
      reserveA: initialA,
      reserveB: initialB,
      lpSupply: lpTokens,
      feeNumerator,
      feeDenominator: FEE_DENOMINATOR,
      protocolFeeNumerator,
      accumulatedFeeA: 0n,
      accumulatedFeeB: 0n,
    },
    lpTokens,
  };
}

/**
 * Calculate swap output using constant product formula.
 * amountIn of token A → amountOut of token B (or vice versa).
 */
export function calculateSwap(
  pool: PoolState,
  amountIn: bigint,
  isAtoB: boolean,
): SwapResult {
  if (amountIn <= 0n) throw new Error('Swap amount must be positive');

  const reserveIn = isAtoB ? pool.reserveA : pool.reserveB;
  const reserveOut = isAtoB ? pool.reserveB : pool.reserveA;

  // Deduct fee from input
  const fee = checkedDiv(checkedMul(amountIn, pool.feeNumerator), pool.feeDenominator);
  const protocolFee = checkedDiv(checkedMul(fee, pool.protocolFeeNumerator), pool.feeDenominator);
  const amountInAfterFee = checkedSub(amountIn, fee);

  // Constant product: (x + dx) * (y - dy) = x * y
  // dy = y * dx / (x + dx)
  const numerator = checkedMul(reserveOut, amountInAfterFee);
  const denominator = checkedAdd(reserveIn, amountInAfterFee);
  const amountOut = checkedDiv(numerator, denominator);

  if (amountOut >= reserveOut) throw new Error('Insufficient liquidity');

  // Price impact = 1 - (amountOut / expectedOut)
  const expectedOut = checkedDiv(checkedMul(amountIn, reserveOut), reserveIn);
  const priceImpact = expectedOut > 0n
    ? 1 - Number(amountOut) / Number(expectedOut)
    : 0;

  const newReserveIn = checkedAdd(reserveIn, amountIn);
  const newReserveOut = checkedSub(reserveOut, amountOut);

  return {
    amountOut,
    fee,
    protocolFee,
    priceImpact,
    newReserveA: isAtoB ? newReserveIn : newReserveOut,
    newReserveB: isAtoB ? newReserveOut : newReserveIn,
  };
}

/**
 * Calculate swap with slippage protection.
 */
export function calculateSwapWithSlippage(
  pool: PoolState,
  amountIn: bigint,
  isAtoB: boolean,
  maxSlippageBps: bigint,
): SwapResult {
  const result = calculateSwap(pool, amountIn, isAtoB);
  const slippageBps = BigInt(Math.floor(result.priceImpact * 10_000));
  if (slippageBps > maxSlippageBps) {
    throw new Error(`Slippage ${slippageBps}bps exceeds max ${maxSlippageBps}bps`);
  }
  return result;
}

/**
 * Add liquidity proportional to existing reserves.
 */
export function addLiquidity(
  pool: PoolState,
  maxA: bigint,
  maxB: bigint,
): AddLiquidityResult {
  if (pool.lpSupply === 0n) throw new Error('Pool not initialized');

  // Calculate proportional deposit
  const ratioA = checkedDiv(checkedMul(maxA, pool.lpSupply), pool.reserveA);
  const ratioB = checkedDiv(checkedMul(maxB, pool.lpSupply), pool.reserveB);
  const lpTokens = ratioA < ratioB ? ratioA : ratioB;

  const depositA = proportionalAmount(pool.reserveA, lpTokens, pool.lpSupply);
  const depositB = proportionalAmount(pool.reserveB, lpTokens, pool.lpSupply);

  return { lpTokensMinted: lpTokens, depositA, depositB };
}

/**
 * Remove liquidity by burning LP tokens.
 */
export function removeLiquidity(
  pool: PoolState,
  lpTokens: bigint,
): RemoveLiquidityResult {
  if (lpTokens > pool.lpSupply) throw new Error('Insufficient LP tokens');
  return {
    withdrawA: proportionalAmount(pool.reserveA, lpTokens, pool.lpSupply),
    withdrawB: proportionalAmount(pool.reserveB, lpTokens, pool.lpSupply),
  };
}

/**
 * Get current spot price of token A in terms of token B.
 */
export function getSpotPrice(pool: PoolState): number {
  if (pool.reserveA === 0n) return 0;
  return Number(pool.reserveB) / Number(pool.reserveA);
}

/**
 * Estimate impermanent loss for a given price change.
 * priceRatio = newPrice / initialPrice
 * Returns a negative decimal representing loss (e.g., -0.05 = 5% loss)
 */
export function estimateImpermanentLoss(priceRatio: number): number {
  const sqrtR = Math.sqrt(priceRatio);
  return (2 * sqrtR) / (1 + priceRatio) - 1;
}

// ============================================================================
// Lending / Borrowing
// ============================================================================

export interface LendingPool {
  totalDeposits: bigint;
  totalBorrows: bigint;
  interestRateModel: InterestRateModel;
  lastUpdateSlot: bigint;
  accumulatedInterest: bigint;
  collateralFactor: bigint; // In basis points (e.g., 7500 = 75%)
  liquidationThreshold: bigint; // In basis points (e.g., 8500 = 85%)
  liquidationPenalty: bigint; // In basis points (e.g., 500 = 5%)
}

export interface InterestRateModel {
  baseRate: bigint;      // Annual rate in bps at 0% utilization
  slope1: bigint;        // Rate slope below optimal utilization
  slope2: bigint;        // Rate slope above optimal (jump rate)
  optimalUtilization: bigint; // In bps (e.g., 8000 = 80%)
}

export interface BorrowPosition {
  borrowed: bigint;
  collateral: bigint;
  collateralMint: string;
  lastAccrualSlot: bigint;
}

/**
 * Calculate utilization rate of a lending pool.
 */
export function utilizationRate(pool: LendingPool): bigint {
  if (pool.totalDeposits === 0n) return 0n;
  return checkedDiv(checkedMul(pool.totalBorrows, FEE_DENOMINATOR), pool.totalDeposits);
}

/**
 * Calculate current borrow interest rate using jump-rate model.
 */
export function borrowRate(pool: LendingPool): bigint {
  const util = utilizationRate(pool);
  const model = pool.interestRateModel;

  if (util <= model.optimalUtilization) {
    // Linear below optimal: base + slope1 * (util / optimal)
    return checkedAdd(
      model.baseRate,
      checkedDiv(checkedMul(model.slope1, util), model.optimalUtilization),
    );
  }
  // Jump above optimal: base + slope1 + slope2 * ((util - optimal) / (1 - optimal))
  const excessUtil = checkedSub(util, model.optimalUtilization);
  const maxExcess = checkedSub(FEE_DENOMINATOR, model.optimalUtilization);
  return checkedAdd(
    checkedAdd(model.baseRate, model.slope1),
    checkedDiv(checkedMul(model.slope2, excessUtil), maxExcess),
  );
}

/**
 * Calculate supply (deposit) interest rate.
 */
export function supplyRate(pool: LendingPool): bigint {
  const bRate = borrowRate(pool);
  const util = utilizationRate(pool);
  return checkedDiv(checkedMul(bRate, util), FEE_DENOMINATOR);
}

/**
 * Check if a position is liquidatable.
 */
export function isLiquidatable(
  position: BorrowPosition,
  collateralPrice: bigint,
  debtPrice: bigint,
  liquidationThreshold: bigint,
): boolean {
  const collateralValue = checkedMul(position.collateral, collateralPrice);
  const debtValue = checkedMul(position.borrowed, debtPrice);
  const thresholdValue = checkedDiv(checkedMul(collateralValue, liquidationThreshold), FEE_DENOMINATOR);
  return debtValue > thresholdValue;
}

/**
 * Calculate maximum borrowable amount given collateral.
 */
export function maxBorrowable(
  collateralAmount: bigint,
  collateralPrice: bigint,
  debtPrice: bigint,
  collateralFactor: bigint,
): bigint {
  const collateralValue = checkedMul(collateralAmount, collateralPrice);
  const maxDebtValue = checkedDiv(checkedMul(collateralValue, collateralFactor), FEE_DENOMINATOR);
  return checkedDiv(maxDebtValue, debtPrice);
}

/**
 * Calculate health factor (>1 = healthy, <1 = liquidatable).
 */
export function healthFactor(
  position: BorrowPosition,
  collateralPrice: bigint,
  debtPrice: bigint,
  liquidationThreshold: bigint,
): number {
  if (position.borrowed === 0n) return Infinity;
  const collateralValue = Number(checkedMul(position.collateral, collateralPrice));
  const thresholdValue = collateralValue * Number(liquidationThreshold) / Number(FEE_DENOMINATOR);
  const debtValue = Number(checkedMul(position.borrowed, debtPrice));
  return thresholdValue / debtValue;
}

// ============================================================================
// Staking / Yield Farming
// ============================================================================

export interface StakingPool {
  totalStaked: bigint;
  rewardPerTokenStored: bigint;
  rewardRate: bigint;        // Rewards per slot
  lastUpdateSlot: bigint;
  periodFinish: bigint;
  rewardDuration: bigint;    // Duration in slots
}

export interface StakePosition {
  amount: bigint;
  rewardPerTokenPaid: bigint;
  pendingRewards: bigint;
}

/**
 * Calculate accumulated reward per token.
 */
export function rewardPerToken(pool: StakingPool, currentSlot: bigint): bigint {
  if (pool.totalStaked === 0n) return pool.rewardPerTokenStored;
  const elapsed = checkedSub(
    currentSlot < pool.periodFinish ? currentSlot : pool.periodFinish,
    pool.lastUpdateSlot,
  );
  const newRewards = checkedMul(elapsed, pool.rewardRate);
  return checkedAdd(
    pool.rewardPerTokenStored,
    checkedDiv(checkedMul(newRewards, 1_000_000_000n), pool.totalStaked), // Scale factor
  );
}

/**
 * Calculate pending rewards for a staker.
 */
export function pendingRewards(
  pool: StakingPool,
  position: StakePosition,
  currentSlot: bigint,
): bigint {
  const rpt = rewardPerToken(pool, currentSlot);
  const earned = checkedDiv(
    checkedMul(position.amount, checkedSub(rpt, position.rewardPerTokenPaid)),
    1_000_000_000n,
  );
  return checkedAdd(position.pendingRewards, earned);
}

/**
 * Calculate APR for the staking pool.
 * Returns annual percentage rate as a number (e.g., 0.12 = 12%)
 */
export function stakingAPR(
  pool: StakingPool,
  rewardPrice: bigint,
  stakePrice: bigint,
  slotsPerYear: bigint = 63_072_000n, // ~2 slots/sec (400ms slots) * 365.25 days
): number {
  if (pool.totalStaked === 0n) return 0;
  const annualRewards = Number(checkedMul(pool.rewardRate, slotsPerYear));
  const annualRewardValue = annualRewards * Number(rewardPrice);
  const totalStakedValue = Number(pool.totalStaked) * Number(stakePrice);
  return annualRewardValue / totalStakedValue;
}

// ============================================================================
// Oracle Integration (Pyth / Switchboard)
// ============================================================================

export interface OraclePrice {
  price: bigint;
  confidence: bigint;
  exponent: number;
  publishTime: bigint;
}

/**
 * Parse a Pyth price feed from raw account data.
 */
export function parsePythPrice(data: Uint8Array): OraclePrice {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Pyth v2 account layout (simplified)
  const exponent = view.getInt32(20, true);
  const price = view.getBigInt64(208, true);
  const confidence = view.getBigUint64(216, true);
  const publishTime = view.getBigInt64(224, true);
  return { price, confidence, exponent, publishTime };
}

/**
 * Get price as a human-readable number from oracle data.
 */
export function oraclePriceToNumber(oracle: OraclePrice): number {
  return Number(oracle.price) * Math.pow(10, oracle.exponent);
}

/**
 * Validate oracle staleness (reject stale prices).
 */
export function validateOracleFreshness(
  oracle: OraclePrice,
  currentTime: bigint,
  maxAgeSeconds: bigint = 60n,
): boolean {
  return (currentTime - oracle.publishTime) <= maxAgeSeconds;
}

/**
 * Validate oracle confidence interval (reject uncertain prices).
 */
export function validateOracleConfidence(
  oracle: OraclePrice,
  maxConfidenceRatio: number = 0.05, // 5% max confidence/price ratio
): boolean {
  if (oracle.price === 0n) return false;
  const ratio = Number(oracle.confidence) / Number(oracle.price < 0n ? -oracle.price : oracle.price);
  return ratio <= maxConfidenceRatio;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Integer square root (Babylonian method).
 */
export function sqrt(value: bigint): bigint {
  if (value < 0n) throw new Error('Square root of negative number');
  if (value === 0n) return 0n;
  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}

/**
 * Calculate TWAP (Time-Weighted Average Price) from observations.
 */
export function calculateTWAP(
  observations: { price: bigint; timestamp: bigint }[],
): bigint {
  if (observations.length < 2) throw new Error('Need at least 2 observations');
  let weightedSum = 0n;
  let totalTime = 0n;
  for (let i = 1; i < observations.length; i++) {
    const dt = checkedSub(observations[i].timestamp, observations[i - 1].timestamp);
    weightedSum = checkedAdd(weightedSum, checkedMul(observations[i - 1].price, dt));
    totalTime = checkedAdd(totalTime, dt);
  }
  return checkedDiv(weightedSum, totalTime);
}
