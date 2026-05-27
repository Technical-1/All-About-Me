# Project Q&A

## Overview

This repository is my coursework portfolio from **AP Computer Science A**, taken in person at **Marjory Stoneman Douglas High School** in Parkland, FL during my junior year of high school in the 2019-2020 school year. AP CS A is an introductory college-level Java course administered by the College Board, ending in a national AP exam — and at MSD the curriculum was delivered as eight progressive modules over a full school year, with one major programming assignment per module. This repo holds those eight modules' graded deliverables plus a Special Projects entry.

It's a collection of around two dozen small Java programs that walk a beginner from `System.out.println` up to multi-class object-oriented design. The interesting thing about the repo, framed as a portfolio entry, is that it preserves the pedagogical progression intact — you can read the modules in order and watch the same problem domains get re-solved with better tools (parallel arrays in Module 06 becoming a `Weather` class in Module 08).

## Course Details

- **Class**: AP Computer Science A
- **School**: Marjory Stoneman Douglas High School, Parkland, Florida (in-person classroom course)
- **Year taken**: 2019-2020 school year (my 11th-grade junior year)
- **Format**: Year-long in-classroom elective, eight progressive curriculum modules with one major programming assignment per module
- **Language**: Java — the College Board's official AP CS A language
- **Outcome**: College Board AP Computer Science A exam, May 2020

## Problem Solved

The College Board AP CS A curriculum is a syllabus, not a textbook — students need a working portfolio of programs that demonstrate mastery of each language feature in isolation, then integrated together. This repo is that portfolio: every required topic (primitives, strings, conditionals, loops, file I/O, arrays, methods, classes) has at least one program that exercises it end-to-end.

## Target Users

- **Me, looking back at fundamentals** — When I revisit a Java concept, this repo is the artifact that says "yes, you've written this from scratch before"
- **Hiring managers reading my portfolio** — a credible "where I started" reference point that pairs with my more recent work
- **CS students working through AP CS A** — a public reference for what passing solutions to the standard AP CS A module assignments look like (not for copying — for sanity-checking your own approach)

## Key Features

### Eight-module curriculum coverage
Every module directory targets one core language feature. `Module 04` is the first one to ship real branching logic; `Module 05` is the first with file I/O; `Module 08` is the first with custom classes. Reading the modules in order is reading my year of Java acquisition in order.

### Two genuinely substantial programs
Most modules contain warm-up exercises, but two deserve being called out:
- **`Module 06/HurricaneSelector.java`** — 187 lines that load 156 rows of NOAA Atlantic hurricane data into parallel arrays, accept a user-chosen year range (validated against `[1995, 2015]`), recompute every hurricane's Saffir-Simpson category from wind-speed bins, and emit a per-year report plus min/max/average and per-category counts to both stdout and `hurricanesummary.txt`
- **`Module 05/AnimalPopulation.java`** — A Monte Carlo simulation that requires user-provided trial counts (validated `>= 1000`) and reports the average number of animals observed before the target species appears

### Object-oriented evolution in Module 08
The `Square` class appears in three versions in the same directory: `SquareV3` (default constructor only), `SquareV7` (parameterized constructor plus an external tester), and `SquareV8` (the V7 design extended to support an array of objects with min/max/avg aggregation). Reading those three files back-to-back is a short course in "why we add constructors and why we separate testers."

## Technical Highlights

### `buyMovieTickets.java` — string masking via `indexOf` chains
Module 03's biggest program prompts for a debit card formatted `#####-###-####` and prints a receipt with the leading digits masked. The masking is done by chaining `indexOf("-", indexOfFirstDash + 1)` to locate the second dash, slicing the string around it, and running `replaceAll("[1234567890]", "#")` on only the first half (`buyMovieTickets.java:49-55`). This is the first program in the repo that does non-trivial string surgery, and the pattern of "split at a known delimiter, transform one half, recombine" reappears in many later string-processing contexts.

### `HurricaneSelector.java` — parallel arrays with derived columns
Five same-length arrays (`years[]`, `months[]`, `pressures[]`, `windSpeeds[]`, `names[]`) hold the source data, and a sixth derived array `cat[]` is computed by classifying each row's wind speed against the Saffir-Simpson scale before the main filter loop runs (`HurricaneSelector.java:77-94`). This pre-computation pass is more efficient than recomputing categories inside the filter loop — a small algorithmic decision that prefigures the "compute once, reuse across passes" instinct that shows up in real codebases.

### `PlanetGravity.java` — first use of helper methods
Module 07 is where I started extracting reusable logic. `surfaceGravity(double dia, double mass)` (lines 37-40) computes `g = GM/r²` and returns a `double`; `tablePrint(...)` (lines 43-45) wraps the `printf` format string so the main loop reads as `tablePrint(planets[i], diameter[i], mass[i], surfaceGravity(...))`. Before Module 07 every program was a single linear `main` — this is the first one that reads like decomposed engineering.

### `SquareV8.java` + `V8Tester.java` — array of objects, aggregate statistics
The Module 08 capstone instantiates `SquareV8[] squares = { new SquareV8(...), new SquareV8(...), ... }` and iterates the array twice: once to compute per-square areas/volumes and find min/max, then once more to accumulate the sums for averages (`V8Tester.java:32-66`). It's the first time in the repo that data and behavior travel together as objects, and the running-min/max pattern carries forward into every later Java project that touches a collection.

## Engineering Decisions

