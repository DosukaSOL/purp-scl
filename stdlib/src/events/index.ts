// Purp Standard Library — Events Module
// Event/logging helpers for Solana programs

export interface PurpEvent {
  name: string;
  data: Record<string, unknown>;
  timestamp?: number;
  slot?: number;
}

export function createEvent(name: string, data: Record<string, unknown>): PurpEvent {
  return { name, data, timestamp: Date.now() };
}

export function formatEventLog(event: PurpEvent): string {
  return `[EVENT] ${event.name}: ${JSON.stringify(event.data)}`;
}

export function parseEventFromLogs(logs: string[], eventName: string): PurpEvent | null {
  for (const log of logs) {
    if (log.includes(`Program log: ${eventName}`)) {
      try {
        const dataStr = log.split(`${eventName}:`)[1]?.trim();
        if (dataStr) {
          return { name: eventName, data: JSON.parse(dataStr) };
        }
      } catch { /* skip parse errors */ }
    }
  }
  return null;
}

export type EventListener = (event: PurpEvent) => void;

export class EventEmitter {
  private listeners: Map<string, EventListener[]> = new Map();

  on(eventName: string, listener: EventListener): void {
    const existing = this.listeners.get(eventName) ?? [];
    existing.push(listener);
    this.listeners.set(eventName, existing);
  }

  emit(event: PurpEvent): void {
    const listeners = this.listeners.get(event.name) ?? [];
    for (const listener of listeners) {
      listener(event);
    }
  }

  off(eventName: string, listener: EventListener): void {
    const existing = this.listeners.get(eventName) ?? [];
    this.listeners.set(eventName, existing.filter(l => l !== listener));
  }
}
