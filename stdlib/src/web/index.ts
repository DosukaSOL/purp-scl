// Purp Standard Library — Web Module
// Web integration helpers

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: string;
}

export function generateAPIRoute(endpoint: APIEndpoint): string {
  return `app.${endpoint.method.toLowerCase()}('${endpoint.path}', ${endpoint.handler});`;
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function healthCheck(): { status: string; timestamp: number } {
  return { status: 'ok', timestamp: Date.now() };
}