### Standalone classes over a shared package
- **Constraint**: Each module assignment had to be runnable on the teacher's grading machine with `javac File.java && java File` and nothing else
- **Options**: (a) ship every program in a `com.jacob.apcsa` package with a build file, (b) keep every file unpackaged at the top of its module's `src/`
- **Choice**: Option (b) — no packages, no build file
- **Why**: Setup cost matters more than code reuse here. The grader doesn't care that `Module 03/GradesV3.java` reimplements parts of `Module 02/GradesV2.java`; they care that each one runs in isolation. Zero shared state means zero risk of cross-module breakage.

### Hard-coded data file paths
- **Constraint**: Programs like `HurricaneSelector` and `Family` need to read text files at runtime
- **Options**: (a) take the filename as a command-line argument, (b) prompt the user for it via `Scanner`, (c) hard-code `new File("HurricaneData.txt")` and require the user to `cd` to the right directory
- **Choice**: Option (c)
- **Why**: That's the convention the assignment rubric grades against — the grader places the data file in the working directory and runs the program. In retrospect, command-line arguments would have been more idiomatic, but the assignment was explicit about the filename and pulling it out of code would have been over-engineering for the rubric.

### Implementation/Tester split in Module 08
- **Constraint**: The module rubric requires a "client" class separate from the "implementation" class
- **Options**: (a) one file with the class and its `main` together, (b) two files — `SquareV8.java` for the class, `V8Tester.java` for the driver
- **Choice**: Option (b) — split into pairs
- **Why**: This is the right call independent of the rubric. The class shouldn't know it's being tested, and the tester shouldn't know the class's private fields. Adopting this discipline in Module 08 means I never had to unlearn the bad habit of `public static void main` inside a domain class.

### `throws FileNotFoundException` instead of try/catch
- **Constraint**: File-reading programs in Modules 05-07 need to handle the case where the input file is missing
- **Options**: (a) try/catch around `new Scanner(File)` with a graceful error message, (b) declare `throws FileNotFoundException` on `main` and let the JVM print the stack trace
- **Choice**: Option (b) — propagate up
- **Why**: The curriculum hasn't introduced exception handling at that point, so try/catch would have been an unexplained idiom. Letting `main` throw is the honest "I know this can fail, the JVM's default handling is acceptable for now" posture — and it's the same trade-off real Java programs make for non-recoverable startup errors.

## Frequently Asked Questions

### What class is this from, exactly?
**AP Computer Science A**, the College Board's introductory college-credit Java course. I took it as a year-long in-person elective at Marjory Stoneman Douglas High School in Parkland, Florida during the 2019-2020 school year (my junior year). The course was delivered as eight progressive curriculum modules — one per directory in this repo — with a major programming assignment due at the end of each module. The Special Projects directory holds an extra-credit assignment from the same class.

### Was this all classroom work, or did you take it online?
In-person at MSD for most of the year. Module 08 was the exception: in March 2020 the school went remote because of the COVID-19 pandemic, so the final module was completed and submitted from home. The `.java.txt` filenames in `Module 08/src/` are an artifact of that — see the FAQ further down on why those exist.

### Why is this repo public if it's old high-school work?
Because the trajectory matters more than the polish. A portfolio that only shows finished, recent work hides the part of the story that actually proves I built up from fundamentals — `print` statements, `Scanner`, primitive types, conditionals, arrays. This repo is the fundamentals, with dates and commit history intact to prove it's contemporaneous junior-year work and not retroactive cleanup.

### Where are the data files for `HurricaneSelector` and `Family`?
They were assignment-provided text files that aren't tracked in this repo. `HurricaneSelector` expects `HurricaneData.txt` (156 rows of `year month pressure windspeed name`) and `Family` expects `maleFemaleInFamily.txt` (whitespace-separated `BB`/`GG`/`BG` tokens). The programs will throw `FileNotFoundException` and exit if you run them without those files in the working directory.

### Why are some files named `.java.txt` in Module 08?
Those are the four Module 08 programs I submitted after MSD went remote in March 2020 in the early weeks of the COVID-19 lockdown. The class submission portal rejected `.java` uploads, so I appended `.txt` to get them through. The contents are still valid Java — rename them back to `.java` to compile. I left the original filenames intact so the git history reflects how the work was actually submitted.

### Are there bugs in the code?
Yes, a few I'd fix today rather than then:
- `SquareV8.java` lines 58 and 62 — both `setWidth` and `setHeight` mistakenly assign to the `length` field. The class compiles and the tester never calls those setters, so the bug was latent. A real test would have caught it.
- `KinematicsImplementation.java.txt` line 14 — `theta = launchAngle;` is the wrong direction (it should be `launchAngle = theta;`). Same root cause: no tests, and the tester didn't exercise the constructor's effect on `launchAngle`.

I'm intentionally not patching these in-place because the commit history and dates document the work as it was submitted. They're listed here because self-awareness about your own old code is worth more on a portfolio than pretending the code was perfect.

### Why no JUnit tests?
The curriculum didn't cover testing frameworks — Module 08's "Tester" classes are drivers, not test suites. Adding JUnit retroactively would have been the right learning move but would also have meant rewriting half the codebase against a framework that wasn't part of AP CS A. Keeping the code as-shipped preserved the historical record.

### What would I do differently now?
Three things: (1) extract a `writeBoth(PrintWriter, String, Object...)` helper in `HurricaneSelector` so the format strings don't appear twice. (2) Replace the parallel-arrays pattern with a small `Hurricane` record now that Java has records. (3) Add a tiny JUnit suite to Module 08 that catches the `SquareV8` setter bug.
