// ============================================================================
// Purp Linter v0.2.0 — The Solana Coding Language
// Static analysis rules for Purp source files
// ============================================================================

import * as AST from '../ast/index.js';
import { PurpDiagnostics, ErrorCode } from '../errors/index.js';

export interface LintRule {
  name: string;
  severity: 'error' | 'warning' | 'info';
  check: (node: AST.ASTNode, ctx: LintContext) => void;
}

export interface LintContext {
  diagnostics: PurpDiagnostics;
  file: string;
}

export interface LintResult {
  errors: number;
  warnings: number;
  infos: number;
  diagnostics: PurpDiagnostics;
}

export class PurpLinter {
  private rules: LintRule[] = [];

  constructor() {
    this.registerDefaultRules();
  }

  lint(program: AST.ProgramNode, file: string = '<stdin>'): LintResult {
    const diagnostics = new PurpDiagnostics();
    const ctx: LintContext = { diagnostics, file };

    this.walkProgram(program, ctx);

    return {
      errors: diagnostics.getErrors().length,
      warnings: diagnostics.getWarnings().length,
      infos: diagnostics.getAll().length - diagnostics.getErrors().length - diagnostics.getWarnings().length,
      diagnostics,
    };
  }

  addRule(rule: LintRule): void {
    this.rules.push(rule);
  }

  private registerDefaultRules(): void {
    // Rule: unused-variable (detect let statements not referenced)
    this.addRule({
      name: 'naming-convention',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'FunctionDeclaration') {
          const fn = node as AST.FunctionDeclaration;
          if (fn.name !== fn.name.toLowerCase() && fn.name.includes('-')) {
            ctx.diagnostics.warning(
              ErrorCode.ParseError,
              `Function '${fn.name}' should use snake_case naming`,
              fn.span.start, ctx.file,
              'Use snake_case for function names: my_function',
            );
          }
        }
        if (node.kind === 'StructDeclaration') {
          const s = node as AST.StructDeclaration;
          if (s.name[0] !== s.name[0].toUpperCase()) {
            ctx.diagnostics.warning(
              ErrorCode.ParseError,
              `Struct '${s.name}' should use PascalCase naming`,
              s.span.start, ctx.file,
              'Use PascalCase for struct names: MyStruct',
            );
          }
        }
      },
    });

    // Rule: no-unsafe-arithmetic (detect potential overflow)
    this.addRule({
      name: 'no-unsafe-arithmetic',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'BinaryExpr') {
          const expr = node as AST.BinaryExpr;
          if (['+', '-', '*'].includes(expr.operator)) {
            // Warn about potential overflow
            if (expr.left.kind === 'NumberLiteral' || expr.right.kind === 'NumberLiteral') {
              // Number literals are fine, they can be checked at compile time
              return;
            }
          }
        }
      },
    });

    // Rule: require-signer (instructions should have at least one signer)
    this.addRule({
      name: 'require-signer',
      severity: 'error',
      check: (node, ctx) => {
        if (node.kind === 'InstructionDeclaration') {
          const instr = node as AST.InstructionDeclaration;
          const hasSigner = instr.accounts.some(a => a.accountType.kind === 'Signer');
          if (!hasSigner && instr.accounts.length > 0) {
            ctx.diagnostics.warning(
              ErrorCode.MissingAccountConstraint,
              `Instruction '${instr.name}' has no signer — this is a security risk`,
              instr.span.start, ctx.file,
              'Add at least one signer account for authorization',
            );
          }
        }
      },
    });

    // Rule: no-hardcoded-keys (detect hardcoded public keys)
    this.addRule({
      name: 'no-hardcoded-keys',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'PubkeyLiteral') {
          const pk = node as AST.PubkeyLiteral;
          ctx.diagnostics.warning(
            ErrorCode.ParseError,
            `Hardcoded public key detected: ${pk.value.slice(0, 8)}...`,
            pk.span.start, ctx.file,
            'Consider using a constant or environment variable for public keys',
          );
        }
      },
    });

    // Rule: init-needs-payer
    this.addRule({
      name: 'init-needs-payer',
      severity: 'error',
      check: (node, ctx) => {
        if (node.kind === 'AccountParam') {
          const acc = node as AST.AccountParam;
          const isInit = acc.constraints.some(c => c.kind === 'init');
          const hasPayer = acc.constraints.some(c => c.kind === 'payer');
          if (isInit && !hasPayer) {
            ctx.diagnostics.error(
              ErrorCode.MissingAccountConstraint,
              `Init account '${acc.name}' requires a payer`,
              acc.span.start, ctx.file,
              'Add payer constraint: payer = authority',
            );
          }
        }
      },
    });

    // Rule: no-empty-body
    this.addRule({
      name: 'no-empty-body',
      severity: 'info',
      check: (node, ctx) => {
        if (node.kind === 'FunctionDeclaration') {
          const fn = node as AST.FunctionDeclaration;
          if (fn.body.length === 0) {
            ctx.diagnostics.warning(
              ErrorCode.ParseError,
              `Function '${fn.name}' has an empty body`,
              fn.span.start, ctx.file,
            );
          }
        }
      },
    });
  }

  private walkProgram(program: AST.ProgramNode, ctx: LintContext): void {
    for (const node of program.body) {
      this.walkNode(node, ctx);
    }
  }

  private walkNode(node: AST.ASTNode, ctx: LintContext): void {
    // Run all rules on this node
    for (const rule of this.rules) {
      rule.check(node, ctx);
    }

    // Walk children
    if ('body' in node && Array.isArray((node as any).body)) {
      for (const child of (node as any).body) {
        if (child && typeof child === 'object' && 'kind' in child) {
          this.walkNode(child, ctx);
        }
      }
    }
    if ('accounts' in node && Array.isArray((node as any).accounts)) {
      for (const child of (node as any).accounts) {
        if (child && typeof child === 'object' && 'kind' in child) {
          this.walkNode(child, ctx);
        }
      }
    }
    if ('then' in node && Array.isArray((node as any).then)) {
      for (const child of (node as any).then) {
        this.walkNode(child, ctx);
      }
    }
    if ('else' in node && Array.isArray((node as any).else)) {
      for (const child of (node as any).else) {
        this.walkNode(child, ctx);
      }
    }
    if ('arms' in node && Array.isArray((node as any).arms)) {
      for (const arm of (node as any).arms) {
        if (arm.body) for (const child of arm.body) this.walkNode(child, ctx);
      }
    }
    if ('methods' in node && Array.isArray((node as any).methods)) {
      for (const child of (node as any).methods) {
        this.walkNode(child, ctx);
      }
    }
    if ('fields' in node && Array.isArray((node as any).fields)) {
      for (const child of (node as any).fields) {
        if (child && typeof child === 'object' && 'kind' in child) {
          this.walkNode(child, ctx);
        }
      }
    }
  }
}

export function lintPurpAST(program: AST.ProgramNode, file?: string): LintResult {
  const linter = new PurpLinter();
  return linter.lint(program, file);
}
