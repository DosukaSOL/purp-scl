// ============================================================================
// purp dev — Development mode with file watching
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';

interface WatchState {
  lastBuild: Map<string, number>;
  building: boolean;
  buildCount: number;
}

function findPurpFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'target' && entry.name !== 'dist') {
      results.push(...findPurpFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.purp')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function runBuild(args: string[], state: WatchState): Promise<void> {
  if (state.building) return;
  state.building = true;
  state.buildCount++;

  const timestamp = new Date().toLocaleTimeString();
  console.log(`\x1b[36m⟡\x1b[0m [${timestamp}] Build #${state.buildCount} starting...`);

  try {
    const { buildCommand } = await import('./build.js');
    await buildCommand(args);
    console.log(`\x1b[32m✓\x1b[0m [${timestamp}] Build #${state.buildCount} complete`);
  } catch (e: any) {
    console.error(`\x1b[31m✖\x1b[0m [${timestamp}] Build #${state.buildCount} failed: ${e.message}`);
  }

  state.building = false;
}

export async function devCommand(args: string[]): Promise<void> {
  const srcDir = args.find(a => !a.startsWith('-')) ?? 'src';
  const watchDirs = [srcDir, 'examples', 'templates'].filter(d => fs.existsSync(d));

  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Dev Mode\x1b[0m');
  console.log('');
  console.log(`  Watching: ${watchDirs.join(', ')} for .purp changes`);
  console.log('  Press Ctrl+C to stop');
  console.log('');

  const state: WatchState = {
    lastBuild: new Map(),
    building: false,
    buildCount: 0,
  };

  // Initial build
  await runBuild(args.filter(a => a !== srcDir), state);

  // Snapshot file mtimes
  for (const dir of watchDirs) {
    for (const file of findPurpFiles(dir)) {
      const stat = fs.statSync(file);
      state.lastBuild.set(file, stat.mtimeMs);
    }
  }

  // Poll-based file watcher (no external dependencies needed)
  const POLL_INTERVAL = 500; // ms
  const debounceMs = 300;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const pollForChanges = (): void => {
    let changed = false;

    for (const dir of watchDirs) {
      for (const file of findPurpFiles(dir)) {
        try {
          const stat = fs.statSync(file);
          const lastMtime = state.lastBuild.get(file);
          if (lastMtime === undefined || stat.mtimeMs > lastMtime) {
            state.lastBuild.set(file, stat.mtimeMs);
            if (lastMtime !== undefined) {
              console.log(`  \x1b[33m↻\x1b[0m Changed: ${path.relative(process.cwd(), file)}`);
              changed = true;
            }
          }
        } catch { /* file may have been deleted */ }
      }
    }

    if (changed && !debounceTimer) {
      debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        await runBuild(args.filter(a => a !== srcDir), state);
      }, debounceMs);
    }
  };

  // Use fs.watch if available (faster + event-based), fall back to polling
  let useNativeWatch = true;
  const watchers: fs.FSWatcher[] = [];

  for (const dir of watchDirs) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (event, filename) => {
        if (filename && filename.endsWith('.purp')) {
          const fullPath = path.join(dir, filename);
          console.log(`  \x1b[33m↻\x1b[0m ${event}: ${filename}`);
          if (!debounceTimer) {
            debounceTimer = setTimeout(async () => {
              debounceTimer = null;
              await runBuild(args.filter(a => a !== srcDir), state);
            }, debounceMs);
          }
        }
      });
      watchers.push(watcher);
    } catch {
      useNativeWatch = false;
      break;
    }
  }

  if (!useNativeWatch) {
    // Fallback to polling
    console.log('  Using poll-based file watching');
    setInterval(pollForChanges, POLL_INTERVAL);
  } else {
    console.log('  Using native file watching');
  }

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n\x1b[35m⟡\x1b[0m Dev mode stopped.');
    for (const w of watchers) w.close();
    process.exit(0);
  });

  // Prevent exit
  await new Promise(() => {});
}

