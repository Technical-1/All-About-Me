# Project Q&A Knowledge Base

## Overview

Project Hub is a local-first Tauri desktop app I built to be a single command center for everything I'm working on. It syncs my GitHub repositories, keeps per-project notes and tasks, and — most importantly — ambiently captures my real activity from git history into a work log. That work log powers a daily "Today" view: an activity heatmap, velocity sparklines, a standup digest, an "Up Next" recommendation, stuck-task alerts, and a Stale Work Radar that flags repos with uncommitted or untouched work before they rot.

## Key Features

- **Ambient capture**: Commits ingest into a work log automatically; `[hub-N]` commit messages auto-resolve the referenced task
- **Today workflow**: Heatmap, per-project velocity, standup digest, recommendation, stuck-task + stale-radar alerts
- **Stale Work Radar**: Surfaces projects with real uncommitted changes or no activity for 7+ days, with one-click "Open Terminal"
- **AI assist**: Open Claude focused on a single task or batch-investigate a project's open tasks
- **Project orchestration**: Clone/link repos, auto-detect and run dev servers, push, open in editor/terminal

## Technical Highlights

### Stale Work Radar without false positives
The radar flags "uncommitted" repos, but the naive check (`git status --porcelain` non-empty) treated untracked noise — `.DS_Store`, build output, CI artifacts, iCloud conflict copies — as at-risk work. I narrowed dirtiness to tracked modifications only, app-wide, so the radar reflects real work and not clutter.

### Diagnosing a 0% CPU "blank app" deadlock
After a tooling collision, the app went blank with no errors. `cargo test`/`tsc`/`build` were all green, which ruled out the code. Sampling the live frozen process pinpointed it: the Tailwind v4 Oxide scanner auto-walked the whole project and blocked forever on an iCloud "dataless" placeholder file under a non-gitignored directory. Scoping Tailwind to `src/` (`@import "tailwindcss" source(".")`) fixed it and sped up builds.

### Local-time correctness
Today aggregations group by `date(created_at, 'localtime')` in SQLite, but the frontend originally keyed dates with `toISOString()` (UTC), drifting a day in non-UTC zones. A shared local-date key aligned the heatmap and streak with the backend.

## Development Story

- **Timeline**: Built and iterated over an extended series of focused sessions
- **Hardest Part**: A multi-hour blank-screen incident that was an environment/tooling deadlock (iCloud-evicted file + Tailwind scanner), not a code bug — the lesson was to `sample` a hung process early instead of theorizing
- **Lessons Learned**: Trust green tests; when behavior contradicts passing tests, suspect the environment. Keep tool content-scanning scoped.
- **Future Plans**: Smarter "at risk" signals (e.g. recognizing CI-only maintained repos), more Today polish

## Frequently Asked Questions

### How does ambient capture work?
During GitHub sync the backend reads recent commits and writes them into the `work_log` table idempotently (a partial unique index dedups by project + commit hash). If a commit message contains `[hub-N]` and task N is open, it's auto-resolved and logged as `auto_resolved`.

### Why Tauri instead of Electron?
I wanted a native, small-footprint desktop app with a Rust backend for fast git/process work and safe concurrency. Tauri 2's command model also gives a clean typed IPC boundary.

### Why local SQLite and a token file instead of a backend service?
It's a single-user personal tool. Local-first means zero infrastructure, offline capability, and instant queries, with no multi-tenant or hosting concerns.

### How does the Stale Work Radar decide what's "at risk"?
A cloned, active project is flagged if it has tracked uncommitted changes with an old last commit ("uncommitted"), or no work-log activity for 7+ days ("untouched"). Dirty repos are never labelled untouched, and untracked-only working trees are not considered dirty.

### What was the most challenging part?
The blank-app deadlock. Everything testable was green, so the failure was invisible to the usual checks. Sampling the live process revealed a native scanner blocked on an iCloud placeholder read — a reminder to diagnose, not theorize.

### Is this open source?
No. It's a personal project; the repository is not licensed for redistribution or reuse.
