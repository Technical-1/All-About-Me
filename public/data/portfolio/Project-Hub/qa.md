# Project Q&A

## Overview

Project Hub is a macOS desktop app I built to be the one place I manage all of my code projects. It syncs my GitHub repositories across more than one account, keeps tasks and notes per project, runs dev servers, and opens any project in a terminal or Claude Code with one click. The interesting technical part is that it builds its activity record on its own: pushed commits are captured into a work log on every sync, and a `[hub-N]` tag in a commit message closes the matching task. That log drives a daily Today page. It is a Tauri 2 app with a React front end, a Rust core and a local SQLite database, and it currently runs as a development build with no signed release.

## Problem Solved

I work across a large number of repositories and kept losing track of which ones had drifted, which had uncommitted local changes, and what I had meant to do next in each. Project Hub puts every repository on one board, derives status from git instead of from what I remember to write down, and removes the steps between "I should work on that" and having the right project open with the right task in front of me.

## Target Users

- **Me, primarily** — it was built around how I work across my own repositories
- **Solo developers with many repositories** — anyone with the same fan-out problem who would rather have activity tracked from commits than log it by hand

## Key Features

### Dashboard
A card for every repository, filterable by status, GitHub account and owner or organization. A project is `pending`, `active`, `on_hold`, `idea`, `done`, `archived` or `ignore`; the default view shows only active work, and `ignore` keeps a repository out of the Today statistics entirely. From a card I can clone, link an existing folder, start the dev server, open a terminal or Claude Code, and push.

### Ambient capture and the `[hub-N]` convention
Each sync records recent commits in a work log. If a commit message contains `[hub-42]`, task 42 is resolved and linked to that commit once the commit is pushed. I never mark tasks done by hand.

### Today page
A 12-week activity heatmap, per-project velocity for the last 14 days, today's activity, a copyable standup for yesterday, stuck in-progress tasks, and a recommended next task.

### Stale Work Radar
Flags active, cloned projects that have uncommitted tracked changes with no commit in 7 days, or no recorded activity for 7 days, with a button to open a terminal there.

### Task Board and Claude Code launchers
Tasks across every project with a three-state lifecycle and priorities. A single task opens in Claude Code with a prompt built from its title, description and project, including the instruction to tag the commit. Separately, a project's whole list of open tasks can be handed to one session, and an Investigate action runs a headless review of a repository and files what it finds as new tasks.

### Fleet
Up to five headless Claude Code sessions running at once, each in its own git worktree and branch, with a live line showing what each is doing and a box to send it a follow-up instruction.

### Scheduled investigation
Chosen projects can be investigated daily or weekly at a set hour while the app is open; each run and its result is listed on the Today page.

### Multiple GitHub accounts
I can connect several accounts. Each project remembers which account it came from, and clones use that account's token and commit identity.

### Archive with preserved context
Marking a cloned project done or archived saves its `.portfolio/` write-ups to a side folder and removes the local clone. Restoring re-clones the repository and puts them back.

### MCP server
A small Node server exposes the task board and work log as tools, so a Claude Code session can identify its project, list and create tasks, and log work directly. It is a separate package that has to be built and registered by hand; the app does not bundle it.

## Technical Highlights

### A radar that ignores untracked noise
The obvious dirtiness check, a non-empty `git status --porcelain`, flagged repositories for `.DS_Store` files, build output and sync-conflict copies. `has_uncommitted_changes` in `src-tauri/src/commands/git.rs` counts only tracked modifications, and `compute_stale_projects` in `src-tauri/src/commands/today.rs` never labels a dirty repository "untouched", so the radar shows work that could be lost and little else.

### Commit ingestion that is safe to repeat
Sync re-reads the same recent commits every five minutes. A partial unique index on `work_log(project_id, commit_hash)` restricted to `committed` rows turns repeat inserts into no-ops, while still allowing several `auto_resolved` rows for one commit that closes several tasks. Ingestion and task resolution run in one transaction per project (`src-tauri/src/commands/capture.rs`), and the migration in `src-tauri/src/db/schema.rs` detects and replaces an older, broader definition of that index.

