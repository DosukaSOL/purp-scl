// Purp Standard Library — Frontend Module
// Frontend binding helpers

export interface PurpComponent {
  name: string;
  props: Record<string, unknown>;
  render: () => string;
}

export interface ConnectionConfig {
  endpoint: string;
  wsEndpoint?: string;
  commitment?: string;
}

export const CLUSTERS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'localhost': 'http://localhost:8899',
} as const;

export function getClusterUrl(cluster: keyof typeof CLUSTERS): string {
  return CLUSTERS[cluster];
}

export function generateConnectButton(config?: { label?: string; className?: string }): string {
  return `<button class="${config?.className ?? 'purp-connect-btn'}" onclick="connectWallet()">${config?.label ?? 'Connect Wallet'}</button>`;
}
