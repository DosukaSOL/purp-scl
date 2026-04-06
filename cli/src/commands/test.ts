// ============================================================================
// purp test — Run Purp test blocks + project tests
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Lexer } from '../../../compiler/src/lexer/index.js';
import { Parser } from '../../../compiler/src/parser/index.js';
import { compile } from '../../../compiler/src/index.js';
import * as AST from '../../../compiler/src/ast/index.js';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

function findPurpFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...findPurpFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.purp')) {
      results.push(fullPath);
    }
  }
  return results;
}

interface ExtractedTest {
  name: string;
  node: AST.TestBlock;
}

function extractTestBlocks(source: string, file: string): ExtractedTest[] {
  const tests: ExtractedTest[] = [];
  try {
    const lexer = new Lexer(source, file);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, file);
    const ast = parser.parse();

    for (const node of ast.body) {
      if (node.kind === 'TestBlock') {
        tests.push({ name: node.name ?? 'unnamed test', node });
      }
      if (node.kind === 'ProgramDeclaration') {
        for (const member of node.body) {
          if (member.kind === 'TestBlock') {
            tests.push({ name: (member as AST.TestBlock).name ?? 'unnamed test', node: member as AST.TestBlock });
          }
        }
      }
    }
  } catch {
    // parse error — handled by compile step
  }
  return tests;
}

/**
 * Generate executable TypeScript from a test block's statements.
 * Uses a simple evaluator that maps Purp AST to runnable JS.
 */
function generateTestJS(test: ExtractedTest, programName: string): string {
  const lines: string[] = [];
  lines.push(`// Auto-generated test: ${test.name}`);
  lines.push(`const __testName = ${JSON.stringify(test.name)};`);
  lines.push(`const __errors = [];`);
  lines.push('');
  lines.push('// Mock Solana primitives for test execution');
  lines.push('const PublicKey = { default: "11111111111111111111111111111111" };');
  lines.push('const LAMPORTS_PER_SOL = 1000000000;');
  lines.push('function msg(...args) { /* silent in tests */ }');
  lines.push('function print(...args) { console.log(...args); }');
  lines.push('function log(...args) { console.log(...args); }');
  lines.push('');

  for (const stmt of test.node.body) {
    lines.push(emitTestStatement(stmt));
  }

  lines.push('');
  lines.push('if (__errors.length > 0) {');
  lines.push('  throw new Error(__errors.join("\\n"));');
  lines.push('}');

  return lines.join('\n');
}

function emitTestStatement(stmt: AST.Statement): string {
  switch (stmt.kind) {
    case 'LetStatement': {
      const kw = stmt.mutable ? 'let' : 'const';
      const val = stmt.value ? ` = ${emitTestExpr(stmt.value)}` : '';
      return `${kw} ${stmt.name}${val};`;
    }
    case 'ConstStatement':
      return `const ${stmt.name} = ${emitTestExpr(stmt.value)};`;
    case 'AssignmentStatement':
      return `${emitTestExpr(stmt.target)} ${stmt.operator} ${emitTestExpr(stmt.value)};`;
    case 'ExpressionStatement':
      return `${emitTestExpr(stmt.expression)};`;
    case 'ReturnStatement':
      return stmt.value ? `return ${emitTestExpr(stmt.value)};` : 'return;';
    case 'AssertStatement': {
      const cond = emitTestExpr(stmt.condition);
      const msg = stmt.message ? emitTestExpr(stmt.message) : `"Assertion failed: ${cond.replace(/"/g, '\\"')}"`;
      return `if (!(${cond})) __errors.push(${msg});`;
    }
    case 'RequireStatement': {
      const cond = emitTestExpr(stmt.condition);
      const msg = stmt.message ? emitTestExpr(stmt.message) : (stmt.errorCode ? emitTestExpr(stmt.errorCode) : `"Require failed"`);
      return `if (!(${cond})) __errors.push(${msg});`;
    }
    case 'IfStatement': {
      let code = `if (${emitTestExpr(stmt.condition)}) {\n`;
      code += stmt.then.map(s => '  ' + emitTestStatement(s)).join('\n') + '\n';
      if (stmt.elseIf) {
        for (const ei of stmt.elseIf) {
          code += `} else if (${emitTestExpr(ei.condition)}) {\n`;
          code += ei.body.map(s => '  ' + emitTestStatement(s)).join('\n') + '\n';
        }
      }
      if (stmt.else && stmt.else.length > 0) {
        code += '} else {\n';
        code += stmt.else.map(s => '  ' + emitTestStatement(s)).join('\n') + '\n';
      }
      code += '}';
      return code;
    }
    case 'ForStatement':
      return `for (const ${stmt.variable} of ${emitTestExpr(stmt.iterable)}) {\n${stmt.body.map(s => '  ' + emitTestStatement(s)).join('\n')}\n}`;
    case 'WhileStatement':
      return `while (${emitTestExpr(stmt.condition)}) {\n${stmt.body.map(s => '  ' + emitTestStatement(s)).join('\n')}\n}`;
    case 'EmitStatement':
      return `/* emit ${stmt.event} */`;
    case 'BlockStatement':
      return `{\n${stmt.body.map(s => '  ' + emitTestStatement(s)).join('\n')}\n}`;
    default:
      return `/* ${stmt.kind} */`;
  }
}