### Supervising headless sessions from their output stream
Fleet starts each session with stream-json output and reads it line by line (`parse_stream_line` in `src-tauri/src/commands/fleet.rs`). The session id from the init line is what makes follow-ups possible: a queued note is delivered by starting a new turn that resumes that session. Tool-use lines become a one-line activity summary, and a stream that ends without a result is reported as an error with the exit status, not as a quiet idle.

### Two programs, one SQLite file
The app and the MCP server both write to the database. `src-tauri/src/db/mod.rs` enables WAL mode and a five-second busy timeout so a writer waits for the lock instead of failing, and a single-instance guard keeps a second copy of the app from joining in. The server exits when its client disconnects, which stops orphaned processes from holding the file open.

## Engineering Decisions

### Tauri over Electron
- **Constraint**: A desktop app that spends its time running git and child processes, without shipping a browser
- **Options**: Electron, Tauri 2, native SwiftUI
- **Choice**: Tauri 2
- **Why**: A Rust core suits process and git work, the bundle is small, and I could keep a web UI I can iterate on quickly

### Local SQLite, no backend
- **Constraint**: One user, one machine, and it has to work offline
- **Options**: Hosted database with accounts, local SQLite, flat JSON files
- **Choice**: Local SQLite through rusqlite
- **Why**: No infrastructure to run, instant queries, and real SQL for the Today aggregations

### Read commits from GitHub, not from local clones
- **Constraint**: The work log has to fill itself in, including for repositories I have not cloned
- **Options**: Manual logging, a timer, local `git log`, GitHub webhooks, polling the GitHub API during sync
- **Choice**: Poll the API as part of the sync that already runs
- **Why**: It reuses calls the app is already making and covers every repository. Webhooks would need a public endpoint. The cost is that a commit only counts once it is pushed to the default branch

### GitHub tokens in a local file
- **Constraint**: Several accounts, each needing a token for API calls, clones and pushes
- **Options**: The system keychain, a file in the home directory
- **Choice**: A JSON file, `~/.project-hub-accounts.json`, restricted to my user
- **Why**: It was the simplest thing that supported multiple accounts. The trade-off is that the file is plain text, and the token is also written into each clone's git config so that pushes authenticate

## Frequently Asked Questions

### How does a commit close a task?
During sync the app fetches the latest commits for my most recently pushed repositories. For each `[hub-N]` in a message it looks for task N in that same project; if the task is not already resolved it is marked resolved with the commit hash and subject, and an `auto_resolved` entry goes in the work log. The commit has to be pushed to the default branch first, because the app reads commits from GitHub.

### How does the Stale Work Radar decide what is at risk?
It looks only at projects that are active and cloned. A project with tracked uncommitted changes whose last commit is 7 or more days old is flagged "uncommitted". A clean project whose newest work-log entry is 7 or more days old is flagged "untouched". A project with no history at all is not flagged.

### What do the Claude Code actions actually do?
There are three different things. Opening a task starts an interactive session in Terminal with a prompt for that one task. "Task Completion" on a project starts one interactive session seeded with all of its open tasks. "Investigate" runs a headless session that reviews the repository and writes its findings to a file, which the app imports as new tasks. The plain "Open in Claude" button uses `happy` if it is installed and `claude` otherwise.

### What happens to Fleet agents when I quit the app?
They are stopped and forgotten: the list of running agents is held in memory. Their worktrees and branches stay on disk under the app-data directory, so the work is not lost, but the app will not list them again. Nothing in Fleet merges or pushes a branch; that step is mine.

### Where is my data stored?
Projects, tasks, notes and the work log are in one SQLite file in the app-data directory. GitHub accounts and tokens are in `~/.project-hub-accounts.json`, readable only by my user. The app's own network requests go only to GitHub; the Claude Code sessions it starts talk to their own service.

### Why does sign-in use a localhost callback?
There is no server to receive the redirect. The app listens on `127.0.0.1:8765` for the one callback, checks the `state` value, and exchanges the code for a token. It uses an OAuth App whose client id and secret are read from a local `.env`, which is why running the app today means registering your own.

### Does it work on Windows or Linux?
Not in practice. The launchers drive Terminal.app through AppleScript, and the MCP server's default database path is the macOS one. The Rust code has branches for other platforms that I have not run.

### Is this open source?
No license has been granted yet; all rights are reserved pending a decision on how it will be distributed.
