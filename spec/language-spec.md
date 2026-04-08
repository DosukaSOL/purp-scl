# Purp SCL — Language Specification v0.1.0

## 1. Introduction

Purp is a statically-typed, compiled programming language designed for the Solana blockchain. Source files use the `.purp` extension.

Purp compiles to:
- Pinocchio-powered Rust (for on-chain deployment)
- TypeScript (for client SDK generation)

## 2. Lexical Structure

### 2.1 Character Set
Purp source files are UTF-8 encoded.

### 2.2 Whitespace
Spaces, tabs, and newlines are ignored except as token separators. Indentation is not significant.

### 2.3 Comments
```
// Single-line comment (to end of line)
/* Multi-line comment (can span multiple lines) */
```

### 2.4 Identifiers
An identifier starts with a letter (a-z, A-Z) or underscore (_), followed by zero or more letters, digits (0-9), or underscores.

```
identifier = [a-zA-Z_][a-zA-Z0-9_]*
```

### 2.5 Keywords
Reserved words that cannot be used as identifiers:

```
program    instruction  account    signer    pub
fn         let          mut        const     if
else       for          while      match     return
import     from         struct     enum      impl
trait      type         as         in        true
false      null         event      error     emit
assert     client       frontend   config    page
component  state        render     style     on_mount
async      await        PDA        CPI       token
mint       NFT          spl
```

### 2.6 Literals

#### Integer Literals
```
42        // decimal
0xFF      // hexadecimal
0b1010    // binary
0o77      // octal
1_000_000 // with separators
```

#### Float Literals
```
3.14
0.5
1.0e10
```

#### String Literals
```
"hello world"
"line with \"escapes\""
"tab\there"
```

#### Boolean Literals
```
true
false
```

#### Null Literal
```
null
```

### 2.7 Operators

| Precedence | Operators | Associativity |
|---|---|---|
| 1 (highest) | `!` `-` (unary) | Right |
| 2 | `as` | Left |
| 3 | `*` `/` `%` | Left |
| 4 | `+` `-` | Left |
| 5 | `<<` `>>` | Left |
| 6 | `&` | Left |
| 7 | `^` | Left |
| 8 | `\|` | Left |
| 9 | `==` `!=` `<` `<=` `>` `>=` | Left |
| 10 | `&&` | Left |
| 11 (lowest) | `\|\|` | Left |

### 2.8 Delimiters
```
{  }    // Block
(  )    // Grouping, function parameters
[  ]    // Array
,       // Separator
;       // Statement terminator (optional in most contexts)
:       // Type annotation
.       // Member access
::      // Path separator
=>      // Match arm
->      // Return type (alternative)
#[...]  // Attribute
```

## 3. Types

### 3.1 Primitive Types
| Type | Description | Rust Equivalent |
|---|---|---|
| `u8` | Unsigned 8-bit | `u8` |
| `u16` | Unsigned 16-bit | `u16` |
| `u32` | Unsigned 32-bit | `u32` |
| `u64` | Unsigned 64-bit | `u64` |
| `u128` | Unsigned 128-bit | `u128` |
| `i8` | Signed 8-bit | `i8` |
| `i16` | Signed 16-bit | `i16` |
| `i32` | Signed 32-bit | `i32` |
| `i64` | Signed 64-bit | `i64` |
| `i128` | Signed 128-bit | `i128` |
| `f32` | 32-bit float | `f32` |
| `f64` | 64-bit float | `f64` |
| `bool` | Boolean | `bool` |
| `string` | UTF-8 string | `String` |
| `pubkey` | Solana public key | `Pubkey` |
| `bytes` | Byte array | `Vec<u8>` |

### 3.2 Composite Types
```
// Array
let items: u64[] = [1, 2, 3];

// Optional
let name: string? = null;
```

### 3.3 User-Defined Types
```
struct Point { x: f64, y: f64 }
enum Direction { North, South, East, West }
type Balance = u64;
```

## 4. Declarations

