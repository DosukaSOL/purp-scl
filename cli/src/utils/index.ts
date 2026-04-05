// ============================================================================
// Purp CLI Utilities
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Find all .purp files recursively in a directory
 */
export function findPurpFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findPurpFiles(fullPath));
    } else if (entry.name.endsWith('.purp')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Ensure a directory exists
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read purp.toml configuration (simple TOML parser for basic config)
 */
export function readConfig(): Record<string, any> | null {
  const configPath = path.join(process.cwd(), 'purp.toml');
  if (!fs.existsSync(configPath)) return null;

  const content = fs.readFileSync(configPath, 'utf-8');
  return parseSimpleToml(content);
}

/**
 * Minimal TOML parser for purp.toml
 * Handles [sections], key = "value", key = number, key = boolean
 */
function parseSimpleToml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentSection = result;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Section header
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1];
      result[sectionName] = result[sectionName] ?? {};
      currentSection = result[sectionName];
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value: any = kvMatch[2].trim();

      // String
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Boolean
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Number
      else if (/^\d+(\.\d+)?$/.test(value)) value = Number(value);
      // Array (simplified)
      else if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }

      currentSection[key] = value;
    }
  }
  return result;
}

/**
 * Pretty-print with colors
 */
export const colors = {
  purple: (s: string) => `\x1b[35m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
