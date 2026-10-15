# Project Q&A Knowledge Base

## Overview

Project Hub is a local-first Tauri desktop app I built as a single command center for everything I'm working on. It syncs repositories from several GitHub accounts and keeps per-project notes and tasks. It also records my real activity from git history into a work log, which powers a daily "Today" view: activity heatmap, velocity, standup digest, "Up Next", stuck-task alerts, and a Stale Work Radar. On top of that it drives the Claude Code CLI. It can open a session focused on one task, run unattended investigation passes on a schedule, or supervise a Fleet of up to five parallel sessions, each on its own git worktree. An MCP server shares the same SQLite database, so those sessions can read and update tasks while they work.

## Problem Solved

I work across dozens of repositories under more than one GitHub account and organization. I kept losing track of which projects had drifted, which had uncommitted local changes, and which task was actually next. Project Hub puts all of that in one view and derives status from git, not self-reporting. "Open the right repo and start on the right task" becomes one click, and so does handing a backlog to several coding sessions at once.

## Target Users

- **Me, primarily**: a single-user orchestrator for a large portfolio of personal projects
- **Solo developers with many repos or several GitHub accounts**: anyone with the same fan-out problem who wants tracking that happens on its own, without manual logging
- **Developers already working in Claude Code**: the MCP server and `[hub-N]` commit convention close the loop between a coding session and the task list

## Key Features

### Multi-account sync with owner filtering
Several GitHub accounts sync into one project list. Each repo shows a badge for the account that owns it. The dashboard filters by status, by account, and by owner or organization, and owner chips carry counts.

### Ambient capture
Commits are ingested into a work log automatically. A `[hub-N]` tag in a commit message resolves the referenced task, with no extra UI step.

### Today workflow
Heatmap, per-project velocity, standup digest, "Up Next" recommendation, stuck-task and Stale Work Radar alerts, and the latest scheduled-run results, all on one page. Projects marked `ignore` are left out of every widget and out of the headline project count.

### Fleet board
Launch up to five Claude Code sessions across projects. Each one gets a hub-task, slash-command, or free-text brief. Every session runs in its own worktree and branch. The board shows live activity, lets you queue a follow-up note that resumes the same session, shows a diffstat, and discards the worktree and branch when you're done.

### Scheduled investigation
An opt-in daily or weekly pass, at a chosen hour, over the projects I pick in Settings. It imports discovered issues as prioritized tasks and records a run history.

### Project lifecycle with portfolio preservation
Clone, link, run, and push from one place. Marking a project `done` or `archived` deletes the local clone but saves its `.portfolio/` docs first, to separate `.done/` and `.archive/` roots. Restoring re-clones the project and puts them back.

## Technical Highlights

### Supervising streaming CLI sessions from Rust
`src-tauri/src/commands/fleet.rs` spawns `claude -p … --output-format stream-json` in a worktree and reads its stdout line by line inside a `tokio::select!`, alongside a `watch` channel used for cancellation. `parse_stream_line` reduces each JSON event to a session ID, a short activity string ("Reading lib.rs", "Searching for …"), or a done marker, and every change is emitted to the UI as a `fleet-agent-update` event. When a turn completes the session goes idle. A queued note restarts it with `--resume <session_id>`, so the conversation carries over without keeping a process alive between turns.

### Credential handling across several accounts
Each project row records the account that owns it, and every clone, commit fetch, and push uses that account's token. The token never appears in a remote URL. Clones pass it as a per-command `http.extraheader`. After a clone or link, `git::apply_repo_identity` writes the repo-local extraheader and the account's `<id>+<login>@users.noreply.github.com` identity, and stderr is redacted before it reaches the UI. The account store is written owner-only (`0600`) with a `.bak` copy first. The legacy single-token migration deletes the old file only after the new store is safely saved, and it keeps the token on transient network errors (`github/oauth.rs`).

### Two processes, one SQLite file
The Tauri app and every MCP server process write to the same `project-hub.db`. `db/mod.rs` turns on WAL and a 5s `busy_timeout`, so writers wait their turn instead of failing with `SQLITE_BUSY`. `tauri-plugin-single-instance` is registered first so that a second launch focuses the existing window instead of starting another writer. The MCP server exits on stdin EOF or transport close, so disconnected clients never pile up as orphans holding the database open.

### A Stale Work Radar without false positives
A naive `git status --porcelain` check treats `.DS_Store`, build output, and other untracked clutter as at-risk work. `has_uncommitted_changes` in `commands/git.rs` counts only tracked modifications, app-wide. `compute_stale_projects` in `commands/today.rs` is a pure function: a project is "uncommitted" when it is dirty and its last commit is 7+ days old, or "untouched" when it has had no work-log activity for 7+ days, and a dirty repo is never labelled untouched. The git subprocess calls run only after the database lock has been released.

