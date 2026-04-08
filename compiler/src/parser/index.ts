// ============================================================================
// Purp Parser v0.2.0 — The Solana Coding Language
// Full parser with generics, patterns, assert/require, try/catch,
// destructuring, cast, bitwise ops, PDA seeds, CPI, SPL, test blocks
// ============================================================================

import { Token, TokenType } from '../lexer/tokens.js';
import * as AST from '../ast/index.js';
import { PurpError, ErrorCode } from '../errors/index.js';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private file: string;
  private errors: PurpError[] = [];
  private panicMode: boolean = false;

  constructor(tokens: Token[], file: string = '<stdin>') {
    this.tokens = tokens.filter(t =>
      t.type !== TokenType.Newline &&
      t.type !== TokenType.Comment &&
      t.type !== TokenType.DocComment
    );
    this.file = file;
  }

  /** Get all collected parse errors (available after parse()). */
  getErrors(): PurpError[] {
    return this.errors;
  }

  parse(): AST.ProgramNode {
    const body: AST.TopLevelNode[] = [];
    while (!this.isAtEnd()) {
      try {
        this.panicMode = false;
        const node = this.parseTopLevel();
        if (node) body.push(node);
      } catch (err) {
        if (err instanceof PurpError) {
          this.errors.push(err);
          this.synchronize();
          // Bail out after too many errors to prevent OOM
          if (this.errors.length >= 50) break;
        } else {
          throw err;
        }
      }
    }
    // If errors were collected, throw the first one for backward compat
    // (callers that don't use getErrors() still get an error)
    if (this.errors.length > 0 && body.length === 0) {
      throw this.errors[0];
    }
    return {
      kind: 'Program',
      name: this.file,
      body,
      span: {
        start: { line: 1, column: 1, offset: 0 },
        end: this.currentToken().span.end,
      },
    };
  }

  // =========================================================================
  // Top Level
  // =========================================================================

  private parseTopLevel(): AST.TopLevelNode {
    const attrs = this.parseAttributes();
    const token = this.currentToken();

    switch (token.type) {
      case TokenType.Program: return this.parseProgramDeclaration();
      case TokenType.Instruction: return this.parseInstructionDeclaration('private', attrs);
      case TokenType.Account: return this.parseAccountDeclaration(attrs);
      case TokenType.Struct: return this.parseStructDeclaration('private', attrs);
      case TokenType.Enum: return this.parseEnumDeclaration('private', attrs);
      case TokenType.Fn: return this.parseFunctionDeclaration('private', false, attrs);
      case TokenType.Async: return this.parseFunctionDeclaration('private', true, attrs);
      case TokenType.Event: return this.parseEventDeclaration();
      case TokenType.Error: return this.parseErrorDeclaration();
      case TokenType.Import:
      case TokenType.Use: return this.parseImportDeclaration();
      case TokenType.Const: return this.parseConstDeclaration('private');
      case TokenType.Type: return this.parseTypeAlias();
      case TokenType.Impl: return this.parseImplBlock();
      case TokenType.Trait: return this.parseTraitDeclaration();
      case TokenType.Client: return this.parseClientBlock();
      case TokenType.Frontend: return this.parseFrontendBlock();
      case TokenType.Config: return this.parseConfigBlock();
      case TokenType.Test: return this.parseTestBlock();
      case TokenType.State: return this.parseStateMachine();
      case TokenType.Pub: {
        this.advance();
        const next = this.currentToken();
        switch (next.type) {
          case TokenType.Instruction: return this.parseInstructionDeclaration('pub', attrs);
          case TokenType.Struct: return this.parseStructDeclaration('pub', attrs);
          case TokenType.Enum: return this.parseEnumDeclaration('pub', attrs);
          case TokenType.Fn: return this.parseFunctionDeclaration('pub', false, attrs);
          case TokenType.Async: return this.parseFunctionDeclaration('pub', true, attrs);
          case TokenType.Const: return this.parseConstDeclaration('pub');
          default:
            throw this.error(`Unexpected token after 'pub': ${next.type}`, next);
        }
      }
      default:
        throw this.error(`Unexpected top-level token: ${token.type} (${token.value})`, token);
    }
  }

  // =========================================================================
  // Attributes: #[name(args)]
  // =========================================================================

  private parseAttributes(): AST.Attribute[] {
    const attrs: AST.Attribute[] = [];
    while (this.check(TokenType.Hash) && this.peekNext()?.type === TokenType.LeftBracket) {
      this.advance(); // #
      this.advance(); // [
      const start = this.currentToken();
      const name = this.expectName().value;
      const args: AST.Expression[] = [];
      if (this.check(TokenType.LeftParen)) {
        this.advance();
        while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
          args.push(this.parseExpression());
          this.match(TokenType.Comma);
        }
        this.expect(TokenType.RightParen);
      }
      this.expect(TokenType.RightBracket);
      attrs.push({
        kind: 'Attribute',
        name,
        args,
        span: { start: start.span.start, end: this.prevToken().span.end },
      });
    }
    return attrs;
  }

  // =========================================================================
  // Generic Parameters: <T, U: Trait, V = Default>
  // =========================================================================

  private parseGenericParams(): AST.GenericParam[] | undefined {
    if (!this.check(TokenType.LessThan)) return undefined;
    this.advance();
    const params: AST.GenericParam[] = [];
    while (!this.check(TokenType.GreaterThan) && !this.isAtEnd()) {
      const start = this.currentToken();
      const name = this.expectName().value;
      let constraint: AST.TypeAnnotation | undefined;
      let def: AST.TypeAnnotation | undefined;
      if (this.check(TokenType.Colon)) {
        this.advance();
        constraint = this.parseTypeAnnotation();
      }
      if (this.check(TokenType.Assign)) {
        this.advance();
        def = this.parseTypeAnnotation();
      }
      params.push({
        kind: 'GenericParam',
        name,
        constraint,
        default: def,
        span: { start: start.span.start, end: this.prevToken().span.end },
      });
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.GreaterThan);
    return params.length > 0 ? params : undefined;
  }

  // =========================================================================
  // Program Declaration
  // =========================================================================

  private parseProgramDeclaration(): AST.ProgramDeclaration {
    const start = this.expect(TokenType.Program);
    const name = this.expectName().value;
    let id: string | undefined;
    if (this.check(TokenType.LeftParen)) {
      this.advance();
      id = this.expect(TokenType.String).value;
      this.expect(TokenType.RightParen);
    }
    this.expect(TokenType.LeftBrace);
    const body: AST.TopLevelNode[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      body.push(this.parseTopLevel());
    }
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'ProgramDeclaration',
      name,
      id,
      body,
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // =========================================================================
  // Instruction with full PDA seeds + constraints
  // =========================================================================

  private parseInstructionDeclaration(visibility: 'pub' | 'private', attrs: AST.Attribute[]): AST.InstructionDeclaration {
    const start = this.expect(TokenType.Instruction);
    const name = this.expectName().value;
    this.expect(TokenType.LeftParen);
    const { accounts, params } = this.parseInstructionParams();
    this.expect(TokenType.RightParen);
    let returns: AST.TypeAnnotation | undefined;
    if (this.check(TokenType.Arrow)) {
      this.advance();
      returns = this.parseTypeAnnotation();
    }
    const body = this.parseBlock();
    return {
      kind: 'InstructionDeclaration',
      name,
      visibility,
      accounts,
      params,
      body,
      returns,
      attributes: attrs,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseInstructionParams(): { accounts: AST.AccountParam[]; params: AST.Parameter[] } {
    const accounts: AST.AccountParam[] = [];
    const params: AST.Parameter[] = [];
    while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
      if (this.isAccountParamStart()) {
        accounts.push(this.parseAccountParam());
      } else {
        params.push(this.parseParameter());
      }
      if (!this.check(TokenType.RightParen)) {
        this.expect(TokenType.Comma);
      }
    }
    return { accounts, params };
  }

  private isAccountParamStart(): boolean {
    const t = this.currentToken().type;
    // Account params start with #[...] attributes or account-type keywords
    if (t === TokenType.Hash) return true;
    if (t === TokenType.Signer || t === TokenType.Account ||
        t === TokenType.Mint || t === TokenType.Token ||
        t === TokenType.PDA) return true;
    return false;
  }

  private parseAccountParam(): AST.AccountParam {
    const start = this.currentToken();
    const constraints: AST.AccountConstraint[] = [];
    let mutable = false;

    // Parse #[...] attribute constraints
    while (this.check(TokenType.Hash)) {
      this.advance();
      this.expect(TokenType.LeftBracket);
      while (!this.check(TokenType.RightBracket)) {
        const attrName = this.advance().value;
        let constraintValue: AST.Expression | undefined;
        if (attrName === 'mut') {
          mutable = true;
          constraints.push({ kind: 'mut' });
        } else if (attrName === 'init') {
          constraints.push({ kind: 'init' });
        } else if (attrName === 'payer' || attrName === 'space' || attrName === 'has_one' || attrName === 'close' || attrName === 'constraint') {
          if (this.check(TokenType.Assign)) {
            this.advance();
            constraintValue = this.parseExpression();
          }
          constraints.push({ kind: attrName as AST.AccountConstraint['kind'], value: constraintValue });
        } else if (attrName === 'seeds') {
          if (this.check(TokenType.Assign)) {
            this.advance();
            constraintValue = this.parseExpression();
          }
          constraints.push({ kind: 'seeds', value: constraintValue });
        } else if (attrName === 'bump') {
          if (this.check(TokenType.Assign)) {
            this.advance();
            constraintValue = this.parseExpression();
          }
          constraints.push({ kind: 'bump', value: constraintValue });
        }
        if (!this.check(TokenType.RightBracket)) this.match(TokenType.Comma);
      }
      this.expect(TokenType.RightBracket);
    }

    const typeToken = this.advance();
    let accountType: AST.AccountType;

    switch (typeToken.type) {
      case TokenType.Signer:
        accountType = { kind: 'Signer', mutable };
        break;
      case TokenType.Mint:
        accountType = { kind: 'Mint', mutable };
        break;
      case TokenType.Token:
        accountType = { kind: 'TokenAccount', mutable };
        break;
      case TokenType.PDA: {
        const seeds: AST.Expression[] = [];
        let bump: string | undefined;
        // Check for pda seeds in constraints
        for (const c of constraints) {
          if (c.kind === 'seeds' && c.value) {
            if (c.value.kind === 'ArrayExpr') {
              seeds.push(...c.value.elements);
            } else {
              seeds.push(c.value);
            }
          }
          if (c.kind === 'bump' && c.value && c.value.kind === 'IdentifierExpr') {
            bump = c.value.name;
          }
        }
        accountType = { kind: 'PDA', seeds, bump, mutable };
        break;
      }
      default:
        if (typeToken.type === TokenType.Identifier && typeToken.value === 'SystemProgram') {
          accountType = { kind: 'Program', name: 'System' };
        } else {
          accountType = { kind: 'Account', type: typeToken.value, mutable };
        }
    }

    const name = this.expectName().value;

    return {
      kind: 'AccountParam',
      name,
      accountType,
      constraints,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Account Declaration
  // =========================================================================

  private parseAccountDeclaration(attrs: AST.Attribute[]): AST.AccountDeclaration {
    const start = this.expect(TokenType.Account);
    const name = this.expectName().value;
    this.expect(TokenType.LeftBrace);
    const fields = this.parseFields();
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'AccountDeclaration',
      name,
      fields,
      attributes: attrs,
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // =========================================================================
  // Struct with Generics
  // =========================================================================

  private parseStructDeclaration(visibility: 'pub' | 'private', attrs: AST.Attribute[]): AST.StructDeclaration {
    const start = this.expect(TokenType.Struct);
    const name = this.expectName().value;
    const genericParams = this.parseGenericParams();
    this.expect(TokenType.LeftBrace);
    const fields = this.parseFields();
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'StructDeclaration',
      name,
      fields,
      visibility,
      genericParams,
      attributes: attrs,
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // =========================================================================
  // Enum with Generics
  // =========================================================================

  private parseEnumDeclaration(visibility: 'pub' | 'private', attrs: AST.Attribute[]): AST.EnumDeclaration {
    const start = this.expect(TokenType.Enum);
    const name = this.expectName().value;
    const genericParams = this.parseGenericParams();
    this.expect(TokenType.LeftBrace);
    const variants: AST.EnumVariant[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const vStart = this.currentToken();
      const vName = this.expectName().value;
      let fields: AST.FieldDeclaration[] | undefined;
      if (this.check(TokenType.LeftBrace)) {
        this.advance();
        fields = this.parseFields();
        this.expect(TokenType.RightBrace);
      } else if (this.check(TokenType.LeftParen)) {
        // Tuple variant: Variant(Type1, Type2)
        this.advance();
        fields = [];
        let idx = 0;
        while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
          const fStart = this.currentToken();
          const ty = this.parseTypeAnnotation();
          fields.push({
            kind: 'FieldDeclaration',
            name: `_${idx++}`,
            type: ty,
            visibility: 'pub',
            span: { start: fStart.span.start, end: this.prevToken().span.end },
          });
          this.match(TokenType.Comma);
        }
        this.expect(TokenType.RightParen);
      }
      variants.push({
        kind: 'EnumVariant',
        name: vName,
        fields,
        span: { start: vStart.span.start, end: this.prevToken().span.end },
      });
      this.match(TokenType.Comma);
    }
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'EnumDeclaration',
      name,
      variants,
      visibility,
      genericParams,
      attributes: attrs,
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // =========================================================================
  // Function with Generics
  // =========================================================================

  private parseFunctionDeclaration(visibility: 'pub' | 'private', isAsync: boolean, attrs: AST.Attribute[]): AST.FunctionDeclaration {
    if (isAsync) this.expect(TokenType.Async);
    const start = this.expect(TokenType.Fn);
    const name = this.expectName().value;
    const genericParams = this.parseGenericParams();
    this.expect(TokenType.LeftParen);
    const params = this.parseParamList();
    this.expect(TokenType.RightParen);
    let returnType: AST.TypeAnnotation | undefined;
    if (this.check(TokenType.Arrow) || this.check(TokenType.Colon)) {
      this.advance();
      returnType = this.parseTypeAnnotation();
    }
    const body = this.parseBlock();
    return {
      kind: 'FunctionDeclaration',
      name,
      visibility,
      params,
      returnType,
      body,
      isAsync,
      genericParams,
      attributes: attrs,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Event
  // =========================================================================

  private parseEventDeclaration(): AST.EventDeclaration {
    const start = this.expect(TokenType.Event);
    const name = this.expectName().value;
    this.expect(TokenType.LeftBrace);
    const fields = this.parseFields();
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'EventDeclaration',
      name,
      fields,
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // =========================================================================
  // Error
  // =========================================================================

  private parseErrorDeclaration(): AST.ErrorDeclaration {
    const start = this.expect(TokenType.Error);
    const name = this.expectName().value;
    this.expect(TokenType.LeftBrace);
    const variants: AST.ErrorVariant[] = [];
    let code = 6000;
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const vStart = this.currentToken();
      const vName = this.expectName().value;
      let message = vName;
      if (this.check(TokenType.Assign)) {
        this.advance();
        message = this.expect(TokenType.String).value;
      }
      variants.push({
        kind: 'ErrorVariant',
        name: vName,
        code: code++,
        message,
        span: { start: vStart.span.start, end: this.prevToken().span.end },
      });
      this.match(TokenType.Comma);
    }
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'ErrorDeclaration',
      name,
      variants,
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // =========================================================================
  // Import
  // =========================================================================

  private parseImportDeclaration(): AST.ImportDeclaration {
    const start = this.advance(); // 'use' or 'import'
    const items: AST.ImportItem[] = [];
    let isWildcard = false;

    if (this.check(TokenType.Star)) {
      isWildcard = true;
      this.advance();
      this.expect(TokenType.From);
    } else if (this.check(TokenType.LeftBrace)) {
      this.advance();
      while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
        const name = this.expectName().value;
        let alias: string | undefined;
        if (this.check(TokenType.As)) {
          this.advance();
          alias = this.expectName().value;
        }
        items.push({
          kind: 'ImportItem',
          name,
          alias,
          span: this.prevToken().span,
        });
        this.match(TokenType.Comma);
      }
      this.expect(TokenType.RightBrace);
      this.expect(TokenType.From);
    }

    const path = this.expect(TokenType.String).value;
    this.match(TokenType.Semicolon);

    return {
      kind: 'ImportDeclaration',
      path,
      items,
      isWildcard,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Const
  // =========================================================================

  private parseConstDeclaration(visibility: 'pub' | 'private'): AST.ConstDeclaration {
    const start = this.expect(TokenType.Const);
    const name = this.expectName().value;
    let type: AST.TypeAnnotation | undefined;
    if (this.check(TokenType.Colon)) {
      this.advance();
      type = this.parseTypeAnnotation();
    }
    this.expect(TokenType.Assign);
    const value = this.parseExpression();
    this.match(TokenType.Semicolon);
    return {
      kind: 'ConstDeclaration',
      name,
      type,
      value,
      visibility,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Type Alias with Generics
  // =========================================================================

  private parseTypeAlias(): AST.TypeAlias {
    const start = this.expect(TokenType.Type);
    const name = this.expectName().value;
    const genericParams = this.parseGenericParams();
    this.expect(TokenType.Assign);
    const type = this.parseTypeAnnotation();
    this.match(TokenType.Semicolon);
    return {
      kind: 'TypeAlias',
      name,
      type,
      genericParams,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Impl with Generics
  // =========================================================================

  private parseImplBlock(): AST.ImplBlock {
    const start = this.expect(TokenType.Impl);
    const genericParams = this.parseGenericParams();
    const target = this.expectName().value;
    let trait: string | undefined;
    if (this.check(TokenType.For)) {
      trait = target;
      this.advance();
    }
    this.expect(TokenType.LeftBrace);
    const methods: AST.FunctionDeclaration[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const methodAttrs = this.parseAttributes();
      const vis = this.check(TokenType.Pub) ? (this.advance(), 'pub' as const) : 'private' as const;
      const isAsync = this.check(TokenType.Async);
      methods.push(this.parseFunctionDeclaration(vis, isAsync, methodAttrs));
    }
    this.expect(TokenType.RightBrace);
    return {
      kind: 'ImplBlock',
      target,
      trait,
      methods,
      genericParams,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Trait with Generics
  // =========================================================================

  private parseTraitDeclaration(): AST.TraitDeclaration {
    const start = this.expect(TokenType.Trait);
    const name = this.expectName().value;
    const genericParams = this.parseGenericParams();
    this.expect(TokenType.LeftBrace);
    const methods: AST.FunctionSignature[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const fStart = this.expect(TokenType.Fn);
      const fName = this.expectName().value;
      this.expect(TokenType.LeftParen);
      const params = this.parseParamList();
      this.expect(TokenType.RightParen);
      let returnType: AST.TypeAnnotation | undefined;
      if (this.check(TokenType.Arrow)) {
        this.advance();
        returnType = this.parseTypeAnnotation();
      }
      this.match(TokenType.Semicolon);
      methods.push({
        kind: 'FunctionSignature',
        name: fName,
        params,
        returnType,
        span: { start: fStart.span.start, end: this.prevToken().span.end },
      });
    }
    this.expect(TokenType.RightBrace);
    return {
      kind: 'TraitDeclaration',
      name,
      methods,
      genericParams,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Client Block
  // =========================================================================

  private parseClientBlock(): AST.ClientBlock {
    const start = this.expect(TokenType.Client);
    const name = this.check(TokenType.Identifier) ? this.advance().value : 'default';
    const body = this.parseBlock();
    return {
      kind: 'ClientBlock',
      name,
      body,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Frontend Block
  // =========================================================================

  private parseFrontendBlock(): AST.FrontendBlock {
    const start = this.expect(TokenType.Frontend);
    let framework: string | undefined;
    if (this.check(TokenType.Identifier)) {
      framework = this.advance().value;
    }
    const body = this.parseBlock();
    return {
      kind: 'FrontendBlock',
      framework,
      body,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Config Block
  // =========================================================================

  private parseConfigBlock(): AST.ConfigBlock {
    const start = this.expect(TokenType.Config);
    this.expect(TokenType.LeftBrace);
    const entries: AST.ConfigEntry[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const key = this.expectName().value;
      this.expect(TokenType.Colon);
      const value = this.parseExpression();
      this.match(TokenType.Comma);
      this.match(TokenType.Semicolon);
      entries.push({
        kind: 'ConfigEntry',
        key,
        value,
        span: { start: this.prevToken().span.start, end: this.prevToken().span.end },
      });
    }
    this.expect(TokenType.RightBrace);
    return {
      kind: 'ConfigBlock',
      entries,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Test Block
  // =========================================================================

  private parseTestBlock(): AST.TestBlock {
    const start = this.expect(TokenType.Test);
    const name = this.expect(TokenType.String).value;
    const isAsync = this.match(TokenType.Async);
    const body = this.parseBlock();
    return {
      kind: 'TestBlock',
      name,
      body,
      isAsync,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // state machine Name { state X  state Y  transition t: X -> Y { guard { ... } } }
  private parseStateMachine(): AST.StateMachineDeclaration {
    const start = this.expect(TokenType.State);
    this.expect(TokenType.Machine);
    const name = this.expectName().value;
    this.expect(TokenType.LeftBrace);

    const states: AST.StateDef[] = [];
    const transitions: AST.TransitionDef[] = [];

    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.State)) {
        const sStart = this.advance();
        const sName = this.expectName().value;
        states.push({
          kind: 'StateDef',
          name: sName,
          span: { start: sStart.span.start, end: this.prevToken().span.end },
        });
      } else if (this.check(TokenType.Transition)) {
        const tStart = this.advance();
        const tName = this.expectName().value;
        this.expect(TokenType.Colon);
        // Parse from states: A | B | C
        const from: string[] = [this.expectName().value];
        while (this.match(TokenType.Pipe)) {
          from.push(this.expectName().value);
        }
        // ->
        this.expect(TokenType.Arrow);
        const to = this.expectName().value;

        let guard: AST.Statement[] | undefined;
        if (this.check(TokenType.LeftBrace)) {
          this.advance(); // {
          if (this.check(TokenType.Guard)) {
            this.advance(); // guard
            guard = this.parseBlock();
          }
          this.expect(TokenType.RightBrace);
        }

        transitions.push({
          kind: 'TransitionDef',
          name: tName,
          from,
          to,
          guard,
          span: { start: tStart.span.start, end: this.prevToken().span.end },
        });
      } else {
        throw this.error(`Expected 'state' or 'transition' in state machine, got ${this.currentToken().type}`, this.currentToken());
      }
    }

    this.expect(TokenType.RightBrace);
    return {
      kind: 'StateMachineDeclaration',
      name,
      states,
      transitions,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Statements
  // =========================================================================

  private parseStatement(): AST.Statement {
    const token = this.currentToken();

    switch (token.type) {
      case TokenType.Let: return this.parseLetOrDestructure();
      case TokenType.Const: return this.parseConstStatement();
      case TokenType.Return: return this.parseReturnStatement();
      case TokenType.If: return this.parseIfStatement();
      case TokenType.Match: return this.parseMatchStatement();
      case TokenType.For: return this.parseForStatement();
      case TokenType.While: return this.parseWhileStatement();
      case TokenType.Loop: return this.parseLoopStatement();
      case TokenType.Break: { this.advance(); this.match(TokenType.Semicolon); return { kind: 'BreakStatement', span: token.span }; }
      case TokenType.Continue: { this.advance(); this.match(TokenType.Semicolon); return { kind: 'ContinueStatement', span: token.span }; }
      case TokenType.Emit: return this.parseEmitStatement();
      case TokenType.Assert: return this.parseAssertStatement();
      case TokenType.Require: return this.parseRequireStatement();
      case TokenType.Try: return this.parseTryStatement();
      case TokenType.Throw: return this.parseThrowStatement();
      case TokenType.CPI: return this.parseCPICall();
      case TokenType.Transfer:
      case TokenType.MintTo:
      case TokenType.Burn:
      case TokenType.CloseAccount:
        return this.parseSPLOperation();
      default: return this.parseExpressionOrAssignment();
    }
  }

  // =========================================================================
  // Let with Destructuring
  // =========================================================================

  private parseLetOrDestructure(): AST.LetStatement | AST.DestructureStatement {
    const start = this.expect(TokenType.Let);
    const mutable = this.match(TokenType.Mut);

    // Check for destructuring: let { ... } = expr or let [ ... ] = expr or let ( ... ) = expr
    if (this.check(TokenType.LeftBrace)) {
      return this.parseObjectDestructure(start, mutable);
    }
    if (this.check(TokenType.LeftBracket)) {
      return this.parseArrayDestructure(start, mutable);
    }
    if (this.check(TokenType.LeftParen)) {
      return this.parseTupleDestructure(start, mutable);
    }

    const name = this.expectName().value;
    let type: AST.TypeAnnotation | undefined;
    if (this.check(TokenType.Colon)) {
      this.advance();
      type = this.parseTypeAnnotation();
    }
    let value: AST.Expression | undefined;
    if (this.check(TokenType.Assign)) {
      this.advance();
      value = this.parseExpression();
    }
    this.match(TokenType.Semicolon);
    return {
      kind: 'LetStatement',
      name,
      type,
      mutable,
      value,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseObjectDestructure(start: Token, mutable: boolean): AST.DestructureStatement {
    this.expect(TokenType.LeftBrace);
    const fields: { name: string; alias?: string; default?: AST.Expression }[] = [];
    let rest: string | undefined;
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.DotDot)) {
        this.advance();
        rest = this.expectName().value;
        break;
      }
      const name = this.expectName().value;
      let alias: string | undefined;
      let def: AST.Expression | undefined;
      if (this.check(TokenType.Colon)) {
        this.advance();
        alias = this.expectName().value;
      }
      if (this.check(TokenType.Assign)) {
        this.advance();
        def = this.parseExpression();
      }
      fields.push({ name, alias, default: def });
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.RightBrace);
    this.expect(TokenType.Assign);
    const value = this.parseExpression();
    this.match(TokenType.Semicolon);
    return {
      kind: 'DestructureStatement',
      pattern: {
        kind: 'ObjectDestructure',
        fields,
        rest,
        span: { start: start.span.start, end: this.prevToken().span.end },
      },
      mutable,
      value,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseArrayDestructure(start: Token, mutable: boolean): AST.DestructureStatement {
    this.expect(TokenType.LeftBracket);
    const elements: (string | null)[] = [];
    let rest: string | undefined;
    while (!this.check(TokenType.RightBracket) && !this.isAtEnd()) {
      if (this.check(TokenType.DotDot)) {
        this.advance();
        if (this.check(TokenType.Identifier)) {
          rest = this.advance().value;
        }
        break;
      }
      if (this.check(TokenType.Comma)) {
        elements.push(null);
      } else {
        elements.push(this.expectName().value);
      }
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.RightBracket);
    this.expect(TokenType.Assign);
    const value = this.parseExpression();
    this.match(TokenType.Semicolon);
    return {
      kind: 'DestructureStatement',
      pattern: {
        kind: 'ArrayDestructure',
        elements,
        rest,
        span: { start: start.span.start, end: this.prevToken().span.end },
      },
      mutable,
      value,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseTupleDestructure(start: Token, mutable: boolean): AST.DestructureStatement {
    this.expect(TokenType.LeftParen);
    const elements: string[] = [];
    while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
      elements.push(this.expectName().value);
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.RightParen);
    this.expect(TokenType.Assign);
    const value = this.parseExpression();
    this.match(TokenType.Semicolon);
    return {
      kind: 'DestructureStatement',
      pattern: {
        kind: 'TupleDestructure',
        elements,
        span: { start: start.span.start, end: this.prevToken().span.end },
      },
      mutable,
      value,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseConstStatement(): AST.ConstStatement {
    const start = this.expect(TokenType.Const);
    const name = this.expectName().value;
    let type: AST.TypeAnnotation | undefined;
    if (this.check(TokenType.Colon)) {
      this.advance();
      type = this.parseTypeAnnotation();
    }
    this.expect(TokenType.Assign);
    const value = this.parseExpression();
    this.match(TokenType.Semicolon);
    return {
      kind: 'ConstStatement',
      name,
      type,
      value,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseReturnStatement(): AST.ReturnStatement {
    const start = this.expect(TokenType.Return);
    let value: AST.Expression | undefined;
    if (!this.check(TokenType.Semicolon) && !this.check(TokenType.RightBrace)) {
      value = this.parseExpression();
    }
    this.match(TokenType.Semicolon);
    return {
      kind: 'ReturnStatement',
      value,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseIfStatement(): AST.IfStatement {
    const start = this.expect(TokenType.If);
    const condition = this.parseExpression();
    const then = this.parseBlock();
    const elseIf: { condition: AST.Expression; body: AST.Statement[] }[] = [];
    let elseBody: AST.Statement[] | undefined;
    while (this.check(TokenType.Else)) {
      this.advance();
      if (this.check(TokenType.If)) {
        this.advance();
        const cond = this.parseExpression();
        const body = this.parseBlock();
        elseIf.push({ condition: cond, body });
      } else {
        elseBody = this.parseBlock();
        break;
      }
    }
    return {
      kind: 'IfStatement',
      condition,
      then,
      elseIf: elseIf.length > 0 ? elseIf : undefined,
      else: elseBody,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Match with Full Pattern Support
  // =========================================================================

  private parseMatchStatement(): AST.MatchStatement {
    const start = this.expect(TokenType.Match);
    const subject = this.parseExpression();
    this.expect(TokenType.LeftBrace);
    const arms: AST.MatchArm[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const pattern = this.parsePattern();
      let guard: AST.Expression | undefined;
      if (this.check(TokenType.If)) {
        this.advance();
        guard = this.parseExpression();
      }
      this.expect(TokenType.FatArrow);
      let body: AST.Statement[];
      if (this.check(TokenType.LeftBrace)) {
        body = this.parseBlock();
      } else {
        const expr = this.parseExpression();
        body = [{ kind: 'ExpressionStatement' as const, expression: expr, span: expr.span }];
      }
      this.match(TokenType.Comma);
      arms.push({
        kind: 'MatchArm',
        pattern,
        guard,
        body,
        span: { start: pattern.span.start, end: this.prevToken().span.end },
      });
    }
    this.expect(TokenType.RightBrace);
    return {
      kind: 'MatchStatement',
      subject,
      arms,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Pattern Parsing
  // =========================================================================

  private parsePattern(): AST.Pattern {
    let pattern = this.parseSinglePattern();
    // Or pattern: pat1 | pat2
    if (this.check(TokenType.Pipe)) {
      const patterns: AST.Pattern[] = [pattern];
      while (this.check(TokenType.Pipe)) {
        this.advance();
        patterns.push(this.parseSinglePattern());
      }
      pattern = {
        kind: 'OrPattern',
        patterns,
        span: { start: patterns[0].span.start, end: patterns[patterns.length - 1].span.end },
      };
    }
    return pattern;
  }

  private parseSinglePattern(): AST.Pattern {
    const token = this.currentToken();

    // Wildcard: _
    if (this.check(TokenType.Underscore)) {
      this.advance();
      return { kind: 'WildcardPattern', span: token.span };
    }

    // Tuple pattern: (pat1, pat2)
    if (this.check(TokenType.LeftParen)) {
      this.advance();
      const elements: AST.Pattern[] = [];
      while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
        elements.push(this.parsePattern());
        this.match(TokenType.Comma);
      }
      const end = this.expect(TokenType.RightParen);
      return { kind: 'TuplePattern', elements, span: { start: token.span.start, end: end.span.end } };
    }

    // Array pattern: [pat1, pat2]
    if (this.check(TokenType.LeftBracket)) {
      this.advance();
      const elements: AST.Pattern[] = [];
      let rest = false;
      while (!this.check(TokenType.RightBracket) && !this.isAtEnd()) {
        if (this.check(TokenType.DotDot)) {
          this.advance();
          rest = true;
          break;
        }
        elements.push(this.parsePattern());
        this.match(TokenType.Comma);
      }
      const end = this.expect(TokenType.RightBracket);
      return { kind: 'ArrayPattern', elements, rest, span: { start: token.span.start, end: end.span.end } };
    }

    // Literal patterns: numbers, strings, bools, null
    if (this.check(TokenType.Number)) {
      const lit = this.advance();
      const numExpr: AST.NumberLiteral = { kind: 'NumberLiteral', value: Number(lit.value), raw: lit.value, span: lit.span };
      // Range pattern: 1..5 or 1..=5
      if (this.check(TokenType.DotDot)) {
        this.advance();
        const inclusive = this.match(TokenType.Assign);
        const end = this.expect(TokenType.Number);
        const endExpr: AST.NumberLiteral = { kind: 'NumberLiteral', value: Number(end.value), raw: end.value, span: end.span };
        return { kind: 'RangePattern', start: numExpr, end: endExpr, inclusive, span: { start: lit.span.start, end: end.span.end } };
      }
      if (this.check(TokenType.DotDotEquals)) {
        this.advance();
        const end = this.expect(TokenType.Number);
        const endExpr: AST.NumberLiteral = { kind: 'NumberLiteral', value: Number(end.value), raw: end.value, span: end.span };
        return { kind: 'RangePattern', start: numExpr, end: endExpr, inclusive: true, span: { start: lit.span.start, end: end.span.end } };
      }
      return { kind: 'LiteralPattern', value: numExpr, span: lit.span };
    }

    if (this.check(TokenType.String)) {
      const lit = this.advance();
      return { kind: 'LiteralPattern', value: { kind: 'StringLiteral', value: lit.value, span: lit.span }, span: lit.span };
    }

    if (this.check(TokenType.True)) {
      const lit = this.advance();
      return { kind: 'LiteralPattern', value: { kind: 'BooleanLiteral', value: true, span: lit.span }, span: lit.span };
    }

    if (this.check(TokenType.False)) {
      const lit = this.advance();
      return { kind: 'LiteralPattern', value: { kind: 'BooleanLiteral', value: false, span: lit.span }, span: lit.span };
    }

    if (this.check(TokenType.Null)) {
      const lit = this.advance();
      return { kind: 'LiteralPattern', value: { kind: 'NullLiteral', span: lit.span }, span: lit.span };
    }

    // Identifier, Enum, or Struct pattern
    if (this.check(TokenType.Identifier)) {
      const name = this.advance();
      // Enum pattern: Name::Variant(fields) or Name::Variant
      if (this.check(TokenType.ColonColon)) {
        this.advance();
        const variant = this.expectName().value;
        let fields: AST.Pattern[] | undefined;
        if (this.check(TokenType.LeftParen)) {
          this.advance();
          fields = [];
          while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
            fields.push(this.parsePattern());
            this.match(TokenType.Comma);
          }
          this.expect(TokenType.RightParen);
        }
        return {
          kind: 'EnumPattern',
          enumName: name.value,
          variant,
          fields,
          span: { start: name.span.start, end: this.prevToken().span.end },
        };
      }
      // Struct pattern: Name { field: pattern, ... }
      if (this.check(TokenType.LeftBrace)) {
        this.advance();
        const fields: { name: string; pattern: AST.Pattern }[] = [];
        let rest = false;
        while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
          if (this.check(TokenType.DotDot)) {
            this.advance();
            rest = true;
            break;
          }
          const fName = this.expectName().value;
          let fPattern: AST.Pattern;
          if (this.check(TokenType.Colon)) {
            this.advance();
            fPattern = this.parsePattern();
          } else {
            fPattern = { kind: 'IdentifierPattern', name: fName, span: this.prevToken().span };
          }
          fields.push({ name: fName, pattern: fPattern });
          this.match(TokenType.Comma);
        }
        const end = this.expect(TokenType.RightBrace);
        return {
          kind: 'StructPattern',
          name: name.value,
          fields,
          rest,
          span: { start: name.span.start, end: end.span.end },
        };
      }
      return { kind: 'IdentifierPattern', name: name.value, span: name.span };
    }

    throw this.error(`Expected pattern, got ${token.type}`, token);
  }

  // =========================================================================
  // For / While / Loop
  // =========================================================================

  private parseForStatement(): AST.ForStatement {
    const start = this.expect(TokenType.For);
    const variable = this.expectName().value;
    // expect 'in'
    if (this.check(TokenType.In)) {
      this.advance();
    } else {
      const inToken = this.expectName();
      if (inToken.value !== 'in') throw this.error("Expected 'in' in for loop", inToken);
    }
    const iterable = this.parseExpression();
    const body = this.parseBlock();
    return {
      kind: 'ForStatement',
      variable,
      iterable,
      body,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseWhileStatement(): AST.WhileStatement {
    const start = this.expect(TokenType.While);
    const condition = this.parseExpression();
    const body = this.parseBlock();
    return {
      kind: 'WhileStatement',
      condition,
      body,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseLoopStatement(): AST.LoopStatement {
    const start = this.expect(TokenType.Loop);
    const body = this.parseBlock();
    return {
      kind: 'LoopStatement',
      body,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Emit
  // =========================================================================

  private parseEmitStatement(): AST.EmitStatement {
    const start = this.expect(TokenType.Emit);
    const event = this.expectName().value;
    this.expect(TokenType.LeftParen);
    const args: AST.Expression[] = [];
    while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
      args.push(this.parseExpression());
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.RightParen);
    this.match(TokenType.Semicolon);
    return {
      kind: 'EmitStatement',
      event,
      args,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Assert / Require
  // =========================================================================

  private parseAssertStatement(): AST.AssertStatement {
    const start = this.expect(TokenType.Assert);
    this.expect(TokenType.LeftParen);
    const condition = this.parseExpression();
    let message: AST.Expression | undefined;
    if (this.match(TokenType.Comma)) {
      message = this.parseExpression();
    }
    this.expect(TokenType.RightParen);
    this.match(TokenType.Semicolon);
    return {
      kind: 'AssertStatement',
      condition,
      message,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseRequireStatement(): AST.RequireStatement {
    const start = this.expect(TokenType.Require);
    this.expect(TokenType.LeftParen);
    const condition = this.parseExpression();
    let errorCode: AST.Expression | undefined;
    let message: AST.Expression | undefined;
    if (this.match(TokenType.Comma)) {
      errorCode = this.parseExpression();
      if (this.match(TokenType.Comma)) {
        message = this.parseExpression();
      }
    }
    this.expect(TokenType.RightParen);
    this.match(TokenType.Semicolon);
    return {
      kind: 'RequireStatement',
      condition,
      errorCode,
      message,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Try / Catch / Throw
  // =========================================================================

  private parseTryStatement(): AST.TryStatement {
    const start = this.expect(TokenType.Try);
    const body = this.parseBlock();
    this.expect(TokenType.Catch);
    let catchParam: string | undefined;
    if (this.check(TokenType.LeftParen)) {
      this.advance();
      catchParam = this.expectName().value;
      this.expect(TokenType.RightParen);
    }
    const catchBody = this.parseBlock();
    return {
      kind: 'TryStatement',
      body,
      catchParam,
      catchBody,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseThrowStatement(): AST.ThrowStatement {
    const start = this.expect(TokenType.Throw);
    const value = this.parseExpression();
    this.match(TokenType.Semicolon);
    return {
      kind: 'ThrowStatement',
      value,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // CPI Call: cpi program::instruction(accounts, args)
  // =========================================================================

  private parseCPICall(): AST.CPICall {
    const start = this.expect(TokenType.CPI);
    const program = this.expectName().value;
    this.expect(TokenType.ColonColon);
    const instruction = this.expectName().value;
    this.expect(TokenType.LeftParen);
    const accounts: AST.Expression[] = [];
    const args: AST.Expression[] = [];
    let seeds: AST.Expression[] | undefined;
    // Parse account list first (until we see a separator or close paren)
    let isAccounts = true;
    while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
      if (this.check(TokenType.Semicolon)) {
        this.advance();
        isAccounts = false;
        continue;
      }
      const expr = this.parseExpression();
      if (isAccounts) {
        accounts.push(expr);
      } else {
        args.push(expr);
      }
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.RightParen);
    // Optional seeds: .with_seeds([...])
    if (this.check(TokenType.Dot) && this.peekNext()?.value === 'with_seeds') {
      this.advance(); // .
      this.advance(); // with_seeds
      this.expect(TokenType.LeftParen);
      seeds = [];
      while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
        seeds.push(this.parseExpression());
        this.match(TokenType.Comma);
      }
      this.expect(TokenType.RightParen);
    }
    this.match(TokenType.Semicolon);
    return {
      kind: 'CPICall',
      program,
      instruction,
      accounts,
      args,
      seeds,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // SPL Operations: transfer { from, to, amount, authority }
  // =========================================================================

  private parseSPLOperation(): AST.SPLOperation {
    const start = this.currentToken();
    const opMap: Record<string, AST.SPLOperation['operation']> = {
      [TokenType.Transfer]: 'transfer',
      [TokenType.MintTo]: 'mint_to',
      [TokenType.Burn]: 'burn',
      [TokenType.CloseAccount]: 'close_account',
    };
    const operation = opMap[this.advance().type] ?? 'transfer';
    this.expect(TokenType.LeftBrace);
    const args: { name: string; value: AST.Expression }[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const name = this.expectName().value;
      this.expect(TokenType.Colon);
      const value = this.parseExpression();
      args.push({ name, value });
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.RightBrace);
    this.match(TokenType.Semicolon);
    return {
      kind: 'SPLOperation',
      operation,
      args,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Expression or Assignment
  // =========================================================================

  private parseExpressionOrAssignment(): AST.Statement {
    const expr = this.parseExpression();
    // Compound assignment operators
    const assignOps: Record<string, AST.AssignmentStatement['operator']> = {
      [TokenType.Assign]: '=',
      [TokenType.PlusAssign]: '+=',
      [TokenType.MinusAssign]: '-=',
      [TokenType.StarAssign]: '*=',
      [TokenType.StarStarAssign]: '**=',
      [TokenType.SlashAssign]: '/=',
      [TokenType.PercentAssign]: '%=',
      [TokenType.AmpersandAssign]: '&=',
      [TokenType.PipeAssign]: '|=',
      [TokenType.CaretAssign]: '^=',
      [TokenType.ShiftLeftAssign]: '<<=',
      [TokenType.ShiftRightAssign]: '>>=',
      [TokenType.NullishCoalesceAssign]: '??=',
    };
    const ct = this.currentToken().type;
    if (ct in assignOps) {
      const op = assignOps[ct]!;
      this.advance();
      const value = this.parseExpression();
      this.match(TokenType.Semicolon);
      return {
        kind: 'AssignmentStatement',
        target: expr,
        value,
        operator: op,
        span: { start: expr.span.start, end: this.prevToken().span.end },
      };
    }
    this.match(TokenType.Semicolon);
    return {
      kind: 'ExpressionStatement',
      expression: expr,
      span: expr.span,
    };
  }

  // =========================================================================
  // Expressions (Full Precedence)
  // =========================================================================

  private parseExpression(): AST.Expression {
    return this.parseTernary();
  }

  private parseTernary(): AST.Expression {
    const expr = this.parseNullishCoalesce();
    if (this.check(TokenType.Question) && !this.check(TokenType.QuestionDot)) {
      this.advance();
      const consequent = this.parseExpression();
      this.expect(TokenType.Colon);
      const alternate = this.parseExpression();
      return { kind: 'TernaryExpr', condition: expr, consequent, alternate, span: { start: expr.span.start, end: alternate.span.end } };
    }
    return expr;
  }

  private parseNullishCoalesce(): AST.Expression {
    let left = this.parseOr();
    while (this.check(TokenType.NullishCoalesce)) {
      const op = this.advance().value;
      const right = this.parseOr();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseOr(): AST.Expression {
    let left = this.parseAnd();
    while (this.check(TokenType.Or)) {
      const op = this.advance().value;
      const right = this.parseAnd();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseAnd(): AST.Expression {
    let left = this.parseBitwiseOr();
    while (this.check(TokenType.And)) {
      const op = this.advance().value;
      const right = this.parseBitwiseOr();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseBitwiseOr(): AST.Expression {
    let left = this.parseBitwiseXor();
    while (this.check(TokenType.Pipe)) {
      const op = this.advance().value;
      const right = this.parseBitwiseXor();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseBitwiseXor(): AST.Expression {
    let left = this.parseBitwiseAnd();
    while (this.check(TokenType.Caret)) {
      const op = this.advance().value;
      const right = this.parseBitwiseAnd();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseBitwiseAnd(): AST.Expression {
    let left = this.parseEquality();
    while (this.check(TokenType.Ampersand)) {
      const op = this.advance().value;
      const right = this.parseEquality();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseEquality(): AST.Expression {
    let left = this.parseComparison();
    while (this.check(TokenType.Equals) || this.check(TokenType.NotEquals)) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseComparison(): AST.Expression {
    let left = this.parseShift();
    while (this.check(TokenType.LessThan) || this.check(TokenType.GreaterThan) || this.check(TokenType.LessEqual) || this.check(TokenType.GreaterEqual)) {
      const op = this.advance().value;
      const right = this.parseShift();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseShift(): AST.Expression {
    let left = this.parseAdditive();
    while (this.check(TokenType.ShiftLeft) || this.check(TokenType.ShiftRight)) {
      const op = this.advance().value;
      const right = this.parseAdditive();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  private parseAdditive(): AST.Expression {
    let left = this.parseMultiplicative();
    while (this.check(TokenType.Plus) || this.check(TokenType.Minus)) {
      const op = this.advance().value;
      const right = this.parseMultiplicative();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    // Range expressions: expr..expr or expr..=expr
    if (this.check(TokenType.DotDot) || this.check(TokenType.DotDotEquals)) {
      const inclusive = this.currentToken().type === TokenType.DotDotEquals;
      this.advance();
      const end = this.parseMultiplicative();
      return { kind: 'RangeExpr', start: left, end, inclusive, span: { start: left.span.start, end: end.span.end } } as AST.RangeExpr;
    }
    return left;
  }

  private parseMultiplicative(): AST.Expression {
    let left = this.parseExponentiation();
    while (this.check(TokenType.Star) || this.check(TokenType.Slash) || this.check(TokenType.Percent)) {
      const op = this.advance().value;
      const right = this.parseExponentiation();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  // Exponentiation: right-associative, higher precedence than multiplicative
  private parseExponentiation(): AST.Expression {
    let left = this.parseCast();
    if (this.check(TokenType.StarStar)) {
      const op = this.advance().value;
      const right = this.parseExponentiation(); // right-associative
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  // Cast expression: expr as Type
  private parseCast(): AST.Expression {
    let expr = this.parseUnary();
    while (this.check(TokenType.As)) {
      this.advance();
      const targetType = this.parseTypeAnnotation();
      expr = {
        kind: 'CastExpr',
        expression: expr,
        targetType,
        span: { start: expr.span.start, end: this.prevToken().span.end },
      };
    }
    return expr;
  }

  private parseUnary(): AST.Expression {
    if (this.check(TokenType.Not) || this.check(TokenType.Minus)) {
      const op = this.advance();
      const expr = this.parseUnary();
      return { kind: 'UnaryExpr', operator: op.value, operand: expr, span: { start: op.span.start, end: expr.span.end } };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): AST.Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TokenType.LeftParen)) {
        this.advance();
        const args: AST.Expression[] = [];
        while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
          args.push(this.parseExpression());
          this.match(TokenType.Comma);
        }
        this.expect(TokenType.RightParen);
        expr = { kind: 'CallExpr', callee: expr, args, span: { start: expr.span.start, end: this.prevToken().span.end } };
      } else if (this.check(TokenType.Dot)) {
        this.advance();
        const prop = this.expectName().value;
        expr = { kind: 'MemberExpr', object: expr, property: prop, span: { start: expr.span.start, end: this.prevToken().span.end } };
      } else if (this.check(TokenType.QuestionDot)) {
        this.advance();
        const prop = this.expectName().value;
        expr = { kind: 'OptionalChainExpr', object: expr, property: prop, span: { start: expr.span.start, end: this.prevToken().span.end } };
      } else if (this.check(TokenType.LeftBracket)) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RightBracket);
        expr = { kind: 'IndexExpr', object: expr, index, span: { start: expr.span.start, end: this.prevToken().span.end } };
      } else if (this.check(TokenType.ColonColon)) {
        this.advance();
        const prop = this.expectName().value;
        expr = { kind: 'MemberExpr', object: expr, property: prop, span: { start: expr.span.start, end: this.prevToken().span.end } };
      } else if (this.check(TokenType.Question) && !this.peekNextIs(TokenType.Colon) && !this.peekNextIs(TokenType.Dot)) {
        // Try expression: expr?
        this.advance();
        expr = { kind: 'TryExpr', expression: expr, span: { start: expr.span.start, end: this.prevToken().span.end } };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): AST.Expression {
    const token = this.currentToken();

    switch (token.type) {
      case TokenType.Number: {
        this.advance();
        return { kind: 'NumberLiteral', value: Number(token.value), raw: token.value, span: token.span };
      }
      case TokenType.String: {
        this.advance();
        return { kind: 'StringLiteral', value: token.value, span: token.span };
      }
      case TokenType.TemplateString: {
        this.advance();
        return this.parseTemplateString(token);
      }
      case TokenType.True: {
        this.advance();
        return { kind: 'BooleanLiteral', value: true, span: token.span };
      }
      case TokenType.False: {
        this.advance();
        return { kind: 'BooleanLiteral', value: false, span: token.span };
      }
      case TokenType.Null: {
        this.advance();
        return { kind: 'NullLiteral', span: token.span };
      }
      case TokenType.Identifier: {
        this.advance();
        // Struct init: Name { field: value, ... }
        if (this.check(TokenType.LeftBrace) && this.looksLikeStructInit()) {
          return this.parseStructInit(token);
        }
        return { kind: 'IdentifierExpr', name: token.value, span: token.span };
      }
      case TokenType.LeftParen: {
        this.advance();
        // Tuple expression or grouped expression
        if (this.check(TokenType.RightParen)) {
          const end = this.expect(TokenType.RightParen);
          return { kind: 'TupleExpr', elements: [], span: { start: token.span.start, end: end.span.end } };
        }
        const first = this.parseExpression();
        if (this.check(TokenType.Comma)) {
          // It's a tuple
          const elements: AST.Expression[] = [first];
          while (this.match(TokenType.Comma)) {
            if (this.check(TokenType.RightParen)) break;
            elements.push(this.parseExpression());
          }
          const end = this.expect(TokenType.RightParen);
          return { kind: 'TupleExpr', elements, span: { start: token.span.start, end: end.span.end } };
        }
        this.expect(TokenType.RightParen);
        return first;
      }
      case TokenType.LeftBracket: {
        this.advance();
        const elements: AST.Expression[] = [];
        while (!this.check(TokenType.RightBracket) && !this.isAtEnd()) {
          if (this.check(TokenType.DotDotDot)) {
            const spreadStart = this.advance().span.start;
            const inner = this.parseExpression();
            elements.push({ kind: 'SpreadExpr', expression: inner, span: { start: spreadStart, end: inner.span.end } } as AST.SpreadExpr);
          } else {
            elements.push(this.parseExpression());
          }
          this.match(TokenType.Comma);
        }
        const end = this.expect(TokenType.RightBracket);
        return { kind: 'ArrayExpr', elements, span: { start: token.span.start, end: end.span.end } };
      }
      case TokenType.Await: {
        this.advance();
        const expression = this.parsePostfix();
        return { kind: 'AwaitExpr', expression, span: { start: token.span.start, end: expression.span.end } };
      }
      case TokenType.Pipe: {
        return this.parseLambda();
      }
      default:
        throw this.error(`Unexpected token: ${token.type} (${token.value})`, token);
    }
  }

  // =========================================================================
  // Template String Parsing
  // =========================================================================

  private parseTemplateString(token: Token): AST.TemplateStringLiteral {
    const raw = token.value;
    const parts: (string | AST.Expression)[] = [];
    let current = '';
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === '$' && raw[i + 1] === '{') {
        if (current) { parts.push(current); current = ''; }
        i += 2;
        let depth = 1;
        let expr = '';
        while (i < raw.length && depth > 0) {
          if (raw[i] === '{') depth++;
          if (raw[i] === '}') depth--;
          if (depth > 0) expr += raw[i];
          i++;
        }
        // Re-lex and parse the interpolated expression
        try {
          const { Lexer } = await_import_lexer();
          const subLexer = new Lexer(expr, this.file);
          const subTokens = subLexer.tokenize();
          const subParser = new Parser(subTokens, this.file);
          parts.push(subParser.parseExpression());
        } catch {
          // Fallback: treat as identifier
          parts.push({ kind: 'IdentifierExpr', name: expr.trim(), span: token.span } as AST.IdentifierExpr);
        }
      } else {
        current += raw[i];
        i++;
      }
    }
    if (current) parts.push(current);
    return { kind: 'TemplateStringLiteral', parts, raw, span: token.span };
  }

  // =========================================================================
  // Struct Init / Lambda
  // =========================================================================

  private looksLikeStructInit(): boolean {
    let saved = this.pos;
    try {
      if (!this.check(TokenType.LeftBrace)) return false;
      this.advance();
      if (this.check(TokenType.Identifier)) {
        this.advance();
        return this.check(TokenType.Colon);
      }
      return false;
    } finally {
      this.pos = saved;
    }
  }

  private parseStructInit(nameToken: Token): AST.StructInitExpr {
    this.expect(TokenType.LeftBrace);
    const fields: { name: string; value: AST.Expression }[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const fieldName = this.expectName().value;
      this.expect(TokenType.Colon);
      const fieldValue = this.parseExpression();
      fields.push({ name: fieldName, value: fieldValue });
      this.match(TokenType.Comma);
    }
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'StructInitExpr',
      name: nameToken.value,
      fields,
      span: { start: nameToken.span.start, end: end.span.end },
    };
  }

  private parseLambda(): AST.LambdaExpr {
    const start = this.expect(TokenType.Pipe);
    const params = this.parseParamList();
    this.expect(TokenType.Pipe);
    if (this.check(TokenType.LeftBrace)) {
      const body = this.parseBlock();
      return {
        kind: 'LambdaExpr',
        params,
        body,
        span: { start: start.span.start, end: this.prevToken().span.end },
      };
    }
    const expr = this.parseExpression();
    return {
      kind: 'LambdaExpr',
      params,
      body: expr,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // =========================================================================
  // Type Annotations with Result<T, E>
  // =========================================================================

  private parseTypeAnnotation(): AST.TypeAnnotation {
    const token = this.currentToken();

    const primitives = ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128', 'f32', 'f64', 'bool', 'string', 'pubkey', 'bytes'];
    if (token.type === TokenType.Identifier && primitives.includes(token.value)) {
      this.advance();
      const baseType: AST.TypeAnnotation = {
        kind: 'PrimitiveType',
        name: token.value as AST.PrimitiveType['name'],
        span: token.span,
      };
      // Check for trailing [] for array
      if (this.check(TokenType.LeftBracket) && this.peekNextIs(TokenType.RightBracket)) {
        this.advance(); this.advance();
        return { kind: 'ArrayType', element: baseType, span: { start: token.span.start, end: this.prevToken().span.end } };
      }
      // Check for trailing ? for option
      if (this.check(TokenType.Question)) {
        this.advance();
        return { kind: 'OptionType', inner: baseType, span: { start: token.span.start, end: this.prevToken().span.end } };
      }
      return baseType;
    }

    // Option type: ?Type
    if (this.check(TokenType.Question)) {
      const start = this.advance();
      const inner = this.parseTypeAnnotation();
      return { kind: 'OptionType', inner, span: { start: start.span.start, end: inner.span.end } };
    }

    // Array type: [Type] or [Type; N]
    if (this.check(TokenType.LeftBracket)) {
      const start = this.advance();
      const element = this.parseTypeAnnotation();
      let size: number | undefined;
      if (this.check(TokenType.Semicolon)) {
        this.advance();
        size = Number(this.expect(TokenType.Number).value);
      }
      const end = this.expect(TokenType.RightBracket);
      return { kind: 'ArrayType', element, size, span: { start: start.span.start, end: end.span.end } };
    }

    // Tuple type: (Type1, Type2)
    if (this.check(TokenType.LeftParen)) {
      const start = this.advance();
      const elements: AST.TypeAnnotation[] = [];
      while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
        elements.push(this.parseTypeAnnotation());
        this.match(TokenType.Comma);
      }
      const end = this.expect(TokenType.RightParen);
      return { kind: 'TupleType', elements, span: { start: start.span.start, end: end.span.end } };
    }

    // Named type: Name or Name<T>
    if (token.type === TokenType.Identifier) {
      this.advance();
      // Special: Result<T, E>
      if (token.value === 'Result') {
        if (this.check(TokenType.LessThan)) {
          this.advance();
          const ok = this.parseTypeAnnotation();
          let err: AST.TypeAnnotation | undefined;
          if (this.check(TokenType.Comma)) {
            this.advance();
            err = this.parseTypeAnnotation();
          }
          this.expect(TokenType.GreaterThan);
          return { kind: 'ResultType', ok, err, span: { start: token.span.start, end: this.prevToken().span.end } };
        }
      }
      let typeArgs: AST.TypeAnnotation[] | undefined;
      if (this.check(TokenType.LessThan)) {
        this.advance();
        typeArgs = [];
        while (!this.check(TokenType.GreaterThan) && !this.isAtEnd()) {
          typeArgs.push(this.parseTypeAnnotation());
          this.match(TokenType.Comma);
        }
        this.expect(TokenType.GreaterThan);
      }
      let baseType: AST.TypeAnnotation = { kind: 'NamedType', name: token.value, typeArgs, span: { start: token.span.start, end: this.prevToken().span.end } };
      // Trailing [] or ?
      if (this.check(TokenType.LeftBracket) && this.peekNextIs(TokenType.RightBracket)) {
        this.advance(); this.advance();
        baseType = { kind: 'ArrayType', element: baseType, span: { start: token.span.start, end: this.prevToken().span.end } };
      }
      if (this.check(TokenType.Question)) {
        this.advance();
        baseType = { kind: 'OptionType', inner: baseType, span: { start: token.span.start, end: this.prevToken().span.end } };
      }
      return baseType;
    }

    // Function type: fn(T1, T2) -> R
    if (this.check(TokenType.Fn)) {
      this.advance();
      this.expect(TokenType.LeftParen);
      const params: AST.TypeAnnotation[] = [];
      while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
        params.push(this.parseTypeAnnotation());
        this.match(TokenType.Comma);
      }
      this.expect(TokenType.RightParen);
      this.expect(TokenType.Arrow);
      const returnType = this.parseTypeAnnotation();
      return { kind: 'FunctionType', params, returnType, span: { start: token.span.start, end: this.prevToken().span.end } };
    }

    throw this.error(`Expected type annotation, got ${token.type}`, token);
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private parseBlock(): AST.Statement[] {
    this.expect(TokenType.LeftBrace);
    const stmts: AST.Statement[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      stmts.push(this.parseStatement());
    }
    this.expect(TokenType.RightBrace);
    return stmts;
  }

  private parseFields(): AST.FieldDeclaration[] {
    const fields: AST.FieldDeclaration[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const vis = this.check(TokenType.Pub) ? (this.advance(), 'pub' as const) : 'private' as const;
      const fieldStart = this.currentToken();
      const name = this.expectName().value;
      this.expect(TokenType.Colon);
      const type = this.parseTypeAnnotation();
      let def: AST.Expression | undefined;
      if (this.check(TokenType.Assign)) {
        this.advance();
        def = this.parseExpression();
      }
      fields.push({
        kind: 'FieldDeclaration',
        name,
        type,
        visibility: vis,
        default: def,
        span: { start: fieldStart.span.start, end: this.prevToken().span.end },
      });
      this.match(TokenType.Comma);
      this.match(TokenType.Semicolon);
    }
    return fields;
  }

  private parseParamList(): AST.Parameter[] {
    const params: AST.Parameter[] = [];
    while (!this.check(TokenType.RightParen) && !this.check(TokenType.Pipe) && !this.isAtEnd()) {
      params.push(this.parseParameter());
      this.match(TokenType.Comma);
    }
    return params;
  }

  private parseParameter(): AST.Parameter {
    const start = this.currentToken();
    const name = this.expectName().value;
    this.expect(TokenType.Colon);
    const type = this.parseTypeAnnotation();
    let def: AST.Expression | undefined;
    if (this.check(TokenType.Assign)) {
      this.advance();
      def = this.parseExpression();
    }
    return {
      kind: 'Parameter',
      name,
      type,
      default: def,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // --- Token navigation ---

  private currentToken(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
  }

  private prevToken(): Token {
    return this.tokens[Math.max(0, this.pos - 1)];
  }

  private peekNext(): Token | undefined {
    return this.tokens[this.pos + 1];
  }

  private peekNextIs(type: TokenType): boolean {
    const next = this.tokens[this.pos + 1];
    return next !== undefined && next.type === type;
  }

  private advance(): Token {
    const token = this.currentToken();
    this.pos++;
    return token;
  }

  private check(type: TokenType): boolean {
    return this.currentToken().type === type;
  }

  private checkValue(value: string): boolean {
    return this.currentToken().value === value;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    if (this.check(type)) return this.advance();
    const token = this.currentToken();
    throw this.error(`Expected ${type}, got ${token.type} ('${token.value}')`, token);
  }

  /**
   * Accept a token as an identifier name.
   * Many keywords (from, test, token, init, etc.) are valid in identifier
   * positions such as field names, function names, variable names, etc.
   * Only structural keywords that start blocks (if, for, while, etc.)
   * are excluded.
   */
  private expectName(): Token {
    const t = this.currentToken();
    if (t.type === TokenType.Identifier) return this.advance();
    // Structural keywords that CANNOT be names
    const disallowed = new Set<TokenType>([
      TokenType.If, TokenType.Else, TokenType.For, TokenType.While,
      TokenType.Loop, TokenType.Break, TokenType.Continue, TokenType.Return,
      TokenType.Let, TokenType.Const, TokenType.Fn, TokenType.Pub,
      TokenType.Struct, TokenType.Enum, TokenType.Impl, TokenType.Trait,
      TokenType.Type, TokenType.Match, TokenType.Program, TokenType.Import,
      TokenType.Use, TokenType.True, TokenType.False, TokenType.Null,
    ]);
    // Accept any keyword that is not structurally disallowed
    if (typeof t.type === 'string' && !disallowed.has(t.type)) {
      return this.advance();
    }
    throw this.error(`Expected Identifier, got ${t.type} ('${t.value}')`, t);
  }

  private isAtEnd(): boolean {
    return this.currentToken().type === TokenType.EOF;
  }

  private error(message: string, token: Token): PurpError {
    return new PurpError(
      ErrorCode.ParseError,
      message,
      token.span.start,
      this.file,
    );
  }

  /**
   * Panic-mode error recovery: skip tokens until we find a synchronization
   * point — either a semicolon, a closing brace, or a keyword that can
   * start a new top-level declaration.
   */
  private synchronize(): void {
    this.panicMode = true;
    // Always advance at least one token to guarantee forward progress
    if (!this.isAtEnd()) this.advance();

    const syncTokens = new Set([
      TokenType.Program, TokenType.Instruction, TokenType.Account,
      TokenType.Struct, TokenType.Enum, TokenType.Fn, TokenType.Pub,
      TokenType.Event, TokenType.Error, TokenType.Import, TokenType.Use,
      TokenType.Const, TokenType.Type, TokenType.Impl, TokenType.Trait,
      TokenType.Client, TokenType.Frontend, TokenType.Config, TokenType.Test,
      TokenType.State, TokenType.Async,
    ]);

    while (!this.isAtEnd()) {
      // If previous token was ; or }, we're at a statement boundary
      const prev = this.tokens[this.pos - 1];
      if (prev && (prev.type === TokenType.Semicolon || prev.type === TokenType.RightBrace)) {
        return;
      }
      // If current token starts a new declaration, stop here
      if (syncTokens.has(this.currentToken().type)) {
        return;
      }
      this.advance();
    }
  }
}

// Helper for template string interpolation
function await_import_lexer(): { Lexer: typeof import('../lexer/index.js').Lexer } {
  // Use dynamic require-like pattern to avoid circular import at top level
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../lexer/index.js') as any;
}
