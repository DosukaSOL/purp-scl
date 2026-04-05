// Purp Standard Library — Frontend Module
// Frontend component generation and UI helpers for Solana dApps

// ---- Types ----

export interface PurpComponent {
  name: string;
  props: Record<string, unknown>;
  children?: PurpComponent[];
  render: () => string;
}

export interface ConnectionConfig {
  endpoint: string;
  wsEndpoint?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface ThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
}

// ---- Cluster URLs ----

export const CLUSTERS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'localhost': 'http://localhost:8899',
} as const;

export function getClusterUrl(cluster: keyof typeof CLUSTERS): string {
  return CLUSTERS[cluster];
}

// ---- Default Theme ----

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#9945FF',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  fontFamily: "'Inter', -apple-system, sans-serif",
  borderRadius: '8px',
};

// ---- Component Generators ----

export function generateConnectButton(config?: { label?: string; className?: string; theme?: Partial<ThemeConfig> }): string {
  const theme = { ...DEFAULT_THEME, ...config?.theme };
  const className = config?.className ?? 'purp-connect-btn';
  const label = config?.label ?? 'Connect Wallet';
  return `<button class="${className}" style="background:${theme.primaryColor};color:${theme.textColor};border:none;padding:12px 24px;border-radius:${theme.borderRadius};font-family:${theme.fontFamily};cursor:pointer;font-size:16px;font-weight:600;" onclick="connectWallet()">${label}</button>`;
}

export function generateBalanceDisplay(config?: { className?: string; format?: 'sol' | 'lamports' }): string {
  const className = config?.className ?? 'purp-balance';
  return `<div class="${className}" id="purp-balance-display">
  <span class="balance-label">Balance</span>
  <span class="balance-value" id="balance-value">-- SOL</span>
</div>`;
}

export function generateTransactionForm(config?: {
  fields?: { name: string; label: string; type: string; placeholder?: string }[];
  submitLabel?: string;
  className?: string;
}): string {
  const fields = config?.fields ?? [
    { name: 'recipient', label: 'Recipient', type: 'text', placeholder: 'Wallet address...' },
    { name: 'amount', label: 'Amount (SOL)', type: 'number', placeholder: '0.0' },
  ];
  const submitLabel = config?.submitLabel ?? 'Send Transaction';
  const className = config?.className ?? 'purp-tx-form';
  
  const fieldHtml = fields.map(f =>
    `  <div class="form-field">
    <label for="${f.name}">${f.label}</label>
    <input type="${f.type}" id="${f.name}" name="${f.name}" placeholder="${f.placeholder ?? ''}" />
  </div>`
  ).join('\n');
  
  return `<form class="${className}" onsubmit="handleTransaction(event)">
${fieldHtml}
  <button type="submit">${submitLabel}</button>
</form>`;
}

export function generateNFTGallery(config?: { columns?: number; className?: string }): string {
  const columns = config?.columns ?? 3;
  const className = config?.className ?? 'purp-nft-gallery';
  return `<div class="${className}" id="purp-nft-gallery" style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:16px;"></div>`;
}

export function generateNotificationArea(config?: { position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' }): string {
  const pos = config?.position ?? 'bottom-right';
  const posStyle = {
    'top-right': 'top:16px;right:16px;',
    'bottom-right': 'bottom:16px;right:16px;',
    'top-left': 'top:16px;left:16px;',
    'bottom-left': 'bottom:16px;left:16px;',
  }[pos];
  return `<div id="purp-notifications" style="position:fixed;${posStyle}z-index:1000;display:flex;flex-direction:column;gap:8px;"></div>`;
}

// ---- Full Page Scaffolds ----

export function generateDAppHTML(config: {
  title: string;
  theme?: Partial<ThemeConfig>;
  includeWallet?: boolean;
  includeBalance?: boolean;
  bodyContent?: string;
}): string {
  const theme = { ...DEFAULT_THEME, ...config.theme };
  const walletBtn = config.includeWallet !== false ? generateConnectButton({ theme: config.theme }) : '';
  const balance = config.includeBalance ? generateBalanceDisplay() : '';
  const body = config.bodyContent ?? '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${theme.fontFamily};
      background: ${theme.backgroundColor};
      color: ${theme.textColor};
      min-height: 100vh;
    }
    .purp-app { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .purp-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px; }
    .purp-header h1 { font-size: 24px; background: linear-gradient(135deg, ${theme.primaryColor}, #14F195); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  </style>
</head>
<body>
  <div class="purp-app">
    <header class="purp-header">
      <h1>${config.title}</h1>
      <div>${walletBtn}</div>
    </header>
    ${balance}
    <main>${body}</main>
  </div>
  ${generateNotificationArea()}
  <script>
    async function connectWallet() {
      if (window.solana && window.solana.isPhantom) {
        try {
          const resp = await window.solana.connect();
          console.log('Connected:', resp.publicKey.toString());
          document.querySelector('.purp-connect-btn').textContent = resp.publicKey.toString().slice(0, 4) + '...' + resp.publicKey.toString().slice(-4);
        } catch (err) { console.error(err); }
      } else {
        window.open('https://phantom.app/', '_blank');
      }
    }
  </script>
</body>
</html>`;
}

// ---- React Component Generators ----

export function generateReactComponent(name: string, props: { name: string; type: string }[], jsxBody: string): string {
  const propsInterface = props.length > 0
    ? `interface ${name}Props {\n${props.map(p => `  ${p.name}: ${p.type};`).join('\n')}\n}\n\n`
    : '';
  const propsParam = props.length > 0 ? `{ ${props.map(p => p.name).join(', ')} }: ${name}Props` : '';
  
  return `${propsInterface}export function ${name}(${propsParam}) {
  return (
    ${jsxBody}
  );
}`;
}

export function generateReactHook(name: string, body: string): string {
  return `export function ${name}() {
  ${body}
}`;
}

// ---- CSS-in-JS Helpers ----

export function generateStyles(theme: Partial<ThemeConfig> = {}): string {
  const t = { ...DEFAULT_THEME, ...theme };
  return `:root {
  --purp-primary: ${t.primaryColor};
  --purp-bg: ${t.backgroundColor};
  --purp-text: ${t.textColor};
  --purp-font: ${t.fontFamily};
  --purp-radius: ${t.borderRadius};
}`;
}