function emitTestExpr(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'NumberLiteral': return expr.raw;
    case 'StringLiteral': return `"${expr.value}"`;
    case 'BooleanLiteral': return String(expr.value);
    case 'NullLiteral': return 'null';
    case 'IdentifierExpr': return expr.name;
    case 'BinaryExpr': return `(${emitTestExpr(expr.left)} ${expr.operator} ${emitTestExpr(expr.right)})`;
    case 'UnaryExpr': return `${expr.operator}${emitTestExpr(expr.operand)}`;
    case 'CallExpr': return `${emitTestExpr(expr.callee)}(${expr.args.map(emitTestExpr).join(', ')})`;
    case 'MemberExpr': return `${emitTestExpr(expr.object)}.${expr.property}`;
    case 'IndexExpr': return `${emitTestExpr(expr.object)}[${emitTestExpr(expr.index)}]`;
    case 'ArrayExpr': return `[${expr.elements.map(emitTestExpr).join(', ')}]`;
    case 'ObjectExpr': return `{ ${expr.properties.map(p => `${p.key}: ${emitTestExpr(p.value)}`).join(', ')} }`;
    case 'TupleExpr': return `[${expr.elements.map(emitTestExpr).join(', ')}]`;
    case 'TernaryExpr': return `(${emitTestExpr(expr.condition)} ? ${emitTestExpr(expr.consequent)} : ${emitTestExpr(expr.alternate)})`;
    case 'StructInitExpr': return `{ ${expr.fields.map(f => `${f.name}: ${emitTestExpr(f.value)}`).join(', ')} }`;
    case 'SolLiteral': return `${expr.amount} * LAMPORTS_PER_SOL`;
    case 'LamportsLiteral': return `${expr.amount}`;
    case 'CastExpr': return emitTestExpr(expr.expression);
    case 'AwaitExpr': return emitTestExpr(expr.expression);
    case 'PubkeyLiteral': return `"${expr.value}"`;
    case 'TemplateStringLiteral': {
      let r = '`';
      for (const p of expr.parts) r += typeof p === 'string' ? p : '${' + emitTestExpr(p) + '}';
      return r + '`';
    }
    case 'RangeExpr':
      return expr.inclusive
        ? `Array.from({length: ${emitTestExpr(expr.end)} - ${emitTestExpr(expr.start)} + 1}, (_, i) => ${emitTestExpr(expr.start)} + i)`
        : `Array.from({length: ${emitTestExpr(expr.end)} - ${emitTestExpr(expr.start)}}, (_, i) => ${emitTestExpr(expr.start)} + i)`;
    default: return `undefined /* ${expr.kind} */`;
  }
}

export async function testCommand(args: string[]): Promise<void> {
  const filter = args.find(a => !a.startsWith('-'));
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('\x1b[35m⟡\x1b[0m \x1b[1mPurp Test Runner\x1b[0m');
  console.log('');

  // Collect .purp files
  const searchDirs = ['src', 'tests', 'examples'];
  let files: string[] = [];
  if (filter && fs.existsSync(filter)) {
    files = [filter];
  } else {
    for (const dir of searchDirs) {
      files.push(...findPurpFiles(dir));
    }
    if (filter) {
      files = files.filter(f => f.includes(filter));
    }
  }

  if (files.length === 0) {
    console.log('  \x1b[33m⚠\x1b[0m No .purp files found.');
    console.log('  Create .purp files with test blocks in src/ or tests/');
    return;
  }

  const results: TestResult[] = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(process.cwd(), file);

    // Step 1: Compile check — does the file parse and type-check?
    const start = performance.now();
    const result = compile(source, { file });
    const duration = performance.now() - start;

    if (!result.success) {
      totalTests++;
      totalFailed++;
      results.push({
        name: `compile:${relPath}`,
        passed: false,
        duration,
        error: result.diagnostics.getAll().map((d: any) => d.description).join('; '),
      });
      console.log(`  \x1b[31m✗\x1b[0m ${relPath} — compilation failed`);
      if (verbose) {
        for (const d of result.diagnostics.getAll()) {
          console.log(`    \x1b[31m${(d as any).description}\x1b[0m`);
        }
      }
      continue;
    }

    // Step 2: Check for test blocks
    const testBlocks = extractTestBlocks(source, file);
    if (testBlocks.length === 0) {
      // Just verify it compiles
      totalTests++;
      totalPassed++;
      results.push({ name: `compile:${relPath}`, passed: true, duration });
      if (verbose) {
        console.log(`  \x1b[32m✓\x1b[0m ${relPath} — compiles (${duration.toFixed(1)}ms)`);
      }
      continue;
    }

    // Step 3: Actually execute test blocks
    for (const tb of testBlocks) {
      totalTests++;
      const testStart = performance.now();
      const programName = 'test_program';

      try {
        // Generate executable JS from the test block's AST
        const testCode = generateTestJS(tb, programName);

        // Execute the test code in a sandboxed function
        const fn = new Function(testCode);
        fn();

        // If we get here — test passed (no throw)
        totalPassed++;
        const testDur = performance.now() - testStart;
        results.push({ name: `${relPath}::${tb.name}`, passed: true, duration: testDur });
        console.log(`  \x1b[32m✓\x1b[0m ${relPath}::${tb.name} (${testDur.toFixed(1)}ms)`);
      } catch (err: any) {
        totalFailed++;
        const testDur = performance.now() - testStart;
        const errMsg = err.message ?? String(err);
        results.push({
          name: `${relPath}::${tb.name}`,
          passed: false,
          duration: testDur,
          error: errMsg,
        });
        console.log(`  \x1b[31m✗\x1b[0m ${relPath}::${tb.name}`);
        if (verbose) {
          console.log(`    \x1b[31m${errMsg}\x1b[0m`);
        }
      }
    }
  }

  // Summary
  console.log('');
  console.log('─'.repeat(60));
  const status = totalFailed === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m';
  console.log(`  ${status}  ${totalPassed} passed, ${totalFailed} failed, ${totalTests} total`);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`  Duration: ${totalDuration.toFixed(0)}ms`);
  console.log('');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

