// Purp Standard Library — Web Module
// HTTP client, API generation, JSON helpers, and WebSocket utilities

// ---- Types ----

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  middleware?: string[];
  description?: string;
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface FetchResult<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T;
  headers: Record<string, string>;
  elapsed: number;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// ---- HTTP Client ----

/**
 * Fetch JSON data with retries, timeout, and error handling.
 */
export async function fetchJSON<T = unknown>(url: string, options: FetchOptions = {}): Promise<FetchResult<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30000,
    retries = 0,
    retryDelay = 1000,
  } = options;

  const controller = new AbortController();
  const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;

  const fetchOpts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    signal: controller.signal,
  };
  if (body && method !== 'GET') {
    fetchOpts.body = JSON.stringify(body);
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const start = Date.now();
      const response = await fetch(url, fetchOpts);
      const data = await response.json() as T;
      if (timer) clearTimeout(timer);
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        elapsed: Date.now() - start,
      };
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
      }
    }
  }
  if (timer) clearTimeout(timer);
  throw lastError ?? new Error('Fetch failed');
}

/**
 * Make a Solana JSON-RPC call.
 */
export async function rpcCall<T = unknown>(
  endpoint: string,
  method: string,
  params: unknown[] = []
): Promise<T> {
  const result = await fetchJSON<{ result: T; error?: { message: string } }>(endpoint, {
    method: 'POST',
    body: { jsonrpc: '2.0', id: 1, method, params },
  });
  if (result.data.error) throw new Error(`RPC Error: ${result.data.error.message}`);
  return result.data.result;
}

// ---- API Route Generation ----

export function generateAPIRoute(endpoint: APIEndpoint): string {
  const middleware = endpoint.middleware?.length
    ? endpoint.middleware.join(', ') + ', '
    : '';
  return `app.${endpoint.method.toLowerCase()}('${endpoint.path}', ${middleware}${endpoint.handler});`;
}

export function generateAPIRouter(endpoints: APIEndpoint[]): string {
  const routes = endpoints.map(generateAPIRoute).join('\n');
  return `import { Router } from 'express';
const router = Router();

${routes}

export default router;`;
}

export function generateOpenAPISpec(title: string, version: string, endpoints: APIEndpoint[]): object {
  const paths: Record<string, unknown> = {};
  for (const ep of endpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    (paths[ep.path] as Record<string, unknown>)[ep.method.toLowerCase()] = {
      summary: ep.description ?? `${ep.method} ${ep.path}`,
      responses: { '200': { description: 'Success' } },
    };
  }
  return {
    openapi: '3.0.0',
    info: { title, version },
    paths,
  };
}

// ---- CORS & Headers ----

export function corsHeaders(origin: string = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

export function securityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
  };
}

// ---- Health & Status ----

export function healthCheck(): { status: string; timestamp: number; uptime: number } {
  return { status: 'ok', timestamp: Date.now(), uptime: process.uptime() };
}

// ---- JSON Utilities ----

export function safeParseJSON<T = unknown>(text: string): { ok: true; data: T } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function prettyJSON(data: unknown, indent: number = 2): string {
  return JSON.stringify(data, null, indent);
}

// ---- WebSocket Helpers ----

export function createWebSocketConfig(url: string, options: Partial<WebSocketConfig> = {}): WebSocketConfig {
  return {
    url,
    protocols: options.protocols,
    reconnect: options.reconnect ?? true,
    reconnectInterval: options.reconnectInterval ?? 3000,
    maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
  };
}

/**
 * Generate client-side WebSocket connection code.
 */
export function generateWebSocketClient(config: WebSocketConfig): string {
  return `let ws;
let reconnectAttempts = 0;

function connect() {
  ws = new WebSocket('${config.url}'${config.protocols ? `, ${JSON.stringify(config.protocols)}` : ''});
  ws.onopen = () => { console.log('Connected'); reconnectAttempts = 0; };
  ws.onmessage = (event) => { handleMessage(JSON.parse(event.data)); };
  ws.onclose = () => {
    ${config.reconnect ? `if (reconnectAttempts < ${config.maxReconnectAttempts ?? 10}) {
      reconnectAttempts++;
      setTimeout(connect, ${config.reconnectInterval ?? 3000});
    }` : ''}
  };
  ws.onerror = (error) => { console.error('WebSocket error:', error); };
}

function send(data) { ws.send(JSON.stringify(data)); }
connect();`;
}

/**
 * Subscribe to a Solana account via WebSocket.
 */
export function solanaSubscribeAccount(endpoint: string, account: string): string {
  const wsEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
  return `const ws = new WebSocket('${wsEndpoint}');
ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'accountSubscribe',
    params: ['${account}', { encoding: 'jsonParsed', commitment: 'confirmed' }]
  }));
};
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'accountNotification') {
    handleAccountUpdate(data.params.result);
  }
};`;
}

// ============================================================================
// Solana WebSocket Subscriptions
// ============================================================================

export interface SolanaSubscription {
  id: number;
  method: string;
  unsubscribeMethod: string;
}

/**
 * Subscribe to program logs via WebSocket.
 */
export function solanaSubscribeLogs(endpoint: string, programId: string): string {
  const wsEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
  return `const ws = new WebSocket('${wsEndpoint}');
ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'logsSubscribe',
    params: [{ mentions: ['${programId}'] }, { commitment: 'confirmed' }]
  }));
};
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'logsNotification') {
    const { signature, logs, err } = data.params.result.value;
    handleLogsUpdate({ signature, logs, err });
  }
};`;
}

/**
 * Subscribe to transaction signature confirmation.
 */
export function solanaSubscribeSignature(endpoint: string, signature: string): string {
  const wsEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
  return `const ws = new WebSocket('${wsEndpoint}');
ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'signatureSubscribe',
    params: ['${signature}', { commitment: 'confirmed' }]
  }));
};
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'signatureNotification') {
    handleSignatureConfirmed(data.params.result);
    ws.close();
  }
};`;
}

/**
 * Subscribe to all account changes for a program.
 */
export function solanaSubscribeProgram(endpoint: string, programId: string): string {
  const wsEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
  return `const ws = new WebSocket('${wsEndpoint}');
ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'programSubscribe',
    params: ['${programId}', { encoding: 'jsonParsed', commitment: 'confirmed' }]
  }));
};
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'programNotification') {
    const { pubkey, account } = data.params.result.value;
    handleProgramAccountUpdate({ pubkey, account });
  }
};`;
}

/**
 * Subscribe to slot changes.
 */
export function solanaSubscribeSlot(endpoint: string): string {
  const wsEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
  return `const ws = new WebSocket('${wsEndpoint}');
ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'slotSubscribe'
  }));
};
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'slotNotification') {
    const { slot, parent, root } = data.params.result;
    handleSlotUpdate({ slot, parent, root });
  }
};`;
}

/**
 * Subscribe to root changes (finality).
 */
export function solanaSubscribeRoot(endpoint: string): string {
  const wsEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
  return `const ws = new WebSocket('${wsEndpoint}');
ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'rootSubscribe'
  }));
};
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'rootNotification') {
    handleRootUpdate(data.params.result);
  }
};`;
}
