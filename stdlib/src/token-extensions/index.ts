// Purp Standard Library — Token-2022 Extensions Module
// Support for SPL Token-2022 (Token Extensions Program) on Solana

export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// ============================================================================
// Extension Types
// ============================================================================

export type TokenExtension =
  | TransferFeeExtension
  | TransferHookExtension
  | NonTransferableExtension
  | InterestBearingExtension
  | PermanentDelegateExtension
  | ConfidentialTransferExtension
  | MetadataExtension
  | MemoRequiredExtension
  | CpiGuardExtension
  | DefaultAccountStateExtension;

export interface TransferFeeExtension {
  kind: 'TransferFee';
  feeBasisPoints: number;  // Fee in basis points (e.g., 100 = 1%)
  maxFee: bigint;          // Maximum fee cap in token units
  authority: string;       // Transfer fee authority pubkey
}

export interface TransferHookExtension {
  kind: 'TransferHook';
  programId: string;       // Hook program to invoke on every transfer
  authority: string;
}

export interface NonTransferableExtension {
  kind: 'NonTransferable';  // Soulbound token
}

export interface InterestBearingExtension {
  kind: 'InterestBearing';
  rate: number;             // Annual interest rate in basis points
  authority: string;
}

export interface PermanentDelegateExtension {
  kind: 'PermanentDelegate';
  delegate: string;         // Permanent delegate pubkey
}

export interface ConfidentialTransferExtension {
  kind: 'ConfidentialTransfer';
  authority: string;
  autoApproveNewAccounts: boolean;
}

export interface MetadataExtension {
  kind: 'Metadata';
  name: string;
  symbol: string;
  uri: string;
  additionalMetadata: [string, string][];
}

export interface MemoRequiredExtension {
  kind: 'MemoRequired';     // Requires memo on every transfer
}

export interface CpiGuardExtension {
  kind: 'CpiGuard';         // Prevents certain CPI-initiated actions
}

export interface DefaultAccountStateExtension {
  kind: 'DefaultAccountState';
  state: 'initialized' | 'frozen';  // New accounts start in this state
}

// ============================================================================
// Token-2022 Mint Configuration
// ============================================================================

export interface Token2022MintConfig {
  decimals: number;
  mintAuthority: string;
  freezeAuthority?: string;
  extensions: TokenExtension[];
}

/**
 * Calculate the required account size for a Token-2022 mint with extensions.
 */
export function calculateMintSize(extensions: TokenExtension[]): number {
  let size = 165; // Base mint data padded to MultisigAccount length (Token-2022)
  size += 1;      // Account type discriminator byte

  for (const ext of extensions) {
    size += 4; // TLV header: 2 bytes type + 2 bytes length
    switch (ext.kind) {
      case 'TransferFee': size += 108; break;
      case 'TransferHook': size += 64; break;
      case 'NonTransferable': size += 0; break;
      case 'InterestBearing': size += 52; break;
      case 'PermanentDelegate': size += 32; break;
      case 'ConfidentialTransfer': size += 97; break;
      case 'Metadata':
        size += 4 + ext.name.length + 4 + ext.symbol.length + 4 + ext.uri.length;
        for (const [k, v] of ext.additionalMetadata) {
          size += 4 + k.length + 4 + v.length;
        }
        break;
      case 'MemoRequired': size += 1; break;
      case 'CpiGuard': size += 1; break;
      case 'DefaultAccountState': size += 1; break;
    }
  }

  return size;
}

/**
 * Calculate the required rent for a Token-2022 mint.
 */
export function calculateMintRent(extensions: TokenExtension[]): bigint {
  const size = BigInt(calculateMintSize(extensions));
  // Solana rent-exempt formula: (data_size + 128) * lamports_per_byte_year * 2_years
  // lamports_per_byte_year = 3480
  return (size + 128n) * 3480n * 2n;
}

// ============================================================================
// Transfer Fee Helpers
// ============================================================================

/**
 * Calculate the transfer fee for a given amount.
 */
export function calculateTransferFee(
  amount: bigint,
  feeBasisPoints: number,
  maxFee: bigint,
): bigint {
  const fee = (amount * BigInt(feeBasisPoints)) / 10_000n;
  return fee > maxFee ? maxFee : fee;
}

/**
 * Calculate the amount after deducting transfer fee.
 */
export function amountAfterFee(
  amount: bigint,
  feeBasisPoints: number,
  maxFee: bigint,
): bigint {
  return amount - calculateTransferFee(amount, feeBasisPoints, maxFee);
}

/**
 * Calculate the gross amount needed to receive a specific net amount.
 */