### 4.1 Program Declaration
```
program <Name> {
  <member>*
}
```
A program is the top-level container. Members can be: accounts, instructions, events, errors, functions, constants.

### 4.2 Account Declaration
```
account <Name> {
  <field_name>: <type>,
  ...
}
```
Accounts define on-chain data structures. Each account compiles to a Rust struct with `#[account]`.

### 4.3 Instruction Declaration
```
[pub] instruction <name>(
  <params>
) {
  <statements>
}
```

Parameter attributes:
- `signer` — must sign the transaction
- `#[mut]` — mutable
- `#[init]` — initialize (create) the account
- `account` — read-only reference

### 4.4 Event Declaration
```
event <Name> { <fields> }
```

### 4.5 Error Declaration
```
error <Name> = "<message>"
```

### 4.6 Function Declaration
```
[pub] fn <name>(<params>): <return_type> {
  <statements>
}
```

### 4.7 Struct Declaration
```
struct <Name> {
  <field_name>: <type>,
  ...
}
```

### 4.8 Enum Declaration
```
enum <Name> {
  <Variant>,
  ...
}
```

### 4.9 Import Declaration
```
import { <names> } from "<path>";
```

### 4.10 Constant Declaration
```
const <NAME>: <type> = <value>;
```

### 4.11 Type Alias
```
type <Name> = <type>;
```

## 5. Statements

### 5.1 Variable Declaration
```
let <name>[: <type>] = <expression>;
let mut <name>[: <type>] = <expression>;
```

### 5.2 Assignment
```
<target> = <expression>;
<target> += <expression>;
<target> -= <expression>;
<target> *= <expression>;
<target> /= <expression>;
```

### 5.3 If Statement
```
if <condition> {
  <statements>
} [else if <condition> {
  <statements>
}]* [else {
  <statements>
}]
```

### 5.4 For Statement
```
for <name> in <expression> {
  <statements>
}
```

### 5.5 While Statement
```
while <condition> {
  <statements>
}
```

### 5.6 Match Statement
```
match <expression> {
  <pattern> => { <statements> },
  ...
}
```

### 5.7 Return Statement
```
return [<expression>];
```

### 5.8 Emit Statement
```
emit <EventName>(<args>);
```

### 5.9 Assert Statement
```
assert(<condition>, "<message>");
```

## 6. Expressions

### 6.1 Binary Expressions
```
<expr> <op> <expr>
```

### 6.2 Unary Expressions
```
!<expr>
-<expr>
```

### 6.3 Call Expressions
```
<name>(<args>)
<expr>.<method>(<args>)
```

### 6.4 Member Access
```
<expr>.<field>
<expr>::<variant>
```

### 6.5 Array Literal
```
[<expr>, <expr>, ...]
```

### 6.6 Cast Expression
```
<expr> as <type>
```

### 6.7 Await Expression
```
await <expr>
```

## 7. Client Block

```
client {
  [async] fn <name>(<params>)[: <return_type>] {
    <statements>
  }
}
```

Client blocks define TypeScript SDK methods generated alongside the program.

## 8. Frontend Block

```
frontend {
  page "<path>" {
    component <Name>[(<props>)] {
      [state <name> = <value>;]*
      [on_mount { <statements> }]
      render {
        <JSX-like markup>
      }
    }
  }
  [style { <CSS-like declarations> }]
}
```

## 9. Config Block

```
config {
  <key> = <value>
  ...
}
```

## 10. Compilation

### 10.1 Pipeline
```
Source (.purp) → Lexer → Parser → AST → Semantic Analysis → Codegen
```

### 10.2 Rust Output
- Program declarations → `#[program]` module
- Instructions → handler functions with Context structs
- Accounts → `#[account]` structs
- Events → `#[event]` structs
- Errors → `#[error_code]` enum

### 10.3 TypeScript Output
- Program → Client class
- Instructions → async methods
- Accounts → TypeScript interfaces
- Events → TypeScript types
