# Project Q&A Knowledge Base

## Overview

Project Hub is a local-first Tauri desktop app I built to be a single command center for everything I'm working on. It syncs my GitHub repositories, keeps per-project notes and tasks, and — most importantly — ambiently captures my real activity from git history into a work log. That work log powers a daily "Today" view: an activity heatmap, velocity sparklines, a standup digest, an "Up Next" recommendation, stuck-task alerts, and a Stale Work Radar that flags repos with uncommitted or untouched work before they rot.

## Problem Solved

I work across dozens of personal repositories and was losing track of which projects had drifted, which had uncommitted local changes, and which tasks were actually next. Project Hub centralises that view, derives status from git rather than self-reporting, and makes the "open the right repo and start working" step a single click.

## Target Users

- **Me, primarily** — a single-user orchestrator for a portfolio of side projects
- **Solo developers managing many repos** — anyone with the same fan-out problem who wants ambient tracking instead of manual logging

## Key Features

### Ambient capture
Commits ingest into a work log automatically; `[hub-N]` commit messages auto-resolve the referenced task without any extra UI step.

### Today workflow
Heatmap, per-project velocity, standup digest, "Up Next" recommendation, stuck-task and stale-radar alerts on a single page.

### Stale Work Radar
Surfaces projects with real uncommitted changes or no activity for 7+ days, with one-click "Open Terminal" to act on them.

### Claude Code task launcher
A task can be opened directly in Claude Code with a pre-built focused prompt, or a whole project's open tasks can be batch-investigated.

### Project orchestration
Clone or link repos, auto-detect and run dev servers, push, and open in editor or terminal from one place.

## Technical Highlights

### Stale Work Radar without false positives
The radar flags "uncommitted" repos, but the naive check (`git status --porcelain` non-empty) treated untracked noise — `.DS_Store`, build output, CI artifacts, iCloud conflict copies — as at-risk work. I narrowed dirtiness to tracked modifications only, app-wide, so the radar reflects real work and not clutter. See `src-tauri/src/commands/git.rs`.

### Idempotent ambient capture
Commits ingest into `work_log` during every sync, but a partial unique index on `(project_id, commit_hash)` lets the operation be safely re-run without duplicates. The same pass scans commit messages for `[hub-N]` and auto-resolves matching open tasks (`src-tauri/src/commands/capture.rs`).

### Local-time correctness
Today aggregations group by `date(created_at, 'localtime')` in SQLite, but the frontend originally keyed dates with `toISOString()` (UTC), drifting a day in non-UTC zones. A shared local-date key aligned the heatmap and streak with the backend.

### Pure helpers behind Tauri commands
Logic like `compute_stale_projects` and `build_task_prompt` lives in pure Rust functions that take inputs and return outputs, with the Tauri command layer as a thin wrapper. That keeps the bulk of behaviour unit-testable without spinning up Tauri or a database.

## Engineering Decisions

### Tauri over Electron
- **Constraint**: Needed a native desktop app with a Rust backend for fast git/process work and a small bundle
- **Options**: Electron (familiar but heavy), Tauri 2, native Swift/SwiftUI
- **Choice**: Tauri 2
- **Why**: Small footprint, Rust gives me safe concurrency for git and process spawning, and the typed IPC boundary keeps the frontend honest

### Local-first SQLite, no server
- **Constraint**: Single-user personal orchestrator with no need for sync or sharing
- **Options**: Hosted Postgres + auth, local SQLite, flat JSON files
- **Choice**: Local SQLite (rusqlite, bundled) with the OAuth token in a local file
- **Why**: Zero infrastructure, offline-capable, instant queries, no multi-tenant concerns

### Derive a work log from git instead of asking the user to log
- **Constraint**: Manual activity logging never gets done consistently
- **Options**: Prompt the user, integrate a timer, or derive from commits
- **Choice**: Idempotent ingest of commit history during GitHub sync
- **Why**: Accurate history for free; unlocks standup, velocity, and the radar with no extra user effort

### Idempotent additive migrations on every boot
- **Constraint**: Schema evolves continuously and there's no migration tooling
- **Options**: Add a migration framework, or hand-roll additive checks
- **Choice**: A `run_migrations` routine that checks-then-applies additive changes (including stale-index detection) on every start
- **Why**: Safe re-runs without dragging in a framework for a single-user app

## Frequently Asked Questions

### How does ambient capture work?
During GitHub sync the backend reads recent commits and writes them into the `work_log` table idempotently (a partial unique index dedups by project + commit hash). If a commit message contains `[hub-N]` and task N is open, it's auto-resolved and logged as `auto_resolved`.

### How does the Stale Work Radar decide what's "at risk"?
A cloned, active project is flagged if it has tracked uncommitted changes with an old last commit ("uncommitted"), or no work-log activity for 7+ days ("untouched"). Dirty repos are never labelled untouched, and untracked-only working trees are not considered dirty.

### What does the Claude Code integration actually do?
The "Open in Claude" action launches the Claude Code CLI in the project directory (preferring `happy` if installed, falling back to `claude`). For a single task it injects a focused prompt built from the task title, description, and project context; the batch-investigate action does the same for all open tasks in a project.

### Why GitHub OAuth on localhost instead of a hosted callback?
The app is local-first and has no server. It spins up a temporary HTTP listener on `127.0.0.1:8765`, runs the OAuth flow with a CSRF state, and persists the token to `~/.project-hub-token` so subsequent launches skip the flow.

### Why scope Tailwind v4 to `src/` explicitly?
Tailwind v4's Oxide scanner walks the project tree by default. With `@import "tailwindcss" source(".")` it stays inside the frontend folder, which both speeds up builds and avoids it stalling on iCloud-evicted placeholder files outside `src/`.

### Can I run this against someone else's repos?
Technically yes — once you sign in with GitHub, any repo your account can see is fair game. In practice it's tuned for the owner's own projects and the path/dev-command detection assumes you can clone and run them locally.

### Is this open source?
No. It's a personal project; the repository is not licensed for redistribution or reuse.