export function grossAmountForNetReceive(
  netAmount: bigint,
  feeBasisPoints: number,
  maxFee: bigint,
): bigint {
  // gross = net / (1 - fee%)
  const gross = (netAmount * 10_000n) / (10_000n - BigInt(feeBasisPoints));
  const fee = calculateTransferFee(gross, feeBasisPoints, maxFee);
  if (fee >= maxFee) return netAmount + maxFee;
  return gross;
}

// ============================================================================
// Interest Bearing Helpers
// ============================================================================

/**
 * Calculate the accrued interest on an interest-bearing token balance.
 */
export function calculateAccruedInterest(
  balance: bigint,
  rateBps: number,
  elapsedSeconds: bigint,
  secondsPerYear: bigint = 31_536_000n,
): bigint {
  // Simple interest: balance * rate * time / (bps_base * year)
  return (balance * BigInt(rateBps) * elapsedSeconds) / (10_000n * secondsPerYear);
}

/**
 * Get the UI display amount for an interest-bearing token account.
 */
export function interestBearingBalance(
  storedBalance: bigint,
  rateBps: number,
  elapsedSeconds: bigint,
): bigint {
  return storedBalance + calculateAccruedInterest(storedBalance, rateBps, elapsedSeconds);
}

// ============================================================================
// Confidential Transfer Helpers
// ============================================================================

export interface ConfidentialBalance {
  pending: bigint;
  available: bigint;
}

/**
 * Validate a confidential transfer proof (placeholder — actual ZK proofs are on-chain).
 */
export function validateConfidentialAmount(amount: bigint, maxAmount: bigint): boolean {
  return amount > 0n && amount <= maxAmount;
}

// ============================================================================
// Codegen Helpers — Generate Rust code for Token-2022 instructions
// ============================================================================

/**
 * Generate the Rust instruction data for creating a Token-2022 mint with extensions.
 */
export function generateMintInstructions(config: Token2022MintConfig): string[] {
  const instructions: string[] = [];

  for (const ext of config.extensions) {
    switch (ext.kind) {
      case 'TransferFee':
        instructions.push(
          `spl_token_2022::extension::transfer_fee::instruction::initialize_transfer_fee_config(` +
          `&spl_token_2022::id(), &mint_pubkey, Some(&${ext.authority}), Some(&${ext.authority}), ` +
          `${ext.feeBasisPoints}, ${ext.maxFee})?`
        );
        break;
      case 'TransferHook':
        instructions.push(
          `spl_token_2022::extension::transfer_hook::instruction::initialize(` +
          `&spl_token_2022::id(), &mint_pubkey, Some(${ext.authority}), Some(${ext.programId}))?`
        );
        break;
      case 'NonTransferable':
        instructions.push(
          `spl_token_2022::instruction::initialize_non_transferable_mint(&spl_token_2022::id(), &mint_pubkey)?`
        );
        break;
      case 'InterestBearing':
        instructions.push(
          `spl_token_2022::extension::interest_bearing_mint::instruction::initialize(` +
          `&spl_token_2022::id(), &mint_pubkey, Some(${ext.authority}), ${ext.rate})?`
        );
        break;
      case 'PermanentDelegate':
        instructions.push(
          `spl_token_2022::instruction::initialize_permanent_delegate(` +
          `&spl_token_2022::id(), &mint_pubkey, &${ext.delegate})?`
        );
        break;
      case 'Metadata':
        instructions.push(
          `spl_token_metadata_interface::instruction::initialize(` +
          `&spl_token_2022::id(), &mint_pubkey, &mint_authority, &mint_pubkey, &mint_authority, ` +
          `"${ext.name}".to_string(), "${ext.symbol}".to_string(), "${ext.uri}".to_string())?`
        );
        break;
      case 'DefaultAccountState':
        instructions.push(
          `spl_token_2022::extension::default_account_state::instruction::initialize_default_account_state(` +
          `&spl_token_2022::id(), &mint_pubkey, &spl_token_2022::state::AccountState::${ext.state === 'frozen' ? 'Frozen' : 'Initialized'})?`
        );
        break;
    }
  }

  return instructions;
}

/**
 * Check if an extension is present in a list.
 */
export function hasExtension(extensions: TokenExtension[], kind: TokenExtension['kind']): boolean {
  return extensions.some(e => e.kind === kind);
}

/**
 * Get a specific extension from the list.
 */
export function getExtension<K extends TokenExtension['kind']>(
  extensions: TokenExtension[],
  kind: K,
): Extract<TokenExtension, { kind: K }> | undefined {
  return extensions.find(e => e.kind === kind) as Extract<TokenExtension, { kind: K }> | undefined;
}
