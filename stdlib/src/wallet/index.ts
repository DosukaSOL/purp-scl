// Purp Standard Library — Wallet Module
// Wallet interaction helpers for Solana wallet adapters

export interface WalletAdapter {
  publicKey: string | null;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction(tx: unknown): Promise<unknown>;
  signAllTransactions(txs: unknown[]): Promise<unknown[]>;
  signMessage?(message: Uint8Array): Promise<Uint8Array>;
}

export interface WalletConfig {
  autoConnect?: boolean;
  cluster?: 'devnet' | 'testnet' | 'mainnet-beta' | 'localnet';
  commitment?: 'processed' | 'confirmed' | 'finalized';
  endpoint?: string;
}

export type WalletName = 'phantom' | 'solflare' | 'backpack' | 'glow' | 'coinbase' | 'torus' | 'ledger';

export interface WalletInfo {
  name: WalletName;
  url: string;
  icon: string;
  adapter: string;  // npm package for the adapter
}

// ---- Known Wallets ----

export const KNOWN_WALLETS: Record<WalletName, WalletInfo> = {
  phantom: {
    name: 'phantom',
    url: 'https://phantom.app',
    icon: 'https://phantom.app/img/phantom-icon.svg',
    adapter: '@solana/wallet-adapter-phantom',
  },
  solflare: {
    name: 'solflare',
    url: 'https://solflare.com',
    icon: 'https://solflare.com/favicon.svg',
    adapter: '@solana/wallet-adapter-solflare',
  },
  backpack: {
    name: 'backpack',
    url: 'https://backpack.app',
    icon: 'https://backpack.app/icon.png',
    adapter: '@solana/wallet-adapter-backpack',
  },
  glow: {
    name: 'glow',
    url: 'https://glow.app',
    icon: 'https://glow.app/icon.png',
    adapter: '@solana/wallet-adapter-glow',
  },
  coinbase: {
    name: 'coinbase',
    url: 'https://www.coinbase.com/wallet',
    icon: 'https://www.coinbase.com/favicon.ico',
    adapter: '@solana/wallet-adapter-coinbase',
  },
  torus: {
    name: 'torus',
    url: 'https://tor.us',
    icon: 'https://tor.us/favicon.ico',
    adapter: '@solana/wallet-adapter-torus',
  },
  ledger: {
    name: 'ledger',
    url: 'https://www.ledger.com',
    icon: 'https://www.ledger.com/favicon.ico',
    adapter: '@solana/wallet-adapter-ledger',
  },
};

// ---- Cluster Endpoints ----

export const CLUSTER_ENDPOINTS: Record<string, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'localnet': 'http://localhost:8899',
};

export function getEndpoint(cluster: string): string {
  return CLUSTER_ENDPOINTS[cluster] || cluster;
}

// ---- Address Utilities ----

export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function getExplorerUrl(
  addressOrTx: string,
  cluster: string = 'devnet',
  type: 'address' | 'tx' | 'token' | 'block' = 'address'
): string {
  const base = 'https://explorer.solana.com';
  return `${base}/${type}/${addressOrTx}?cluster=${cluster}`;
}

export function getSolscanUrl(
  addressOrTx: string,
  cluster: string = 'devnet',
  type: 'account' | 'tx' | 'token' = 'account'
): string {
  const base = cluster === 'mainnet-beta'
    ? 'https://solscan.io'
    : `https://solscan.io`;
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `${base}/${type}/${addressOrTx}${clusterParam}`;
}

// ---- Wallet Connection Helpers ----

export function createWalletConfig(options: Partial<WalletConfig> = {}): WalletConfig {
  return {
    autoConnect: options.autoConnect ?? false,
    cluster: options.cluster ?? 'devnet',
    commitment: options.commitment ?? 'confirmed',
    endpoint: options.endpoint ?? getEndpoint(options.cluster ?? 'devnet'),
  };
}

/**
 * Generate the TypeScript/JavaScript code for wallet adapter setup.
 * Used by the Purp codegen when emitting client{} blocks.
 */
export function generateWalletSetupCode(wallets: WalletName[], config: WalletConfig): string {
  const imports = wallets.map(w => {
    const info = KNOWN_WALLETS[w];
    const adapterName = w.charAt(0).toUpperCase() + w.slice(1) + 'WalletAdapter';
    return `import { ${adapterName} } from '${info.adapter}';`;
  }).join('\n');

  const adapters = wallets.map(w => {
    const adapterName = w.charAt(0).toUpperCase() + w.slice(1) + 'WalletAdapter';
    return `  new ${adapterName}()`;
  }).join(',\n');

  return `${imports}
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';

const endpoint = '${config.endpoint || getEndpoint(config.cluster || 'devnet')}';
const wallets = [
${adapters}
];

// Wrap your app with:
// <ConnectionProvider endpoint={endpoint}>
//   <WalletProvider wallets={wallets} autoConnect={${config.autoConnect ?? false}}>
//     {children}
//   </WalletProvider>
// </ConnectionProvider>
`;
}

// ---- Balance Formatting ----

export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / 1_000_000_000;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1_000_000_000));
}

export function formatSol(lamports: number | bigint, decimals: number = 4): string {
  const sol = lamportsToSol(lamports);
  return `${sol.toFixed(decimals)} SOL`;
}
