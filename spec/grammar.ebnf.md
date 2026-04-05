# Purp SCL — Grammar Specification (EBNF)

## Notation
- `|` = alternative
- `[ ]` = optional
- `{ }` = zero or more
- `( )` = grouping
- `" "` = terminal/keyword

## Top Level

```ebnf
Program       = { TopLevelDecl } ;
TopLevelDecl  = ImportDecl
              | ProgramDecl
              | StructDecl
              | EnumDecl
              | FunctionDecl
              | ConstDecl
              | TypeAlias
              | ImplDecl
              | TraitDecl
              | ClientBlock
              | FrontendBlock
              | ConfigBlock ;
```

## Imports

```ebnf
ImportDecl    = "import" "{" IdentList "}" "from" StringLiteral ";" ;
IdentList     = Identifier { "," Identifier } ;
```

## Program

```ebnf
ProgramDecl   = "program" Identifier "{" { ProgramMember } "}" ;
ProgramMember = AccountDecl
              | InstrDecl
              | EventDecl
              | ErrorDecl
              | FunctionDecl
              | ConstDecl
              | StructDecl
              | EnumDecl
              | ImplDecl
              | ClientBlock
              | FrontendBlock
              | ConfigBlock ;
```

## Accounts

```ebnf
AccountDecl   = "account" Identifier "{" FieldList "}" ;
FieldList     = Field { "," Field } [ "," ] ;
Field         = Identifier ":" TypeExpr ;
```

## Instructions

```ebnf
InstrDecl     = [ "pub" ] "instruction" Identifier "(" ParamList ")" Block ;
ParamList     = [ Param { "," Param } ] ;
Param         = { Attribute } [ "signer" | "account" ] Identifier [ ":" TypeExpr ] ;
Attribute     = "#[" Identifier "]" ;
```

## Events & Errors

```ebnf
EventDecl     = "event" Identifier "{" FieldList "}" ;
ErrorDecl     = "error" Identifier "=" StringLiteral ;
```

## Functions

```ebnf
FunctionDecl  = [ "pub" ] [ "async" ] "fn" Identifier "(" ParamList ")" [ ":" TypeExpr ] Block ;
```

## Structs & Enums

```ebnf
StructDecl    = "struct" Identifier "{" FieldList "}" ;
EnumDecl      = "enum" Identifier "{" VariantList "}" ;
VariantList   = Identifier { "," Identifier } [ "," ] ;
```

## Type System

```ebnf
TypeExpr      = PrimitiveType
              | Identifier
              | TypeExpr "[]"
              | TypeExpr "?"
              | "fn" "(" [ TypeExpr { "," TypeExpr } ] ")" [ ":" TypeExpr ] ;

PrimitiveType = "u8" | "u16" | "u32" | "u64" | "u128"
              | "i8" | "i16" | "i32" | "i64" | "i128"
              | "f32" | "f64"
              | "bool" | "string" | "pubkey" | "bytes" ;
```

## Statements

```ebnf
Block         = "{" { Statement } "}" ;

Statement     = LetStmt
              | ConstStmt
              | AssignStmt
              | IfStmt
              | ForStmt
              | WhileStmt
              | MatchStmt
              | ReturnStmt
              | EmitStmt
              | AssertStmt
              | ExprStmt ;

LetStmt       = "let" [ "mut" ] Identifier [ ":" TypeExpr ] "=" Expr ";" ;
ConstStmt     = "const" Identifier [ ":" TypeExpr ] "=" Expr ";" ;
AssignStmt    = Expr AssignOp Expr ";" ;
AssignOp      = "=" | "+=" | "-=" | "*=" | "/=" ;

IfStmt        = "if" Expr Block { "else" "if" Expr Block } [ "else" Block ] ;
ForStmt       = "for" Identifier "in" Expr Block ;
WhileStmt     = "while" Expr Block ;
MatchStmt     = "match" Expr "{" { MatchArm } "}" ;
MatchArm      = Pattern "=>" ( Block | Expr "," ) ;

ReturnStmt    = "return" [ Expr ] ";" ;
EmitStmt      = "emit" Identifier "(" [ ExprList ] ")" ";" ;
AssertStmt    = "assert" "(" Expr "," StringLiteral ")" ";" ;
ExprStmt      = Expr ";" ;
```

## Expressions

```ebnf
Expr          = UnaryExpr
              | Expr BinOp Expr
              | Expr "as" TypeExpr
              | Expr "." Identifier
              | Expr "::" Identifier
              | Expr "(" [ ExprList ] ")"
              | Expr "[" Expr "]"
              | "await" Expr
              | "(" Expr ")"
              | ArrayLiteral
              | ObjectLiteral
              | Literal
              | Identifier ;

UnaryExpr     = ( "!" | "-" ) Expr ;

BinOp         = "+" | "-" | "*" | "/" | "%"
              | "==" | "!=" | "<" | "<=" | ">" | ">="
              | "&&" | "||"
              | "&" | "|" | "^" | "<<" | ">>" ;

ArrayLiteral  = "[" [ ExprList ] "]" ;
ObjectLiteral = "{" [ FieldInit { "," FieldInit } ] "}" ;
FieldInit     = Identifier ":" Expr ;
ExprList      = Expr { "," Expr } ;

Literal       = IntLiteral | FloatLiteral | StringLiteral | "true" | "false" | "null" ;
```

## Client Block

```ebnf
ClientBlock   = "client" "{" { FunctionDecl } "}" ;
```

## Frontend Block

```ebnf
FrontendBlock = "frontend" "{" { PageDecl } [ StyleDecl ] "}" ;
PageDecl      = "page" StringLiteral "{" { ComponentDecl } "}" ;
ComponentDecl = "component" Identifier [ "(" ParamList ")" ] "{"
                  { StateDecl }
                  [ OnMount ]
                  RenderBlock
                "}" ;
StateDecl     = "state" Identifier "=" Expr ";" ;
OnMount       = "on_mount" Block ;
RenderBlock   = "render" "{" JSXContent "}" ;
StyleDecl     = "style" "{" { StyleRule } "}" ;
```

## JSX (Frontend)

```ebnf
JSXContent    = JSXElement | JSXExpr | JSXText ;
JSXElement    = "<" Identifier { JSXAttr } ">" { JSXContent } "</" Identifier ">"
              | "<" Identifier { JSXAttr } "/>" ;
JSXAttr       = Identifier "=" ( StringLiteral | "{" Expr "}" ) ;
JSXExpr       = "{" Expr "}" ;
JSXText       = StringLiteral ;
```

## Config Block

```ebnf
ConfigBlock   = "config" "{" { ConfigEntry } "}" ;
ConfigEntry   = Identifier "=" ( StringLiteral | IntLiteral | "true" | "false" ) ;
```
