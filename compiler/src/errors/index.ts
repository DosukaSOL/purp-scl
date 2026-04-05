// ============================================================================
// Purp Error System — The Solana Coding Language
// Structured, readable error reporting
// ============================================================================

import { SourceLocation } from '../lexer/tokens.js';

export enum ErrorCode {
  // Lexer errors (1xxx)
  UnexpectedCharacter = 1001,
  UnterminatedString = 1002,
  InvalidNumber = 1003,

  // Parser errors (2xxx)
  ParseError = 2001,
  UnexpectedToken = 2002,
  ExpectedToken = 2003,
  UnexpectedEOF = 2004,

  // Semantic errors (3xxx)
  UndefinedVariable = 3001,
  UndefinedType = 3002,
  TypeMismatch = 3003,
  DuplicateDefinition = 3004,
  InvalidAccountConstraint = 3005,
  MissingAccountConstraint = 3006,
  InvalidPDASeeds = 3007,
  InvalidCPICall = 3008,

  // Codegen errors (4xxx)
  CodegenError = 4001,
  UnsupportedFeature = 4002,
  InvalidTarget = 4003,

  // Runtime errors (5xxx)
  RuntimeError = 5001,
  SerializationError = 5002,
  AccountError = 5003,
}

export enum ErrorSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Hint = 'hint',
}

export class PurpError extends Error {
  constructor(
    public code: ErrorCode,
    public description: string,
    public location?: SourceLocation,
    public file?: string,
    public severity: ErrorSeverity = ErrorSeverity.Error,
    public hint?: string,
  ) {
    const prefix = severity === ErrorSeverity.Error ? '✖ error' : severity === ErrorSeverity.Warning ? '⚠ warning' : 'ℹ info';
    const loc = location ? `${file ?? '<stdin>'}:${location.line}:${location.column}` : file ?? '<unknown>';
    super(`${prefix}[P${code}]: ${description}\n  → ${loc}${hint ? `\n  💡 ${hint}` : ''}`);
    this.name = 'PurpError';
  }
}

export class PurpDiagnostics {
  private diagnostics: PurpError[] = [];

  add(error: PurpError): void {
    this.diagnostics.push(error);
  }

  error(code: ErrorCode, message: string, location?: SourceLocation, file?: string, hint?: string): void {
    this.diagnostics.push(new PurpError(code, message, location, file, ErrorSeverity.Error, hint));
  }

  warning(code: ErrorCode, message: string, location?: SourceLocation, file?: string, hint?: string): void {
    this.diagnostics.push(new PurpError(code, message, location, file, ErrorSeverity.Warning, hint));
  }

  hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === ErrorSeverity.Error);
  }

  getErrors(): PurpError[] {
    return this.diagnostics.filter(d => d.severity === ErrorSeverity.Error);
  }

  getWarnings(): PurpError[] {
    return this.diagnostics.filter(d => d.severity === ErrorSeverity.Warning);
  }

  getAll(): PurpError[] {
    return [...this.diagnostics];
  }

  format(): string {
    return this.diagnostics.map(d => d.message).join('\n\n');
  }

  clear(): void {
    this.diagnostics = [];
  }
}
