// ============================================================================
// Purp Linter v1.0.0 — The Solana Coding Language
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
          if (fn.name !== fn.name.toLowerCase()) {
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
            // Number literals are fine, they can be checked at compile time
            if (expr.left.kind === 'NumberLiteral' && expr.right.kind === 'NumberLiteral') {
              return;
            }
            ctx.diagnostics.warning(
              ErrorCode.ParseError,
              `Potential arithmetic overflow in '${expr.operator}' operation — consider using checked math`,
              expr.span?.start, ctx.file,
              'Use checked_add/checked_sub/checked_mul for safe arithmetic',
            );
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
        if (node.kind === 'InstructionDeclaration') {
          const instr = node as AST.InstructionDeclaration;
          if (instr.body.length === 0) {
            ctx.diagnostics.warning(
              ErrorCode.ParseError,
              `Instruction '${instr.name}' has an empty body`,
              instr.span.start, ctx.file,
            );
          }
        }
      },
    });

    // Rule: no-unused-accounts (accounts declared but not referenced in body)
    this.addRule({
      name: 'no-unused-accounts',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'InstructionDeclaration') {
          const instr = node as AST.InstructionDeclaration;
          const bodyStr = JSON.stringify(instr.body);
          for (const acc of instr.accounts) {
            if (!bodyStr.includes(`"${acc.name}"`)) {
              ctx.diagnostics.warning(
                ErrorCode.ParseError,
                `Account '${acc.name}' is declared but never used in '${instr.name}'`,
                acc.span.start, ctx.file,
                'Remove unused accounts to reduce transaction size',
              );
            }
          }
        }
      },
    });

    // Rule: no-hardcoded-amounts (large numeric literals in SOL operations)
    this.addRule({
      name: 'no-hardcoded-amounts',
      severity: 'info',
      check: (node, ctx) => {
        if (node.kind === 'SolLiteral') {
          const sol = node as AST.SolLiteral;
          if (sol.amount > 10) {
            ctx.diagnostics.warning(
              ErrorCode.ParseError,
              `Large hardcoded SOL amount: ${sol.amount} SOL`,
              sol.span.start, ctx.file,
              'Consider using a constant for large amounts',
            );
          }
        }
      },
    });

    // Rule: enum-naming (enum names should be PascalCase)
    this.addRule({
      name: 'enum-naming',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'EnumDeclaration') {
          const e = node as AST.EnumDeclaration;
          if (e.name[0] !== e.name[0].toUpperCase()) {
            ctx.diagnostics.warning(
              ErrorCode.ParseError,
              `Enum '${e.name}' should use PascalCase naming`,
              e.span.start, ctx.file,
            );
          }
        }
      },
    });

    // Rule: account-naming (account names should be PascalCase)
    this.addRule({
      name: 'account-naming',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'AccountDeclaration') {
          const a = node as AST.AccountDeclaration;
          if (a.name[0] !== a.name[0].toUpperCase()) {
            ctx.diagnostics.warning(
              ErrorCode.ParseError,
              `Account '${a.name}' should use PascalCase naming`,
              a.span.start, ctx.file,
            );
          }
        }
      },
    });

    // Rule: init-needs-space (init accounts should have space specified)
    this.addRule({
      name: 'init-needs-space',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'AccountParam') {
          const acc = node as AST.AccountParam;
          const isInit = acc.constraints.some(c => c.kind === 'init');
          const hasSpace = acc.constraints.some(c => c.kind === 'space');
          if (isInit && !hasSpace) {
            ctx.diagnostics.warning(
              ErrorCode.MissingAccountConstraint,
              `Init account '${acc.name}' should specify space`,
              acc.span.start, ctx.file,
              'Add space constraint: space = 8 + <data_size>',
            );
          }
        }
      },
    });

    // Rule: mut-needs-signer (mutable accounts should have authorization)
    this.addRule({
      name: 'no-unguarded-mutation',
      severity: 'info',
      check: (node, ctx) => {
        if (node.kind === 'InstructionDeclaration') {
          const instr = node as AST.InstructionDeclaration;
          const hasMut = instr.accounts.some(a => a.constraints.some(c => c.kind === 'mut'));
          const hasSigner = instr.accounts.some(a => a.accountType.kind === 'Signer');
          if (hasMut && !hasSigner) {
            ctx.diagnostics.warning(
              ErrorCode.MissingAccountConstraint,
              `Instruction '${instr.name}' mutates accounts without a signer`,
              instr.span.start, ctx.file,
              'Add a signer account to authorize mutations',
            );
          }
        }
      },
    });

    // Rule: unused-variable (let declarations not referenced in body)
    this.addRule({
      name: 'unused-variable',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'FunctionDeclaration') {
          const fn = node as AST.FunctionDeclaration;
          const bodyStr = JSON.stringify(fn.body);
          for (const stmt of fn.body) {
            if (stmt.kind === 'LetStatement' && stmt.name) {
              // Check if the variable name appears anywhere else in the body
              const nameCount = (bodyStr.match(new RegExp(`"${stmt.name}"`, 'g')) || []).length;
              // nameCount = 1 means it only appears in the let declaration itself
              if (nameCount <= 1) {
                ctx.diagnostics.warning(
                  ErrorCode.ParseError,
                  `Variable '${stmt.name}' is declared but never used`,
                  stmt.span.start, ctx.file,
                  'Remove the unused variable or prefix with _',
                );
              }
            }
          }
        }
      },
    });

    // Rule: missing-return (function with return type but no return statement)
    this.addRule({
      name: 'missing-return',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'FunctionDeclaration') {
          const fn = node as AST.FunctionDeclaration;
          if (fn.returnType && fn.body.length > 0) {
            const hasReturn = JSON.stringify(fn.body).includes('"ReturnStatement"');
            if (!hasReturn) {
              ctx.diagnostics.warning(
                ErrorCode.ParseError,
                `Function '${fn.name}' has return type but no return statement`,
                fn.span.start, ctx.file,
                'Add a return statement or remove the return type',
              );
            }
          }
        }
      },
    });

    // Rule: state-unreachable (state never appears as a transition target)
    this.addRule({
      name: 'state-unreachable',
      severity: 'warning',
      check: (node, ctx) => {
        if (node.kind === 'StateMachineDeclaration') {
          const sm = node as AST.StateMachineDeclaration;
          const reachable = new Set<string>();
          // First state is always reachable (default)
          if (sm.states.length > 0) reachable.add(sm.states[0].name);
          // All transition sources and targets are reachable
          for (const t of sm.transitions) {
            for (const f of t.from) reachable.add(f);
            reachable.add(t.to);
          }
          for (const s of sm.states) {
            if (!reachable.has(s.name)) {
              ctx.diagnostics.warning(
                ErrorCode.ParseError,
                `State '${s.name}' in '${sm.name}' is unreachable — no transition leads to or from it`,
                s.span.start, ctx.file,
                'Remove the unreachable state or add a transition',
              );
            }
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
    // Walk state machine children
    if ('states' in node && Array.isArray((node as any).states)) {
      for (const child of (node as any).states) {
        if (child && typeof child === 'object' && 'kind' in child) {
          this.walkNode(child, ctx);
        }
      }
    }
    if ('transitions' in node && Array.isArray((node as any).transitions)) {
      for (const child of (node as any).transitions) {
        if (child && typeof child === 'object' && 'kind' in child) {
          this.walkNode(child, ctx);
        }
      }
    }
    // Walk expression children
    if ('value' in node && (node as any).value && typeof (node as any).value === 'object' && 'kind' in (node as any).value) {
      this.walkNode((node as any).value, ctx);
    }
    if ('condition' in node && (node as any).condition && typeof (node as any).condition === 'object' && 'kind' in (node as any).condition) {
      this.walkNode((node as any).condition, ctx);
    }
    if ('left' in node && (node as any).left && typeof (node as any).left === 'object' && 'kind' in (node as any).left) {
      this.walkNode((node as any).left, ctx);
    }
    if ('right' in node && (node as any).right && typeof (node as any).right === 'object' && 'kind' in (node as any).right) {
      this.walkNode((node as any).right, ctx);
    }
    if ('expression' in node && (node as any).expression && typeof (node as any).expression === 'object' && 'kind' in (node as any).expression) {
      this.walkNode((node as any).expression, ctx);
    }
    if ('target' in node && (node as any).target && typeof (node as any).target === 'object' && 'kind' in (node as any).target) {
      this.walkNode((node as any).target, ctx);
    }
    if ('elements' in node && Array.isArray((node as any).elements)) {
      for (const child of (node as any).elements) {
        if (child && typeof child === 'object' && 'kind' in child) {
          this.walkNode(child, ctx);
        }
      }
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const child of (node as any).args) {
        if (child && typeof child === 'object' && 'kind' in child) {
          this.walkNode(child, ctx);
        }
      }
    }
    if ('catchBody' in node && Array.isArray((node as any).catchBody)) {
      for (const child of (node as any).catchBody) {
        this.walkNode(child, ctx);
      }
    }
    if ('iterable' in node && (node as any).iterable && typeof (node as any).iterable === 'object' && 'kind' in (node as any).iterable) {
      this.walkNode((node as any).iterable, ctx);
    }
    if ('variants' in node && Array.isArray((node as any).variants)) {
      for (const child of (node as any).variants) {
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
