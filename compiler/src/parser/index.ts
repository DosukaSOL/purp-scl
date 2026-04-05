// ============================================================================
// Purp Parser — The Solana Coding Language
// Parses token stream into AST
// ============================================================================

import { Token, TokenType } from '../lexer/tokens.js';
import * as AST from '../ast/index.js';
import { PurpError, ErrorCode } from '../errors/index.js';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private file: string;

  constructor(tokens: Token[], file: string = '<stdin>') {
    this.tokens = tokens.filter(t => t.type !== TokenType.Newline && t.type !== TokenType.Comment && t.type !== TokenType.DocComment);
    this.file = file;
  }

  parse(): AST.ProgramNode {
    const body: AST.TopLevelNode[] = [];
    while (!this.isAtEnd()) {
      const node = this.parseTopLevel();
      if (node) body.push(node);
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

  // === Top Level ===

  private parseTopLevel(): AST.TopLevelNode {
    const token = this.currentToken();

    switch (token.type) {
      case TokenType.Program: return this.parseProgramDeclaration();
      case TokenType.Instruction: return this.parseInstructionDeclaration('private');
      case TokenType.Account: return this.parseAccountDeclaration();
      case TokenType.Struct: return this.parseStructDeclaration('private');
      case TokenType.Enum: return this.parseEnumDeclaration('private');
      case TokenType.Fn: return this.parseFunctionDeclaration('private', false);
      case TokenType.Async: return this.parseFunctionDeclaration('private', true);
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
      case TokenType.Pub: {
        this.advance();
        const next = this.currentToken();
        switch (next.type) {
          case TokenType.Instruction: return this.parseInstructionDeclaration('pub');
          case TokenType.Struct: return this.parseStructDeclaration('pub');
          case TokenType.Enum: return this.parseEnumDeclaration('pub');
          case TokenType.Fn: return this.parseFunctionDeclaration('pub', false);
          case TokenType.Async: return this.parseFunctionDeclaration('pub', true);
          case TokenType.Const: return this.parseConstDeclaration('pub');
          default:
            throw this.error(`Unexpected token after 'pub': ${next.type}`, next);
        }
      }
      default:
        throw this.error(`Unexpected top-level token: ${token.type} (${token.value})`, token);
    }
  }

  // === Program Declaration ===

  private parseProgramDeclaration(): AST.ProgramDeclaration {
    const start = this.expect(TokenType.Program);
    const name = this.expect(TokenType.Identifier).value;
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

  // === Instruction ===

  private parseInstructionDeclaration(visibility: 'pub' | 'private'): AST.InstructionDeclaration {
    const start = this.expect(TokenType.Instruction);
    const name = this.expect(TokenType.Identifier).value;
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
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  private parseInstructionParams(): { accounts: AST.AccountParam[]; params: AST.Parameter[] } {
    const accounts: AST.AccountParam[] = [];
    const params: AST.Parameter[] = [];

    while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
      if (this.check(TokenType.Signer) || this.check(TokenType.Account) || this.check(TokenType.Mint) || this.check(TokenType.Token) || this.check(TokenType.PDA)) {
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

  private parseAccountParam(): AST.AccountParam {
    const start = this.currentToken();
    const constraints: AST.AccountConstraint[] = [];
    let mutable = false;

    // Check for #[...] attributes
    while (this.check(TokenType.Hash)) {
      this.advance();
      this.expect(TokenType.LeftBracket);
      while (!this.check(TokenType.RightBracket)) {
        const attrName = this.expect(TokenType.Identifier).value;
        if (attrName === 'mut') mutable = true;
        constraints.push({ kind: attrName as any });
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
      case TokenType.PDA:
        accountType = { kind: 'PDA', seeds: [], mutable };
        break;
      default:
        accountType = { kind: 'Account', type: typeToken.value, mutable };
    }

    const name = this.expect(TokenType.Identifier).value;

    return {
      kind: 'AccountParam',
      name,
      accountType,
      constraints,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // === Account Declaration ===

  private parseAccountDeclaration(): AST.AccountDeclaration {
    const start = this.expect(TokenType.Account);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.LeftBrace);
    const fields = this.parseFields();
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'AccountDeclaration',
      name,
      fields,
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // === Struct ===

  private parseStructDeclaration(visibility: 'pub' | 'private'): AST.StructDeclaration {
    const start = this.expect(TokenType.Struct);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.LeftBrace);
    const fields = this.parseFields();
    const end = this.expect(TokenType.RightBrace);
    return {
      kind: 'StructDeclaration',
      name,
      fields,
      visibility,
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // === Enum ===

  private parseEnumDeclaration(visibility: 'pub' | 'private'): AST.EnumDeclaration {
    const start = this.expect(TokenType.Enum);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.LeftBrace);
    const variants: AST.EnumVariant[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const vStart = this.currentToken();
      const vName = this.expect(TokenType.Identifier).value;
      let fields: AST.FieldDeclaration[] | undefined;
      if (this.check(TokenType.LeftBrace)) {
        this.advance();
        fields = this.parseFields();
        this.expect(TokenType.RightBrace);
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
      span: { start: start.span.start, end: end.span.end },
    };
  }

  // === Function ===

  private parseFunctionDeclaration(visibility: 'pub' | 'private', isAsync: boolean): AST.FunctionDeclaration {
    if (isAsync) this.expect(TokenType.Async);
    const start = this.expect(TokenType.Fn);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.LeftParen);
    const params = this.parseParamList();
    this.expect(TokenType.RightParen);
    let returnType: AST.TypeAnnotation | undefined;
    if (this.check(TokenType.Arrow)) {
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
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // === Event ===

  private parseEventDeclaration(): AST.EventDeclaration {
    const start = this.expect(TokenType.Event);
    const name = this.expect(TokenType.Identifier).value;
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

  // === Error ===

  private parseErrorDeclaration(): AST.ErrorDeclaration {
    const start = this.expect(TokenType.Error);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.LeftBrace);
    const variants: AST.ErrorVariant[] = [];
    let code = 6000;
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const vStart = this.currentToken();
      const vName = this.expect(TokenType.Identifier).value;
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

  // === Import ===

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
        const name = this.expect(TokenType.Identifier).value;
        let alias: string | undefined;
        if (this.check(TokenType.As)) {
          this.advance();
          alias = this.expect(TokenType.Identifier).value;
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

  // === Const ===

  private parseConstDeclaration(visibility: 'pub' | 'private'): AST.ConstDeclaration {
    const start = this.expect(TokenType.Const);
    const name = this.expect(TokenType.Identifier).value;
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

  // === Type Alias ===

  private parseTypeAlias(): AST.TypeAlias {
    const start = this.expect(TokenType.Type);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.Assign);
    const type = this.parseTypeAnnotation();
    this.match(TokenType.Semicolon);
    return {
      kind: 'TypeAlias',
      name,
      type,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // === Impl ===

  private parseImplBlock(): AST.ImplBlock {
    const start = this.expect(TokenType.Impl);
    const target = this.expect(TokenType.Identifier).value;
    let trait: string | undefined;
    if (this.check(TokenType.For)) {
      trait = target;
      this.advance();
    }
    this.expect(TokenType.LeftBrace);
    const methods: AST.FunctionDeclaration[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const vis = this.check(TokenType.Pub) ? (this.advance(), 'pub' as const) : 'private' as const;
      const isAsync = this.check(TokenType.Async);
      methods.push(this.parseFunctionDeclaration(vis, isAsync));
    }
    this.expect(TokenType.RightBrace);
    return {
      kind: 'ImplBlock',
      target,
      trait,
      methods,
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // === Trait ===

  private parseTraitDeclaration(): AST.TraitDeclaration {
    const start = this.expect(TokenType.Trait);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.LeftBrace);
    const methods: AST.FunctionSignature[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const fStart = this.expect(TokenType.Fn);
      const fName = this.expect(TokenType.Identifier).value;
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
      span: { start: start.span.start, end: this.prevToken().span.end },
    };
  }

  // === Client Block ===

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

  // === Frontend Block ===

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

  // === Config Block ===

  private parseConfigBlock(): AST.ConfigBlock {
    const start = this.expect(TokenType.Config);
    this.expect(TokenType.LeftBrace);
    const entries: AST.ConfigEntry[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const key = this.expect(TokenType.Identifier).value;
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

  // ============================================================================
  // Statements
  // ============================================================================

  private parseStatement(): AST.Statement {
    const token = this.currentToken();

    switch (token.type) {
      case TokenType.Let: return this.parseLetStatement();
      case TokenType.Const: return this.parseConstStatement();
      case TokenType.Return: return this.parseReturnStatement();
      case TokenType.If: return this.parseIfStatement();
      case TokenType.Match: return this.parseMatchStatement();
      case TokenType.For: return this.parseForStatement();
      case TokenType.While: return this.parseWhileStatement();
      case TokenType.Loop: return this.parseLoopStatement();
      case TokenType.Break: { this.advance(); return { kind: 'BreakStatement', span: token.span }; }
      case TokenType.Continue: { this.advance(); return { kind: 'ContinueStatement', span: token.span }; }
      case TokenType.Emit: return this.parseEmitStatement();
      default: return this.parseExpressionOrAssignment();
    }
  }

  private parseLetStatement(): AST.LetStatement {
    const start = this.expect(TokenType.Let);
    const mutable = this.match(TokenType.Mut);
    const name = this.expect(TokenType.Identifier).value;
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

  private parseConstStatement(): AST.ConstStatement {
    const start = this.expect(TokenType.Const);
    const name = this.expect(TokenType.Identifier).value;
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

  private parseMatchStatement(): AST.MatchStatement {
    const start = this.expect(TokenType.Match);
    const subject = this.parseExpression();
    this.expect(TokenType.LeftBrace);
    const arms: AST.MatchArm[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const pattern = this.parseExpression();
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

  private parseForStatement(): AST.ForStatement {
    const start = this.expect(TokenType.For);
    const variable = this.expect(TokenType.Identifier).value;
    // expect 'in' (as identifier)
    const inToken = this.expect(TokenType.Identifier);
    if (inToken.value !== 'in') throw this.error("Expected 'in' in for loop", inToken);
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

  private parseEmitStatement(): AST.EmitStatement {
    const start = this.expect(TokenType.Emit);
    const event = this.expect(TokenType.Identifier).value;
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

  private parseExpressionOrAssignment(): AST.Statement {
    const expr = this.parseExpression();
    if (this.check(TokenType.Assign) || this.checkValue('+=') || this.checkValue('-=') || this.checkValue('*=') || this.checkValue('/=')) {
      const op = this.advance().value as '=' | '+=' | '-=' | '*=' | '/=';
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

  // ============================================================================
  // Expressions (Precedence Climbing)
  // ============================================================================

  private parseExpression(): AST.Expression {
    return this.parseOr();
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
    let left = this.parseEquality();
    while (this.check(TokenType.And)) {
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
    let left = this.parseAdditive();
    while (this.check(TokenType.LessThan) || this.check(TokenType.GreaterThan) || this.check(TokenType.LessEqual) || this.check(TokenType.GreaterEqual)) {
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
    return left;
  }

  private parseMultiplicative(): AST.Expression {
    let left = this.parseUnary();
    while (this.check(TokenType.Star) || this.check(TokenType.Slash) || this.check(TokenType.Percent)) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { kind: 'BinaryExpr', operator: op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
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
        const prop = this.expect(TokenType.Identifier).value;
        expr = { kind: 'MemberExpr', object: expr, property: prop, span: { start: expr.span.start, end: this.prevToken().span.end } };
      } else if (this.check(TokenType.LeftBracket)) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RightBracket);
        expr = { kind: 'IndexExpr', object: expr, index, span: { start: expr.span.start, end: this.prevToken().span.end } };
      } else if (this.check(TokenType.ColonColon)) {
        this.advance();
        const prop = this.expect(TokenType.Identifier).value;
        expr = { kind: 'MemberExpr', object: expr, property: prop, span: { start: expr.span.start, end: this.prevToken().span.end } };
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
        // Check for struct init: Name { field: value, ... }
        if (this.check(TokenType.LeftBrace) && this.looksLikeStructInit()) {
          return this.parseStructInit(token);
        }
        return { kind: 'IdentifierExpr', name: token.value, span: token.span };
      }
      case TokenType.LeftParen: {
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.RightParen);
        return expr;
      }
      case TokenType.LeftBracket: {
        this.advance();
        const elements: AST.Expression[] = [];
        while (!this.check(TokenType.RightBracket) && !this.isAtEnd()) {
          elements.push(this.parseExpression());
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

  // --- Struct Init ---

  private looksLikeStructInit(): boolean {
    // Lookahead: { identifier : ...
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
      const fieldName = this.expect(TokenType.Identifier).value;
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

  // --- Lambda ---

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

  // ============================================================================
  // Type Annotations
  // ============================================================================

  private parseTypeAnnotation(): AST.TypeAnnotation {
    const token = this.currentToken();

    // Check for primitive types
    const primitives = ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128', 'f32', 'f64', 'bool', 'string', 'pubkey', 'bytes'];
    if (token.type === TokenType.Identifier && primitives.includes(token.value)) {
      this.advance();
      return {
        kind: 'PrimitiveType',
        name: token.value as AST.PrimitiveType['name'],
        span: token.span,
      };
    }

    // Option type: ?Type
    if (this.check(TokenType.Question)) {
      const start = this.advance();
      const inner = this.parseTypeAnnotation();
      return {
        kind: 'OptionType',
        inner,
        span: { start: start.span.start, end: inner.span.end },
      };
    }

    // Array type: [Type]
    if (this.check(TokenType.LeftBracket)) {
      const start = this.advance();
      const element = this.parseTypeAnnotation();
      let size: number | undefined;
      if (this.check(TokenType.Semicolon)) {
        this.advance();
        size = Number(this.expect(TokenType.Number).value);
      }
      const end = this.expect(TokenType.RightBracket);
      return {
        kind: 'ArrayType',
        element,
        size,
        span: { start: start.span.start, end: end.span.end },
      };
    }

    // Named / Generic type
    if (token.type === TokenType.Identifier) {
      this.advance();
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
      return {
        kind: 'NamedType',
        name: token.value,
        typeArgs,
        span: { start: token.span.start, end: this.prevToken().span.end },
      };
    }

    throw this.error(`Expected type annotation, got ${token.type}`, token);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

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
      const name = this.expect(TokenType.Identifier).value;
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
    const name = this.expect(TokenType.Identifier).value;
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
}
