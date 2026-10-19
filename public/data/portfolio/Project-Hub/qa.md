# Project Q&A

## Overview

Repohangar (called Project Hub until October 2026) is a macOS desktop app I built to be the one place I manage all of my code projects. It syncs my GitHub repositories across more than one account, keeps tasks and notes per project, runs dev servers, and opens any project in a terminal or Claude Code with one click. The interesting technical part is that it builds its activity record on its own: pushed commits are captured into a work log on every sync, and a `[hub-N]` tag in a commit message closes the matching task. That log drives a daily Today page. It also watches GitHub Actions and can have my coding agent diagnose a failed run and prepare a fix that only reaches GitHub after I approve it. It is a Tauri 2 app with a React front end, a Rust core and a local SQLite database, and it currently runs as a development build with no signed release.

## Problem Solved

I work across a large number of repositories and kept losing track of which ones had drifted, which had uncommitted local changes, and what I had meant to do next in each. Repohangar puts every repository on one board, derives status from git instead of from what I remember to write down, and removes the steps between "I should work on that" and having the right project open with the right task in front of me.

## Target Users

- **Me, primarily** — it was built around how I work across my own repositories
- **Solo developers with many repositories** — anyone with the same fan-out problem who would rather have activity tracked from commits than log it by hand

## Key Features

### Projects
Every repository in one list (or as cards), filterable by status, GitHub account and owner or organization, with a page per project (overview, tasks, notes, activity, settings). A project is `pending`, `active`, `on_hold`, `idea`, `done`, `archived` or `ignore`; `ignore` keeps a repository out of the Today statistics entirely. From a project I can clone, link an existing folder, start the dev server, open a terminal, an editor or Claude Code, and commit chosen files and push them after a preview. A sidebar with ⌘1–⌘6 and a ⌘K palette reach everything from the keyboard.

### Waiting on you
One queue of what needs me: accounts to reconnect, failed CI runs, failed scheduled investigations, stale work and stuck tasks.

### Ambient capture and the `[hub-N]` convention
Each sync records recent commits in a work log. If a commit message contains `[hub-42]`, task 42 is resolved and linked to that commit once the commit is pushed. I never mark tasks done by hand.

### Today page
A 12-week activity heatmap, per-project velocity for the last 14 days, today's activity, a copyable standup for yesterday, stuck in-progress tasks, and a recommended next task.

### Stale Work Radar
Flags active, cloned projects that have uncommitted tracked changes with no commit in 7 days, or no recorded activity for 7 days, with a button to open a terminal there.

### Tasks and Claude Code launchers
Tasks across every project with a three-state lifecycle and priorities. A single task opens in Claude Code with a prompt built from its title, description and project, including the instruction to tag the commit. Separately, a project's whole list of open tasks can be handed to one session, and an Investigate action runs a headless review of a repository and files what it finds as new tasks.

### CI failure analysis
With CI watching on, failed GitHub Actions runs on default branches become incidents with a log excerpt, the changes since the last green run and a triage guess. My coding agent (Claude Code or Codex) diagnoses an incident read-only in its own worktree and can then propose a fix; approving it commits on a `hub-ci/` branch and opens a pull request, and the approval is tied to the exact diff I reviewed. The review screens are still being built.

### Fleet (experimental)
Up to five headless Claude Code sessions running at once, each in its own git worktree and branch, with a live line showing what each is doing and a box to send it a follow-up instruction.

### Scheduled investigation
Chosen projects can be investigated daily or weekly at a set hour while the app is open; each run and its result is listed on the Today page.

### Multiple GitHub accounts
I can connect several accounts. Each project remembers which account it came from, and clones use that account's token. The app never writes a repository's commit identity.

### Archive with preserved context
Marking a cloned project done or archived first checks the clone for anything that would be lost (uncommitted or untracked files, unpushed commits, stashes, other worktrees), then saves its `.portfolio/` write-ups to a side folder and removes the local clone. Restoring re-clones the repository and puts them back.

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

### GitHub tokens in the Keychain, git through the app's own credential helper
- **Constraint**: Several accounts, each needing a token for API calls, clones and pushes, without leaving the token in a file or in each repository
- **Options**: A file in the home directory (what the first version did), the system keychain with the token written into each clone's git config, the system keychain with the app acting as git's credential helper
- **Choice**: One Keychain item per account, and the app binary itself as a per-command git credential helper, injected through git's environment so nothing is written into any repository
- **Why**: The first version kept tokens in a plain JSON file and wrote them into each clone's `.git/config`, where they travelled with every copy of the folder. Now the token is never on a command line, in the environment or in a config file, and a startup migration moves old files into the Keychain and deletes them. The remaining trade-off: any process running as my user can call the helper the way git does and get a token, which a later sandboxing step is meant to close

## Frequently Asked Questions

### How does a commit close a task?
During sync the app fetches the latest commits for my most recently pushed repositories. For each `[hub-N]` in a message it looks for task N in that same project; if the task is not already resolved it is marked resolved with the commit hash and subject, and an `auto_resolved` entry goes in the work log. The commit has to be pushed to the default branch first, because the app reads commits from GitHub.

### How does the Stale Work Radar decide what is at risk?
It looks only at projects that are active and cloned. A project with tracked uncommitted changes whose last commit is 7 or more days old is flagged "uncommitted". A clean project whose newest work-log entry is 7 or more days old is flagged "untouched". A project with no history at all is not flagged.

### What do the Claude Code actions actually do?
There are three different things. Opening a task starts an interactive session in Terminal with a prompt for that one task. "Task Completion" on a project starts one interactive session seeded with all of its open tasks. "Investigate" runs a headless, read-only session in a throwaway worktree that reviews the repository and answers through structured output, which the app checks and imports as new tasks. The plain "Open in Claude" button uses `happy` if it is installed and `claude` otherwise.

### What happens to Fleet agents when I quit the app?
They are stopped and forgotten: the list of running agents is held in memory. Their worktrees and branches stay on disk under the app-data directory, so the work is not lost, but the app will not list them again. Nothing in Fleet merges or pushes a branch; that step is mine.

### Where is my data stored?
Projects, tasks, notes, the work log and CI history are in one SQLite file in the app-data directory, backed up before every schema upgrade. GitHub tokens are in the macOS Keychain, one item per account; the database holds only the account metadata. The app's own network requests go only to GitHub; the agent sessions it starts talk to their own services, and CI analysis gives them a scrubbed excerpt of the failing logs.

### Why does sign-in use a device code?
A desktop app cannot keep a client secret, and there is no server to receive a redirect. With GitHub's device flow the app shows a short code, I enter it on github.com, and the app polls GitHub until the token is issued. The OAuth App's client id is public and compiled in, so there is no secret, no local port and no `.env`. The cost is that the app cannot revoke a token itself (that needs the secret); signing out deletes it from the Keychain and links to the GitHub page where I revoke it.

### Does it work on Windows or Linux?
Not in practice. The launchers drive Terminal.app through AppleScript, and the MCP server's default database path is the macOS one. The Rust code has branches for other platforms that I have not run.

### Is this open source?
No license has been granted yet; all rights are reserved pending a decision on how it will be distributed.
