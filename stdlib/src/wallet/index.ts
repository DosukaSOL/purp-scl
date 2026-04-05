// Purp Standard Library — Wallet Module
// Wallet interaction helpers

export interface WalletAdapter {
  publicKey: string | null;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction(tx: unknown): Promise<unknown>;
  signAllTransactions(txs: unknown[]): Promise<unknown[]>;
}

export interface WalletConfig {
  autoConnect?: boolean;
  cluster?: 'devnet' | 'testnet' | 'mainnet-beta';
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function getExplorerUrl(address: string, cluster: string = 'devnet', type: 'address' | 'tx' = 'address'): string {
  const base = 'https://explorer.solana.com';
  return `${base}/${type}/${address}?cluster=${cluster}`;
}