## Engineering Decisions

### Tauri over Electron
- **Constraint**: A native desktop app that does a lot of git and process work in parallel, with a small footprint
- **Options**: Electron, Tauri 2, native SwiftUI
- **Choice**: Tauri 2
- **Why**: A small bundle, Rust's async process handling for streaming CLI sessions and parallel fetches, and a typed IPC boundary. SwiftUI would have locked out the Linux and Windows code paths that the launcher already handles.

### MCP server reading the database directly, not an API in the app
- **Constraint**: Coding sessions need to read and update tasks, including when the desktop app is closed
- **Options**: An HTTP API hosted by the Tauri app, a CLI wrapper, or a standalone MCP server on the shared SQLite file
- **Choice**: A standalone Node MCP server (`mcp-server/`) using better-sqlite3 against the same file
- **Why**: There is no dependency on the app running, and the MCP SDK is native to Node. The cost is that two codebases encode the schema and the database path, so the server's default path is kept identical to the Rust app's `project-hub.db`, and `PROJECT_HUB_DB` overrides it.

### Status-specific portfolio roots for done vs. archived
- **Constraint**: Retiring a project should free disk space without losing its write-up, and shipped work should stay separate from abandoned work
- **Options**: Zip the whole clone, keep the clone and hide the row, or save only `.portfolio/` and delete the rest
- **Choice**: Save `.portfolio/` to `<clone dir>/.done/` or `<clone dir>/.archive/` based on status, delete the clone, and clear `local_path`
- **Why**: Git history already lives on GitHub. The portfolio docs are the only thing at risk. Clearing `local_path` gives every retired project the same restore path, and restore checks the other root in case the status changed after archiving. If no `.portfolio/` existed, the UI warns at archive time.

### Opt-in scheduling with an audit table
- **Constraint**: Unattended runs cost time and tokens and can touch many repos
- **Options**: Run on every `active` project, or require explicit opt-in per project
- **Choice**: A `scheduled` column that defaults to 0, a cadence/weekday/hour setting, and an append-only `scheduled_runs` table that keeps a `project_name` snapshot
- **Why**: Nothing runs until I choose it. The run history survives project deletion, and the pure `should_run_now`/`group_rows` helpers keep the scheduling logic unit-testable.

## Frequently Asked Questions

### How does `[hub-N]` auto-resolution work?
During sync, `extract_task_ids` scans each new commit message for `[hub-N]` (case-insensitive, deduplicated). Any matching unresolved task in that same project is resolved, with the commit hash and message recorded, and an `auto_resolved` row is written to `work_log`. Ingest and resolution share one transaction per project. The prompts Project Hub hands to Claude Code instruct the session to apply the tag, so a task closes itself on the next sync after the commit is pushed.

### What happens to a Fleet session's work?
It stays on its own `hub-fleet/<project>-<timestamp>-<id>` branch in a worktree under the app-data directory. The original checkout is never touched. From the card you can read the diffstat, send another note, dismiss the session (which stops it and keeps the branch), or discard it (which removes the worktree and deletes the branch). Merging is deliberately left to me.

### Why are Fleet and scheduled runs started with permission prompts skipped?
They run headless with nobody there to answer a prompt, so they pass `--dangerously-skip-permissions`. The blast radius is limited in other ways. Fleet sessions run in a disposable worktree. Investigation runs only import a JSON task list (`.project-hub-tasks.json`), validating each priority and truncating long titles and descriptions. Scheduled runs only touch projects I've opted in.

### How does the Stale Work Radar decide what's at risk?
It looks only at `active` projects with a local clone. A project is flagged "uncommitted" if it has tracked uncommitted changes and its last commit is 7+ days old, or "untouched" if it has had no work-log activity for 7+ days. Untracked-only working trees are not considered dirty.

### What does the `ignore` status do?
It's for repos I never need to look at, such as forks and one-off experiments. Unlike `done` and `archived`, it doesn't delete the clone. It hides the project from the default dashboard filter, the headline count, and every Today widget.

### Why does the dashboard have separate account and owner filters?
They answer different questions. The account filter is about which signed-in GitHub identity can see a repo. The owner filter is about which user or organization the repo belongs to (the `owner/` half of `full_name`). One account often sees repos from several organizations, so the dashboard needs both. Owner chips are computed from the already-filtered list, so their counts always match what you'd see after clicking.

### Why scope Tailwind v4 to `src/` explicitly?
By default, Tailwind v4's scanner walks the whole project tree. `@import "tailwindcss" source(".")` in `src/index.css` keeps it inside the frontend folder. That speeds up builds and keeps it from stalling on placeholder files evicted to cloud storage outside `src/`.

### Is this open source?
No. It's a personal project, and the repository is not licensed for redistribution or reuse.
