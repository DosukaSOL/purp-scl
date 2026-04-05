// ============================================================================
// Purp Lexer — The Solana Coding Language
// Tokenizes Purp source code into a stream of tokens
// ============================================================================

import { Token, TokenType, KEYWORDS, SourceLocation } from './tokens.js';

export class LexerError extends Error {
  constructor(
    message: string,
    public location: SourceLocation,
    public sourceFile?: string,
  ) {
    super(`[Lexer Error] ${message} at ${sourceFile ?? '<stdin>'}:${location.line}:${location.column}`);
    this.name = 'LexerError';
  }
}

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private file: string;
  private tokens: Token[] = [];

  constructor(source: string, file: string = '<stdin>') {
    this.source = source;
    this.file = file;
  }

  tokenize(): Token[] {
    this.tokens = [];
    while (!this.isAtEnd()) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) break;
      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }
    this.tokens.push(this.makeToken(TokenType.EOF, '', this.currentLocation()));
    return this.tokens;
  }

  private nextToken(): Token | null {
    const start = this.currentLocation();
    const ch = this.peek();

    // String literals
    if (ch === '"' || ch === "'") return this.readString(ch);

    // Number literals
    if (this.isDigit(ch)) return this.readNumber();

    // Identifiers and keywords
    if (this.isAlpha(ch) || ch === '_') return this.readIdentifier();

    // Operators and punctuation
    return this.readOperator(start);
  }

  // --- Readers ---

  private readString(quote: string): Token {
    const start = this.currentLocation();
    this.advance(); // consume opening quote
    let value = '';
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case "'": value += "'"; break;
          default: value += escaped;
        }
      } else {
        value += this.advance();
      }
    }
    if (this.isAtEnd()) {
      throw new LexerError('Unterminated string literal', start, this.file);
    }
    this.advance(); // consume closing quote
    return this.makeToken(TokenType.String, value, start);
  }

  private readNumber(): Token {
    const start = this.currentLocation();
    let value = '';

    // Handle hex, octal, binary prefixes
    if (this.peek() === '0' && this.pos + 1 < this.source.length) {
      const next = this.source[this.pos + 1];
      if (next === 'x' || next === 'X') {
        value += this.advance() + this.advance();
        while (!this.isAtEnd() && this.isHexDigit(this.peek())) {
          value += this.advance();
        }
        return this.makeToken(TokenType.Number, value, start);
      }
    }

    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }
    if (!this.isAtEnd() && this.peek() === '.' && this.pos + 1 < this.source.length && this.isDigit(this.source[this.pos + 1])) {
      value += this.advance(); // '.'
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }
    // Underscore separators (e.g., 1_000_000)
    value = value.replace(/_/g, '');
    return this.makeToken(TokenType.Number, value, start);
  }

  private readIdentifier(): Token {
    const start = this.currentLocation();
    let value = '';
    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')) {
      value += this.advance();
    }
    const type = KEYWORDS[value] ?? TokenType.Identifier;
    return this.makeToken(type, value, start);
  }

  private readOperator(start: SourceLocation): Token {
    const ch = this.advance();
    switch (ch) {
      case '(': return this.makeToken(TokenType.LeftParen, ch, start);
      case ')': return this.makeToken(TokenType.RightParen, ch, start);
      case '{': return this.makeToken(TokenType.LeftBrace, ch, start);
      case '}': return this.makeToken(TokenType.RightBrace, ch, start);
      case '[': return this.makeToken(TokenType.LeftBracket, ch, start);
      case ']': return this.makeToken(TokenType.RightBracket, ch, start);
      case '+': return this.makeToken(TokenType.Plus, ch, start);
      case '-':
        if (this.match('>')) return this.makeToken(TokenType.Arrow, '->', start);
        return this.makeToken(TokenType.Minus, ch, start);
      case '*': return this.makeToken(TokenType.Star, ch, start);
      case '/': return this.makeToken(TokenType.Slash, ch, start);
      case '%': return this.makeToken(TokenType.Percent, ch, start);
      case '=':
        if (this.match('=')) return this.makeToken(TokenType.Equals, '==', start);
        if (this.match('>')) return this.makeToken(TokenType.FatArrow, '=>', start);
        return this.makeToken(TokenType.Assign, ch, start);
      case '!':
        if (this.match('=')) return this.makeToken(TokenType.NotEquals, '!=', start);
        return this.makeToken(TokenType.Not, ch, start);
      case '<':
        if (this.match('=')) return this.makeToken(TokenType.LessEqual, '<=', start);
        return this.makeToken(TokenType.LessThan, ch, start);
      case '>':
        if (this.match('=')) return this.makeToken(TokenType.GreaterEqual, '>=', start);
        return this.makeToken(TokenType.GreaterThan, ch, start);
      case '&':
        if (this.match('&')) return this.makeToken(TokenType.And, '&&', start);
        return this.makeToken(TokenType.Ampersand, ch, start);
      case '|':
        if (this.match('|')) return this.makeToken(TokenType.Or, '||', start);
        return this.makeToken(TokenType.Pipe, ch, start);
      case '.':
        if (this.match('.')) return this.makeToken(TokenType.DotDot, '..', start);
        return this.makeToken(TokenType.Dot, ch, start);
      case ':':
        if (this.match(':')) return this.makeToken(TokenType.ColonColon, '::', start);
        return this.makeToken(TokenType.Colon, ch, start);
      case ';': return this.makeToken(TokenType.Semicolon, ch, start);
      case ',': return this.makeToken(TokenType.Comma, ch, start);
      case '#': return this.makeToken(TokenType.Hash, ch, start);
      case '@': return this.makeToken(TokenType.At, ch, start);
      case '?': return this.makeToken(TokenType.Question, ch, start);
      case '\n':
        return this.makeToken(TokenType.Newline, ch, start);
      default:
        throw new LexerError(`Unexpected character: '${ch}'`, start, this.file);
    }
  }

  // --- Helpers ---

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else if (ch === '\n') {
        // Newlines are significant in some contexts, but we skip them in whitespace mode
        this.advance();
      } else if (ch === '/' && this.pos + 1 < this.source.length) {
        if (this.source[this.pos + 1] === '/') {
          // Line comment
          const isDoc = this.pos + 2 < this.source.length && this.source[this.pos + 2] === '/';
          while (!this.isAtEnd() && this.peek() !== '\n') {
            this.advance();
          }
        } else if (this.source[this.pos + 1] === '*') {
          // Block comment
          this.advance(); this.advance();
          while (!this.isAtEnd() && !(this.peek() === '*' && this.pos + 1 < this.source.length && this.source[this.pos + 1] === '/')) {
            this.advance();
          }
          if (!this.isAtEnd()) { this.advance(); this.advance(); }
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  private peek(): string {
    return this.source[this.pos];
  }

  private advance(): string {
    const ch = this.source[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.peek() !== expected) return false;
    this.advance();
    return true;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isHexDigit(ch: string): boolean {
    return this.isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private currentLocation(): SourceLocation {
    return { line: this.line, column: this.column, offset: this.pos, file: this.file };
  }

  private makeToken(type: TokenType, value: string, start: SourceLocation): Token {
    return {
      type,
      value,
      span: {
        start,
        end: this.currentLocation(),
      },
    };
  }
}

export { type Token, TokenType, KEYWORDS } from './tokens.js';
