// ============================================================================
// Purp Plugin System
// Supports custom codegen targets, lint rules, pre/post build hooks
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as AST from '../ast/index.js';

// ---- Plugin Interface ----

export interface PurpPlugin {
  name: string;
  version: string;
  description?: string;

  /** Called once when the plugin is loaded */
  setup?(ctx: PluginContext): void | Promise<void>;

  /** Pre-build hook — called before compilation starts */
  preBuild?(ctx: BuildHookContext): void | Promise<void>;

  /** Post-build hook — called after successful compilation */
  postBuild?(ctx: BuildHookContext): void | Promise<void>;

  /** Custom codegen target */
  codegen?(ast: AST.ProgramNode, options: Record<string, unknown>): string;

  /** Custom lint rules */
  lintRules?(): LintRuleDefinition[];

  /** Custom AST transform */
  transform?(ast: AST.ProgramNode): AST.ProgramNode;
}

export interface PluginContext {
  workspaceRoot: string;
  config: Record<string, unknown>;
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface BuildHookContext {
  files: string[];
  target: 'rust' | 'typescript' | 'both';
  outputs: Map<string, string>;
  config: Record<string, unknown>;
}

export interface LintRuleDefinition {
  id: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check(node: AST.TopLevelNode | AST.Statement | AST.Expression): LintIssue | null;
}

export interface LintIssue {
  ruleId: string;
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  fix?: { range: [number, number]; text: string };
}

// ---- Plugin Manager ----

export class PluginManager {
  private plugins: PurpPlugin[] = [];
  private ctx: PluginContext;

  constructor(workspaceRoot: string = process.cwd()) {
    this.ctx = {
      workspaceRoot,
      config: {},
      log: (msg) => console.log(`  \x1b[36m[plugin]\x1b[0m ${msg}`),
      warn: (msg) => console.log(`  \x1b[33m[plugin]\x1b[0m ${msg}`),
      error: (msg) => console.log(`  \x1b[31m[plugin]\x1b[0m ${msg}`),
    };
  }

  /** Register a plugin instance */
  register(plugin: PurpPlugin): void {
    this.plugins.push(plugin);
  }

  /** Load plugins from Purp.toml [plugins] section */
  async loadFromConfig(): Promise<void> {
    const tomlPath = path.join(this.ctx.workspaceRoot, 'Purp.toml');
    if (!fs.existsSync(tomlPath)) return;

    const content = fs.readFileSync(tomlPath, 'utf-8');
    let inPlugins = false;
    const pluginEntries: { name: string; path?: string }[] = [];

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '[plugins]') { inPlugins = true; continue; }
      if (trimmed.startsWith('[')) { inPlugins = false; continue; }
      if (!inPlugins || trimmed === '' || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([\w@/.-]+)\s*=\s*"?([^"]*)"?$/);
      if (match) {
        pluginEntries.push({ name: match[1], path: match[2] || undefined });
      }
    }

    for (const entry of pluginEntries) {
      await this.loadPlugin(entry.name, entry.path);
    }
  }

  /** Load a single plugin by name or path */
  async loadPlugin(name: string, pluginPath?: string): Promise<void> {
    try {
      const resolved = pluginPath
        ? path.resolve(this.ctx.workspaceRoot, pluginPath)
        : path.join(this.ctx.workspaceRoot, 'purp_modules', name, 'plugin.js');

      if (!fs.existsSync(resolved)) {
        this.ctx.warn(`Plugin not found: ${name} (${resolved})`);
        return;
      }

      const mod = await import(resolved);
      const plugin: PurpPlugin = mod.default ?? mod;

      if (!plugin.name) plugin.name = name;
      if (!plugin.version) plugin.version = '0.0.0';

      this.register(plugin);
      this.ctx.log(`Loaded plugin: ${plugin.name}@${plugin.version}`);
    } catch (e: any) {
      this.ctx.error(`Failed to load plugin ${name}: ${e.message}`);
    }
  }

  /** Initialize all plugins */
  async setup(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.setup) {
        await plugin.setup(this.ctx);
      }
    }
  }

  /** Run pre-build hooks */
  async preBuild(ctx: BuildHookContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.preBuild) {
        await plugin.preBuild(ctx);
      }
    }
  }

  /** Run post-build hooks */
  async postBuild(ctx: BuildHookContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.postBuild) {
        await plugin.postBuild(ctx);
      }
    }
  }

  /** Run custom codegen */
  runCodegen(target: string, ast: AST.ProgramNode, options: Record<string, unknown> = {}): string | null {
    for (const plugin of this.plugins) {
      if (plugin.codegen && plugin.name === target) {
        return plugin.codegen(ast, options);
      }
    }
    return null;
  }

  /** Collect all custom lint rules */
  collectLintRules(): LintRuleDefinition[] {
    const rules: LintRuleDefinition[] = [];
    for (const plugin of this.plugins) {
      if (plugin.lintRules) {
        rules.push(...plugin.lintRules());
      }
    }
    return rules;
  }

  /** Run AST transforms */
  transform(ast: AST.ProgramNode): AST.ProgramNode {
    let result = ast;
    for (const plugin of this.plugins) {
      if (plugin.transform) {
        result = plugin.transform(result);
      }
    }
    return result;
  }

  /** Get registered plugins */
  getPlugins(): ReadonlyArray<PurpPlugin> {
    return this.plugins;
  }
}
