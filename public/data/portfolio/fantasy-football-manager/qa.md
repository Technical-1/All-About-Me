# Project Q&A

## Overview

Fantasy Football Manager is a daily advisor for a single Sleeper dynasty league. Each morning a scheduled job screens the waiver wire with player-value math, researches only the handful of players worth a closer look, searches for trades both sides would take, checks the week's lineup, and publishes the result to a private site. The interesting part is the discipline around the model: deterministic rules decide what is worth asking about, every paid call is priced and logged on the day's record, and prompt changes are judged on cases the prompt has never seen.

## Problem Solved

A dynasty league rewards small daily decisions: who to pick up, who to drop, when a trade is fair, who to start. Doing that well means reading the wire, the injury news and the value charts every day, across a whole roster. This project does the reading and the arithmetic, then explains its reasoning so the manager can agree or overrule it in a minute.

## Target Users

- **The league's manager** - gets one page each morning with the day's recommended moves, the reasoning behind each, the lineup to set, and any trade worth proposing.
- **A curious leaguemate** - can be given the shared password to browse team pages, standings, values and the trade desk.

## Key Features

### Daily waiver calls with the reasoning shown
Every free agent is scored against the roster's weakest droppable player. The few who clear the bar get researched for news, role and injury context, and each call is published with its sources, the bid to make and the player to drop.

### A trade search that looks from both sides
The job searches for packages that improve both rosters by the league's own values, has the model pick the most plausible ones and explain each, and says plainly when it would advise against a deal it found.

### A lineup board scored by the league's rules
Starters, bench and matchup come straight from Sleeper, projections are scored with the league's actual scoring settings, and on game mornings a review checks late injury news before lock.

### A trade desk and a lineup question box
Two interactive tools let the manager price any package or ask a question about this week's lineup. They share a small daily allowance so a busy afternoon cannot run up a bill.

### Player and team pages with history
Each player has a page with a year of value history and every past call about him. Each team has a scouting page with its lineup, strengths by position and draft picks.

### Cost on the page
Every record carries what its model calls cost, by purpose. The site shows the day's cost and the month to date against a budget.

## Technical Highlights

### Research that is reused until a named trigger fires
The same players tend to clear the screen for several days running, and each research call with web search is expensive. `ffm/core/research_reuse.py` reuses a finalist's answer for up to three days unless a specific trigger fires: a 5% value move, a change in injury or roster status, a new team, a depth chart change, a change in team posture, or a different drop. The record names which calls were reused and from which day. On the first morning this ran alongside prompt caching, the bill fell from about $4.70 to $0.26, with all five research calls reused.

### A build bridge with a size ceiling
The site is built from a growing archive of daily records and a 10 MB value snapshot, none of which can be imported into a browser bundle directly. `scripts/build-data.mjs` emits a main bundle with only the newest day and an index, and writes each day, team and player as its own file. The build then fails if the bundle passes its ceiling or if any of those files was pulled into the main chunk, so the mistake that once broke deploys cannot recur quietly.

### Spending guards with two counters
The trade analyzer in `server/analyzer/handler.ts` reserves a slot against a daily cap before calling the model and refunds it on failure. That alone would not bound spend, because a failed call can still be billed, so a second ceiling counts every billed attempt. A lock makes requests one at a time, a stored result is re-read under the lock so a double click is free, and there are no retries.

### Testing the wiring, not just the function
A guard that is correct in isolation protects nothing if its call site is missing. For each guard in the job and the functions, the test suite includes a test that fails when the line calling the guard is deleted, and a model-based harness drives the real job through tens of thousands of multi-day fault histories to check that every billed call lands on exactly one record.

## Engineering Decisions

### Rules decide what the model sees
- **Constraint**: Hundreds of free agents, and a per-call cost that makes asking about all of them unreasonable.
- **Options**: Send the whole pool to the model; pre-filter with a cheaper model; pre-filter with deterministic math.
- **Choice**: Deterministic value math, with at most five finalists reaching the model.
- **Why**: The screen is cheap, testable and explainable, and the model's judgment is only worth paying for where news and role matter.

### Git as the data store
- **Constraint**: One league, one record a day, and a strong wish to replay any past morning.
- **Options**: A hosted database; object storage; files committed to the repository.
- **Choice**: JSON records committed by the scheduled job.
- **Why**: Nothing else to operate, complete history by default, and the site becomes a pure function of the repository.

### A static site with three small functions
- **Constraint**: Most of the site is yesterday's data; only two features need a live model call.
- **Options**: A server-rendered app; a static site with a separate API service; a static site with a few serverless functions.
- **Choice**: Static site, three functions, one middleware gate in front of both.
- **Why**: The static part is fast and cannot spend money. The functions are small enough that every spending rule fits in one handler and one spec file.

### Batching built, then left switched off
- **Constraint**: Batch pricing halves token cost, but answers arrive later, which splits the morning into a submit run and a collect run.
- **Options**: Ship it on; leave it out; build it behind a flag and measure first.
- **Choice**: Built behind a flag that defaults to off.
- **Why**: Splitting the run introduced many new failure paths around lost or double-counted spend. Once research reuse had already cut most of the cost, the remaining saving was a few cents a day, which did not justify running the most complex code path in production.

## Frequently Asked Questions

### How does it decide a free agent is worth adding?
A candidate must beat the roster's benchmark drop by a value threshold and pass a positional gate that stops the roster from stacking a position it does not need. The best of the survivors, five at most, are researched before anything is recommended.

### Where do the player values come from?
From KeepTradeCut's dynasty values for the league's format, snapshotted once a day. Draft picks are shown but deliberately left unpriced, so a pick never moves the trade math.

### What does a morning cost to run?
It depends on how many finalists need fresh research. The record for each day states the cost by purpose, and the site shows a month-to-date figure against a budget that warns but never blocks.

### How is the quality of the research checked?
An offline harness replays the research prompt over a set of reference cases with known verdicts and scores agreement, grounding in the cited facts and resistance to known traps. Part of the set is held out and never used to shape the prompt.

### Can it manage more than one league?
Not today. It is built around one league's settings. A separate free job measures how much research would overlap across many leagues, which is the number that decides whether sharing research across users would be affordable.

### What happens if the morning run fails?
The job writes a status file saying so, and the site shows a banner instead of presenting yesterday's advice under today's date. It also shows a banner if no run happened at all.

### Is the site public?
No. It sits behind a shared password enforced by middleware in front of every page and function, and the functions check it again before doing any work.
