---
title: "Stop Updating Your Task Board. Let Git Update It for You."
description: "Every personal-project tracker I've built died the same way: I stopped updating it. So I built one that derives status from git activity instead of self-reporting, and hands the next task to an agent."
pubDate: 2026-06-30T10:00:00-04:00
tags: ["Developer Tools", "Rust", "Tauri", "Git", "Productivity"]
---

Every personal-project tracker I've ever set up died the same way. Not with a bang. It just went stale. I'd spin up a board, fill it with cards, feel organized for about a week, and then stop touching it. The board kept claiming I was "in progress" on something I'd shipped a month ago, or worse, something I'd abandoned. The work moved on. The board didn't. And once a board lies to you a few times, you stop trusting it, which means you stop opening it, which means it's dead.

The failure mode isn't laziness. It's that the board asks you to do bookkeeping that has nothing to do with the actual work. You already told git what you did. You wrote the commit. Why are you now retyping that into a card and dragging it across a column?

So I built Project Hub on a different premise: don't ask me to report status, derive it from what I already do. The source of truth is git activity, not me remembering to self-report.

## The shape of it

Project Hub is a local-first Tauri desktop app. Rust backend, React frontend, SQLite on disk, no server. It syncs my GitHub repos, keeps per-project notes and tasks, and most importantly, ambiently captures my real activity from git history into a work log. I work across dozens of personal repositories. I was constantly losing track of which had drifted, which had uncommitted local changes I'd forgotten about, and which task was actually next. The app centralizes that.

"Ambiently" is the load-bearing word. During a GitHub sync, the backend reads recent commits and writes them into a `work_log` table. I never log anything by hand. The history just accumulates because I'm committing anyway.

That sounds trivial until you try to make it not corrupt itself. Sync runs repeatedly, so the same commits get seen over and over. The fix is a partial unique index on `(project_id, commit_hash)`, which makes the ingest idempotent: re-running it can't create duplicates. The same pass scans commit messages, and if it finds `[hub-N]` referencing an open task, it auto-resolves that task and logs it as `auto_resolved`. So the loop is: I write a commit like `fix auth redirect [hub-12]`, and task 12 closes itself the next sync. No column dragging. The commit was the update.

## The Today view

That work log isn't just an archive. It powers a daily "Today" page that's the first thing I open. One screen: an activity heatmap, per-project velocity sparklines, a standup digest of what I touched, an "Up Next" recommendation, stuck-task alerts, and the Stale Work Radar. The whole point is to answer "what should I work on" without me reconstructing it from memory across thirty repos.

Getting Today right surfaced a bug that's a rite of passage for anyone doing date aggregation. The backend groups by `date(created_at, 'localtime')` in SQLite, but the frontend was originally keying dates with `toISOString()`, which is UTC. In any non-UTC timezone, those disagree, and the heatmap and streak would drift by a day. Late-night commits landed on tomorrow. I aligned both sides on a shared local-date key. It's a small thing that completely breaks trust when it's wrong, because a streak that's off by one is a streak you stop believing.

## The Stale Work Radar

This is the feature I'd defend hardest. The radar flags projects that are quietly rotting: real uncommitted changes sitting on disk, or no activity for seven days or more. One click opens a terminal in that repo so I can act on it before it's a mystery.

The naive version of this is a trap. The obvious check is "`git status --porcelain` is non-empty, therefore dirty." That's wrong, and it's wrong in the most annoying way: it cries wolf. Every repo I own has `.DS_Store` files, build output, CI artifacts, iCloud conflict copies. A radar that screams "uncommitted work!" because of a `.DS_Store` is a radar you mute, and a muted radar is a dead board again.

So dirtiness is narrowed to tracked modifications only, app-wide. Untracked clutter doesn't count. And the two states are kept honest against each other: a dirty repo is never also labeled "untouched," because uncommitted changes are recent work by definition. The radar earns its alerts. That's the whole game. A status signal is only worth having if you never have to second-guess it.

## Closing the loop with Claude Code

Here's the part I'm most happy with. The board doesn't just show me the next task, it can hand it off.

Project Hub has a Claude Code task launcher. Pick a task, hit "Open in Claude," and it launches the Claude Code CLI right in that project's directory with a focused prompt built from the task title, description, and project context. There's also a batch mode that fires the same thing across all open tasks in a project for a sweep. So the flow is: the board recommends what's next, the agent goes and does it, the agent commits, and the next sync ambiently captures those commits back into the work log. If the commit carries a `[hub-N]` tag, the task closes itself.

That's a closed loop. The board hands work to the agent, the agent produces git activity, the git activity updates the board. I'm out of the bookkeeping entirely. I just decide what matters.

## Why these constraints

A few decisions held the whole thing together. Tauri over Electron, because I wanted a Rust backend for fast git and process spawning and a small bundle. Local SQLite with no server, because it's a single-user orchestrator and I have zero interest in standing up infrastructure to track my own side projects. And the heavy logic, like `compute_stale_projects` and the prompt builder, lives in pure Rust functions that take inputs and return outputs, with the Tauri command layer as a thin wrapper on top. That keeps the parts that actually matter unit-testable without booting Tauri or a database.

The thesis underneath all of it: status should be a byproduct of doing the work, never a separate chore. The moment a tracker asks you to maintain it, it's already dying. Project Hub reads the trail you're leaving anyway, in git, and turns that into the board. I haven't manually updated a card in months. The board's never been more accurate.
