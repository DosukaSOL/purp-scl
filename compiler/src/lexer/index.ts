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

    // Template string literals
    if (ch === '`') return this.readTemplateString();

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

  private readTemplateString(): Token {
    const start = this.currentLocation();
    this.advance(); // consume backtick
    let value = '';
    while (!this.isAtEnd() && this.peek() !== '`') {
      if (this.peek() === '$' && this.pos + 1 < this.source.length && this.source[this.pos + 1] === '{') {
        // For simplicity, we inline the interpolation as __INTERP_START__expr__INTERP_END__
        this.advance(); // $
        this.advance(); // {
        let depth = 1;
        let expr = '';
        while (!this.isAtEnd() && depth > 0) {
          if (this.peek() === '{') depth++;
          if (this.peek() === '}') depth--;
          if (depth > 0) expr += this.advance();
          else this.advance(); // consume closing }
        }
        value += `\${${expr}}`;
      } else if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case '\\': value += '\\'; break;
          case '`': value += '`'; break;
          default: value += escaped;
        }
      } else {
        value += this.advance();
      }
    }
    if (this.isAtEnd()) {
      throw new LexerError('Unterminated template string', start, this.file);
    }
    this.advance(); // consume closing backtick
    return this.makeToken(TokenType.TemplateString, value, start);
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
      case '+':
        if (this.match('=')) return this.makeToken(TokenType.PlusAssign, '+=', start);
        return this.makeToken(TokenType.Plus, ch, start);
      case '-':
        if (this.match('>')) return this.makeToken(TokenType.Arrow, '->', start);
        if (this.match('=')) return this.makeToken(TokenType.MinusAssign, '-=', start);
        return this.makeToken(TokenType.Minus, ch, start);
      case '*':
        if (this.match('*')) {
          if (this.match('=')) return this.makeToken(TokenType.StarStarAssign, '**=', start);
          return this.makeToken(TokenType.StarStar, '**', start);
        }
        if (this.match('=')) return this.makeToken(TokenType.StarAssign, '*=', start);
        return this.makeToken(TokenType.Star, ch, start);
      case '/':
        if (this.match('=')) return this.makeToken(TokenType.SlashAssign, '/=', start);
        return this.makeToken(TokenType.Slash, ch, start);
      case '%':
        if (this.match('=')) return this.makeToken(TokenType.PercentAssign, '%=', start);
        return this.makeToken(TokenType.Percent, ch, start);
      case '=':
        if (this.match('=')) return this.makeToken(TokenType.Equals, '==', start);
        if (this.match('>')) return this.makeToken(TokenType.FatArrow, '=>', start);
        return this.makeToken(TokenType.Assign, ch, start);
      case '!':
        if (this.match('=')) return this.makeToken(TokenType.NotEquals, '!=', start);
        return this.makeToken(TokenType.Not, ch, start);
      case '<':
        if (this.match('<')) {
          if (this.match('=')) return this.makeToken(TokenType.ShiftLeftAssign, '<<=', start);
          return this.makeToken(TokenType.ShiftLeft, '<<', start);
        }
        if (this.match('=')) return this.makeToken(TokenType.LessEqual, '<=', start);
        return this.makeToken(TokenType.LessThan, ch, start);
      case '>':
        if (this.match('>')) {
          if (this.match('=')) return this.makeToken(TokenType.ShiftRightAssign, '>>=', start);
          return this.makeToken(TokenType.ShiftRight, '>>', start);
        }
        if (this.match('=')) return this.makeToken(TokenType.GreaterEqual, '>=', start);
        return this.makeToken(TokenType.GreaterThan, ch, start);
      case '&':
        if (this.match('&')) return this.makeToken(TokenType.And, '&&', start);
        if (this.match('=')) return this.makeToken(TokenType.AmpersandAssign, '&=', start);
        return this.makeToken(TokenType.Ampersand, ch, start);
      case '|':
        if (this.match('|')) return this.makeToken(TokenType.Or, '||', start);
        if (this.match('=')) return this.makeToken(TokenType.PipeAssign, '|=', start);
        return this.makeToken(TokenType.Pipe, ch, start);
      case '^':
        if (this.match('=')) return this.makeToken(TokenType.CaretAssign, '^=', start);
        return this.makeToken(TokenType.Caret, ch, start);
      case '.':
        if (this.match('.')) {
          if (this.match('.')) return this.makeToken(TokenType.DotDotDot, '...', start);
          if (this.match('=')) return this.makeToken(TokenType.DotDotEquals, '..=', start);
          return this.makeToken(TokenType.DotDot, '..', start);
        }
        return this.makeToken(TokenType.Dot, ch, start);
      case ':':
        if (this.match(':')) return this.makeToken(TokenType.ColonColon, '::', start);
        return this.makeToken(TokenType.Colon, ch, start);
      case ';': return this.makeToken(TokenType.Semicolon, ch, start);
      case ',': return this.makeToken(TokenType.Comma, ch, start);
      case '#': return this.makeToken(TokenType.Hash, ch, start);
      case '@': return this.makeToken(TokenType.At, ch, start);
      case '?':
        if (this.match('?')) {
          if (this.match('=')) return this.makeToken(TokenType.NullishCoalesceAssign, '??=', start);
          return this.makeToken(TokenType.NullishCoalesce, '??', start);
        }
        if (this.match('.')) return this.makeToken(TokenType.QuestionDot, '?.', start);
        return this.makeToken(TokenType.Question, ch, start);
      case '`': {
        // Put the backtick back and use template string reader
        this.pos--;
        this.column--;
        return this.readTemplateString();
      }
      case '_':
        if (!this.isAlphaNumeric(this.peek())) {
          return this.makeToken(TokenType.Underscore, ch, start);
        }
        // Start of identifier
        this.pos--;
        this.column--;
        return this.readIdentifier();
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
