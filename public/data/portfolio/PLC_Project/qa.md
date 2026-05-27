# Project Q&A Knowledge Base

## Overview

PLC (Programming Language Compiler) is a complete compiler implementation built in Java that takes source code through lexical analysis, parsing, semantic analysis, and produces either interpreted output or compiled Java code. The project demonstrates fundamental compiler construction techniques including recursive descent parsing, type checking, and code generation.

## Key Features

- **5-Stage Pipeline**: Complete lexer → parser → analyzer → interpreter/generator flow
- **Static Type System**: Type checking with 7 primitive types that map to JVM equivalents
- **Dual Execution Modes**: Direct interpretation or Java source code generation
- **Lexical Scoping**: Parent-chained scopes for proper variable resolution
- **Comprehensive Operators**: Arithmetic, comparison, and logical operators with proper precedence

## Technical Highlights

### Hand-Written Lexer with Regex Lookahead
The lexer uses a `CharStream` class that enables `peek` and `match` operations with regex patterns. This allows clean tokenization logic like:
```java
if (peek("[A-Za-z_]")) {
    return lexIdentifier();
} else if (peek("[0-9]")) {
    return lexNumber();
}
```
Each token type has its own dedicated method, making the lexer maintainable and easy to extend.

### Recursive Descent Parser with Precedence Climbing
The parser implements operator precedence through a chain of methods:
- `parseLogicalExpression` → `&&`, `||`
- `parseEqualityExpression` → `<`, `>`, `<=`, `>=`, `==`, `!=`
- `parseAdditiveExpression` → `+`, `-`
- `parseMultiplicativeExpression` → `*`, `/`

Each level calls the next-higher precedence level, naturally encoding the grammar's associativity rules.

### Visitor Pattern for Multi-Pass Processing
The `Ast.Visitor<T>` interface allows the same AST to be processed differently:
- `Analyzer` returns `Void` and annotates nodes with type information
- `Interpreter` returns `PlcObject` for runtime values
- `Generator` returns `Void` and emits Java source code

This separation of concerns means adding new operations (like optimization passes) requires no changes to the AST classes.

### Exception-Based Return Handling
The interpreter uses a clever pattern for handling `return` statements:
```java
private static class Return extends RuntimeException {
    private final Environment.PlcObject value;
}
```
This allows return values to cleanly unwind through nested statement execution without complex control flow.

## Development Story

- **Context**: Academic compiler construction project
- **Hardest Part**: Getting the type system right—ensuring proper type compatibility checking and making the analyzer correctly link symbols to their declarations
- **Lessons Learned**: The importance of separating concerns; having distinct phases (lexing, parsing, analysis) makes debugging much easier than a monolithic approach
- **Future Plans**: Could extend with additional types (arrays, structs), optimization passes, or alternative code generation targets

## Frequently Asked Questions

### How does the lexer handle escape sequences?
The `lexEscape()` method validates escape characters after a backslash. Valid escapes are `\b`, `\n`, `\r`, `\t`, `\'`, `\"`, and `\\`. Invalid escapes throw a `ParseException` with the exact character index.

### Why use BigInteger and BigDecimal in the interpreter?
The interpreter uses arbitrary-precision numbers internally to avoid overflow during computation. The analyzer validates that literals fit within Java's `int` and `double` ranges, but the interpreter can handle intermediate results that temporarily exceed these bounds.

### How does the scope chain work?
Each `Scope` has a reference to its parent. When looking up a variable, the scope first checks its own definitions, then delegates to its parent. This continues until the root scope (with `null` parent) is reached. If not found, a runtime exception is thrown.

### How does the generator handle the main entry point?
The generator wraps all output in a `Main` class with a static `main(String[] args)` method that calls `System.exit(new Main().main())`. This bridges between Java's entry point convention and the PLC language's `main()` function.

### What happens if a program doesn't have a main function?
The analyzer checks for a `main` function with 0 parameters and an Integer return type. If missing or incorrectly typed, analysis fails with "No main defined" or "Main must have int return type".

### How are method calls with receivers handled?
For expressions like `obj.method(args)`, the receiver is evaluated first, then its type is used to look up the method. The interpreter calls `PlcObject.callMethod()`, which prepends the receiver to the argument list (making it available as `this`).

### Why does the Group expression require a Binary expression inside?
The analyzer enforces that parenthesized expressions must contain binary operations. This is a design choice to prevent unnecessary grouping of simple expressions and ensures parentheses are only used where they affect evaluation order.

### How does code generation handle for-loop semicolons?
The generator uses an `appendSemicolon` flag that it temporarily sets to `false` when visiting the initialization and increment parts of a for-loop, since these appear inline within the for-loop header rather than as standalone statements.
