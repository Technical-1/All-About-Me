# Tech Stack

This is a Java-only repo with no build system and no external dependencies — and that's not by accident, it's by curriculum. The class is **AP Computer Science A**, which I took at Marjory Stoneman Douglas High School in Parkland, FL during the 2019-2020 school year, and the College Board's AP CS A is taught and tested entirely in Java against the standard library. So the "stack" is exactly the stack the AP exam expects: the JDK, `java.util.Scanner`, `java.io.*`, and IntelliJ as the editor my teacher set up the class labs around.

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Java | 8-compatible source | Required by the AP CS A exam — the College Board ships its reference materials in Java |
| IDE | IntelliJ IDEA | Community Edition | Free for students; the editor my AP CS A teacher had us install in the school lab |
| Build | `javac` directly | — | No build system needed; every program has its own `main` and runs standalone |

## Java Standard Library Usage

These are the JDK packages this repo actually depends on. Each is introduced in the module where it's first used:

| Package / class | First used in | Purpose |
|-----------------|---------------|---------|
| `java.lang.System.out` | Module 01 | `print`, `println`, `printf` — all stdout output |
| `java.lang.String` | Module 03 | `indexOf`, `substring`, `replaceAll`, `equalsIgnoreCase` for input parsing and masking |
| `java.lang.Integer` / `Double` | Module 03 | Static `parseInt` / `parseDouble` for converting `Scanner` strings to numbers |
| `java.lang.Math` | Module 04 | `Math.round` (BMI rounding), `Math.pow`, `Math.random` for Monte Carlo / lottery |
| `java.util.Scanner` | Module 03 | Stdin reading; later (Module 05+) used with `Scanner(File)` for text-file input |
| `java.io.File` | Module 05 | File handle for both readers and writers |
| `java.io.FileNotFoundException` | Module 05 | Declared `throws` on `main` — no try/catch (intentionally, per curriculum) |
| `java.io.PrintWriter` | Module 05 | Persisting output to disk (`hurricanesummary.txt`, `planetgravity.txt`, etc.) |
| `java.io.IOException` | Module 06 | Required by `PrintWriter` with `String` filename constructor in `HurricaneSelector` |
| `java.util.ArrayList` | Module 08 | The Module 08 CO2 tester is the only place an `ArrayList<>` appears — everything else uses primitive arrays |

## Frontend

None. Every program is a terminal-only console application.

## Backend

None. Every program runs in a single JVM, takes input from stdin or a local text file, and emits output to stdout (and sometimes a local text file).

## Infrastructure

- **Hosting**: GitHub (public repo)
- **CI/CD**: None
- **Monitoring**: None

## Development Tools

- **Package Manager**: None — JDK is the only dependency
- **Linting**: None
- **Formatting**: IntelliJ defaults
- **Testing**: None — verification is by running each `Tester` class and reading the printed output against the assignment rubric. Module 08's `V7Tester` and `V8Tester` are testers in the colloquial sense (drivers with a `main`), not JUnit tests.

## Project Configuration

- `AP Computer Science A.iml` — IntelliJ module descriptor. Declares the project as a `JAVA_MODULE` with each `Module XX/src/` registered as source roots through IntelliJ's content-root mechanism (the `.idea/` folder).
