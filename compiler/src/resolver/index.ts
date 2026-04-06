// ============================================================================
// Purp Module Resolver — The Solana Coding Language
// Resolves import declarations and merges multi-file programs
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as AST from '../ast/index.js';
import { Lexer } from '../lexer/index.js';
import { Parser } from '../parser/index.js';
import { PurpDiagnostics, ErrorCode } from '../errors/index.js';

export interface ResolveOptions {
  /** Base directory for resolving relative imports */
  baseDir: string;
  /** Search paths for package imports (e.g. node_modules/@purp/) */
  searchPaths?: string[];
  /** Already-resolved file paths (cycle detection) */
  resolved?: Set<string>;
  /** Diagnostics collector */
  diagnostics?: PurpDiagnostics;
}

/**
 * Resolve all imports in an AST, returning a merged AST with imported
 * declarations inlined. Handles:
 *  - Relative imports: `import { X } from "./other.purp"`
 *  - Package imports:  `use { X } from "@purp/tokens"`
 *  - Wildcard imports: `import * from "./utils.purp"`
 *  - Aliased imports:  `import { X as Y } from "./other.purp"`
 *  - Circular import detection
 */
export function resolveImports(
  ast: AST.ProgramNode,
  options: ResolveOptions,
): AST.ProgramNode {
  const resolved = options.resolved ?? new Set<string>();
  const diagnostics = options.diagnostics ?? new PurpDiagnostics();
  const searchPaths = options.searchPaths ?? [];

  // Extract imports from top-level and from program bodies
  const imports: AST.ImportDeclaration[] = [];
  const remaining: AST.TopLevelNode[] = [];

  collectImports(ast.body, imports, remaining);

  if (imports.length === 0) return ast;

  const importedNodes: AST.TopLevelNode[] = [];

  for (const imp of imports) {
    const resolvedPath = resolveImportPath(imp.path, options.baseDir, searchPaths);

    if (!resolvedPath) {
      diagnostics.warning(
        ErrorCode.UnsupportedFeature,
        `Cannot resolve import "${imp.path}" — file not found`,
        imp.span?.start,
        undefined,
        `Check that the file exists relative to ${options.baseDir}`,
      );
      continue;
    }

    // Circular import detection
    const canonical = path.resolve(resolvedPath);
    if (resolved.has(canonical)) {
      // Already imported — skip (not an error, just don't re-import)
      continue;
    }
    resolved.add(canonical);

    // Read and parse the imported file
    let source: string;
    try {
      source = fs.readFileSync(resolvedPath, 'utf-8');
    } catch {
      diagnostics.warning(
        ErrorCode.UnsupportedFeature,
        `Cannot read import "${imp.path}" at ${resolvedPath}`,
        imp.span?.start,
      );
      continue;
    }

    const lexer = new Lexer(source, resolvedPath);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, resolvedPath);
    const importedAst = parser.parse();

    // Recursively resolve imports in the imported file
    const resolvedAst = resolveImports(importedAst, {
      baseDir: path.dirname(resolvedPath),
      searchPaths,
      resolved,
      diagnostics,
    });

    // Filter imported declarations based on import items
    const exported = flattenDeclarations(resolvedAst.body);

    if (imp.isWildcard) {
      // Import everything
      importedNodes.push(...exported);
    } else if (imp.items.length > 0) {
      // Import specific items
      for (const item of imp.items) {
        const found = exported.find(n => getNodeName(n) === item.name);
        if (found) {
          if (item.alias) {
            // Clone and rename
            importedNodes.push(renameNode(found, item.alias));
          } else {
            importedNodes.push(found);
          }
        } else {
          diagnostics.warning(
            ErrorCode.UnsupportedFeature,
            `"${item.name}" not found in "${imp.path}"`,
            item.span?.start,
          );
        }
      }
    } else {
      // bare import (no items, no wildcard) — import everything
      importedNodes.push(...exported);
    }
  }

  // Merge: imported declarations first, then original declarations
  return {
    ...ast,
    body: [...importedNodes, ...remaining],
  };
}

// ============================================================================
// Helpers
// ============================================================================

function collectImports(
  nodes: AST.TopLevelNode[],
  imports: AST.ImportDeclaration[],
  remaining: AST.TopLevelNode[],
): void {
  for (const node of nodes) {
    if (node.kind === 'ImportDeclaration') {
      imports.push(node);
    } else if (node.kind === 'ProgramDeclaration') {
      // Also collect imports from inside program{} blocks
      const progImports: AST.ImportDeclaration[] = [];
      const progRemaining: AST.TopLevelNode[] = [];
      collectImports(node.body, progImports, progRemaining);
      imports.push(...progImports);
      remaining.push({ ...node, body: progRemaining } as AST.ProgramDeclaration);
    } else {
      remaining.push(node);
    }
  }
}

function resolveImportPath(
  importPath: string,
  baseDir: string,
  searchPaths: string[],
): string | null {
  // Strip quotes if present
  const cleaned = importPath.replace(/^["']|["']$/g, '');

  // Relative import
  if (cleaned.startsWith('./') || cleaned.startsWith('../')) {
    const full = path.resolve(baseDir, cleaned);
    // Try exact path, then with .purp extension
    if (fs.existsSync(full)) return full;
    if (fs.existsSync(full + '.purp')) return full + '.purp';
    return null;
  }

  // Package import (e.g. @purp/tokens)
  if (cleaned.startsWith('@purp/')) {
    const pkgName = cleaned.slice(6); // strip "@purp/"
    for (const searchPath of searchPaths) {
      const pkgDir = path.join(searchPath, pkgName);
      // Look for index.purp or src/index.purp in package
      const candidates = [
        path.join(pkgDir, 'index.purp'),
        path.join(pkgDir, 'src', 'index.purp'),
        path.join(pkgDir, `${pkgName}.purp`),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
    }

    // Also try in the project's purp_modules/ directory
    const purpModules = path.join(baseDir, 'purp_modules', pkgName);
    const moduleCandidates = [
      path.join(purpModules, 'index.purp'),
      path.join(purpModules, 'src', 'index.purp'),
    ];
    for (const candidate of moduleCandidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  // Bare import (e.g. "utils") — search in base dir
  const bare = path.resolve(baseDir, cleaned);
  if (fs.existsSync(bare)) return bare;
  if (fs.existsSync(bare + '.purp')) return bare + '.purp';

  return null;
}

function flattenDeclarations(nodes: AST.TopLevelNode[]): AST.TopLevelNode[] {
  const result: AST.TopLevelNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'ProgramDeclaration') {
      // Extract declarations from program blocks
      result.push(...node.body);
    } else if (node.kind === 'ImportDeclaration') {
      // Don't re-export imports
      continue;
    } else {
      result.push(node);
    }
  }
  return result;
}

function getNodeName(node: AST.TopLevelNode): string | null {
  switch (node.kind) {
    case 'AccountDeclaration': return node.name;
    case 'InstructionDeclaration': return node.name;
    case 'EventDeclaration': return node.name;
    case 'ErrorDeclaration': return node.name;
    case 'StructDeclaration': return node.name;
    case 'EnumDeclaration': return node.name;
    case 'ConstDeclaration': return node.name;
    case 'FunctionDeclaration': return node.name;
    case 'TraitDeclaration': return node.name;
    case 'ClientBlock': return node.name;
    default: return null;
  }
}

function renameNode(node: AST.TopLevelNode, newName: string): AST.TopLevelNode {
  if ('name' in node) {
    return { ...node, name: newName } as AST.TopLevelNode;
  }
  return node;
}
