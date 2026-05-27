# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Java | 17+ | Implementation language with modern features (switch expressions, pattern matching) |
| Build Tool | Gradle | 8.x | Build automation and dependency management (Kotlin DSL) |
| Testing | JUnit 5 | 5.10.0 | Unit and integration testing framework |

## Language Implementation

- **Lexer**: Hand-written character-by-character scanner using regex-based `peek`/`match`
- **Parser**: Recursive descent with explicit precedence climbing
- **Type System**: Static typing with 7 primitive types mapping to JVM types
- **Execution**: Dual-mode (interpreter for direct execution, generator for Java compilation)

## Build System

- **Gradle Kotlin DSL**: `build.gradle.kts` for type-safe build configuration
- **JUnit Platform**: Modern test engine with parameterized test support
- **Standard Layout**: `src/main/java` for sources, `src/test/java` for tests

## Development Tools

- **Package Manager**: Gradle wrapper (`gradlew`) for reproducible builds
- **Testing**: JUnit Jupiter with extensive parameterized tests
- **IDE Support**: IntelliJ IDEA project files included (`.idea/`)

## Project Dependencies

| Package | Purpose |
|---------|---------|
| `org.junit.jupiter:junit-jupiter` | Test framework for unit and integration tests |
| `org.junit:junit-bom:5.10.0` | Bill of materials for consistent JUnit versions |

## Type System Mapping

| PLC Type | Java Type | JVM Name |
|----------|-----------|----------|
| Any | Object | Object |
| Nil | void | Void |
| Boolean | boolean | boolean |
| Integer | int | int |
| Decimal | double | double |
| Character | char | char |
| String | String | String |
| Comparable | Comparable | Comparable |

## Architecture Patterns

- **Visitor Pattern**: `Ast.Visitor<T>` interface for AST traversal
- **Token Stream**: Encapsulated iterator with lookahead for parsing
- **Scope Chain**: Parent-linked scopes for lexical variable resolution
- **Exception Control Flow**: `Return` exception for function return handling
