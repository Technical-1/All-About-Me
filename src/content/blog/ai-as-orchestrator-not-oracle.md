---
title: "AI as Orchestrator, Not Oracle"
description: "I built a tax-prep toolkit that uses a language model, and the most important decision was the list of jobs I refused to give it. The model orchestrates; a deterministic Python engine owns every number."
pubDate: 2026-06-23T10:00:00-04:00
tags: ["AI", "LLM", "Python", "Architecture", "Claude"]
---

I built a tax-prep toolkit that uses a language model, and the most important design decision in the whole thing is the list of jobs I refused to give the model.

It can't add. It can't compute a deduction. It never decides what a number is. That sounds backwards for an "AI tool" in 2026, but it's the entire point. A tax return is arithmetic with legal consequences. One hallucinated line is a wrong return. So the model orchestrates, and a boring, deterministic Python engine owns every dollar.

## The product

It's a Claude Code skill. You clone the repo, drop your bank-statement PDFs into a `vault/<year>/` directory, and ask it to prepare your return. Two skills cover the two entity types I support: `prepare-1120` for C-corps and `prepare-schedule-c` for sole props and single-member LLCs. The output is a multi-sheet Excel workbook and a printable PDF, labeled "Tax Preparation Worksheet, Not An Official Tax Return," meant to land on a CPA's desk before anything gets filed.

The skill walks a fixed five-phase flow: find the year's statements, categorize every transaction, review the summary, generate the workbook, then run a pre-flight checklist. Through all of it, the model is a conductor. It decides *when* to run each step and it explains the result in plain English. It does not decide *what the numbers are*.

## Where the seam is

The engine is math and storage. Nothing else. It talks to the outside world through a thin CLI, and the skill drives that CLI through two flags.

`--emit-unmatched` writes the list of transactions the regex rules couldn't categorize out to a JSON file, with no model call at all. The skill reads that JSON, reasons about each unknown merchant ("SQ *BLUE BOTTLE" is almost certainly a coffee expense), and presents the batch to me for confirmation. Only after I say yes does `--apply` append the confirmed rules back to my user rules file. Over a couple of years, that file grows to cover most of my recurring merchants and the next run barely needs me.

Notice what crosses the seam and what doesn't. The model proposes categories and gates confirmations. The model never sees, edits, or produces a computed total. Categorization is fuzzy, human-checkable, and reversible. Arithmetic isn't, so arithmetic stays in Python.

There's a headless path too, for anyone who'd rather live in a terminal or run this in CI. It uses the same subcommands with `ANTHROPIC_API_KEY` set instead of a live session. Same seam, same engine, identical math regardless of who's at the wheel. I only maintain one implementation of the part that matters.

## Where the actual math lives

Every tax-law calculation is a pure function under `forms/y2025/`. Each form module (Form 1120, Form 1125-A, Schedule C, Schedule SE, Form 8829, Form 4562 for depreciation, and the state forms) is a plain function from category totals to a `{line_number: Decimal}` dict. No file I/O, no rendering, no model. Just the mapping from your money to specific IRS line numbers.

The directory name is load-bearing. IRS line numbers and rates change every year, and sometimes lines get renumbered, not just re-priced. When the 2026 forms ship, `y2026/` is a sibling directory: copy, edit, done. The diff between two years' modules is the *only* place tax-law changes live. That's what makes the thing auditable a year from now, when I've forgotten how any of it works.

## Money is `Decimal`, and floats get rejected at the door

Floating-point error is small until it isn't. Spread across thousands of transactions, those rounding crumbs pile up into a cents-off total on a filed return, which is exactly the kind of bug nobody notices until it's a problem.

So every money field is a `Decimal`, and every pydantic money model has a validator that flatly rejects a `float` at construction time. It also rejects `bool`, which looks paranoid until you remember `bool` is an `int` subclass and `Decimal(True) == Decimal(1)` evaluates true, silently. That guard came out of a code review during real-data validation and it's now pinned by a regression test. I'd rather a bad value blow up the instant it's created than show up as a mystery mismatch three steps downstream.

## The one place the model reads raw input

The deterministic parser is built on `pdfplumber` and it only knows the one statement layout the toolkit ships with. Real banks all have their own formats. So instead of guessing, when the parser sees a layout it doesn't recognize, it returns zero transactions and raises a custom `ExtractionNeedsHelp` exception carrying the PDF's path. The CLI catches it and exits with code 3. Not code 1. Code 1 means "I crashed." Code 3 means "I cannot parse this format," and that distinction is a contract.

That exit code is the hand-off seam. Under the skill, code 3 is the cue for the model to read the unparseable PDF directly. Its file reader is multimodal, so it builds the transactions table itself, no API key required. On the headless path, the same exit code triggers the Anthropic SDK in two stages: cheap text mode first, then multimodal PDF if that isn't enough.

Even here, the model is reading, not computing. It turns an unfamiliar PDF into rows of transactions. The moment those rows exist, they flow back into the same deterministic pipeline as everything else, and Python takes the math from there.

## Privacy, because this is real tax data

A tool that touches real returns has to make a leak structurally impossible, not just "be careful." So there are four layers, and any single failure is survivable: aggressive `.gitignore` rules, a `.githooks/pre-commit` hook that scans *staged* content (via `git show :path`, so a clean-staged-but-dirty-working-tree combo still behaves), a `scripts/check_clean.py` scanner for release gating, and the `vault/<year>/` convention as the human contract for where real data goes. The hook even catches EIN-shaped text and filename patterns like `*real-data*`. A gitignore typo or a careless `git add .` shouldn't be enough to put your account numbers on the internet.

## The conviction

Strip away the forms and the depreciation tables and what's left is one rule: the model orchestrates, the engine computes. Every number that lands on a form is traceable to deterministic Python, not to a generation. The workbook even ships a hidden Audit sheet recording the rule provenance for every transaction, so a CPA can answer "why is this $487 PayPal charge in Operating Expenses?" without re-running anything.

I think this is the shape a lot of "AI" tools should have, not just tax ones. Let the model do the fuzzy, judgment-shaped work where being roughly right is fine and a human is in the loop to confirm. Keep it the orchestrator, never the oracle. The minute correctness is non-negotiable, hand the work to something deterministic you can audit line by line. A model is great at deciding *when*. It should never be the thing that decides *what the number is*.
