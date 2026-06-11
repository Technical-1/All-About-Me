---
title: "Too Many Projects to Track by Hand"
description: "I'm on a mission to finish every project I've started, but I have dozens active at once and couldn't hold them in my head. So I built a command center that derives status from git activity, flags work before it rots, and hands tasks to an agent."
pubDate: 2026-06-30T10:00:00-04:00
tags: ["Developer Tools", "Rust", "Tauri", "Git", "Productivity"]
---

I'm on a mission to finish every project I've ever started, and that mission has a scaling problem. At any given moment I have dozens of projects in flight. Right now it's around forty. There is no holding that in my head. Which ones have drifted? Which have uncommitted changes sitting on disk that I forgot about? Out of all of them, what's the single most useful thing to do next? I kept losing that thread, and a project you've lost the thread on is a project that quietly dies.

The obvious answer is a task board, and I tried that. The trouble is that a board at this scale is its own full-time job. Every card is something I have to remember to create, move, and close by hand, and the day I get busy and stop, the board starts lying. It tells me I'm "in progress" on something I shipped last month. Once a board lies to you a few times, you stop trusting it, you stop opening it, and now it's just one more dead project.

So I did what I always do when something is wasting my time: I solved it with code. I built Project Hub on one stubborn premise. Don't make me report status, derive it from what I'm already doing. I'm committing to these repos anyway. I wrote the commit. Git already knows what I worked on, so the board should read that instead of interrogating me.

## The shape of it

Project Hub is a local-first Tauri desktop app. Rust backend, React frontend, SQLite on disk, no server. It syncs my GitHub repos, keeps per-project notes and tasks, and most importantly, ambiently captures my real activity from git history into a work log. That work log is the foundation everything else is built on.

"Ambiently" is the load-bearing word. During a GitHub sync, the backend reads recent commits and writes them into a `work_log` table. I never log anything by hand. The history just accumulates because I'm committing anyway.

That sounds trivial until you try to make it not corrupt itself. Sync runs repeatedly, so the same commits get seen over and over. The fix is a partial unique index on `(project_id, commit_hash)`, which makes the ingest idempotent: re-running it can't create duplicates. The same pass scans commit messages, and if it finds `[hub-N]` referencing an open task, it auto-resolves that task and logs it as `auto_resolved`. So the loop is: I write a commit like `fix auth redirect [hub-12]`, and task 12 closes itself the next sync. No column dragging. The commit was the update.

## The Today view

That work log isn't just an archive. It powers a daily "Today" page that's the first thing I open. One screen: an activity heatmap, per-project velocity sparklines, a standup digest of what I touched, an "Up Next" recommendation, stuck-task alerts, and the Stale Work Radar. The whole point is to answer "what should I work on" without me reconstructing it from memory across thirty repos.

Getting Today right surfaced a bug that's a rite of passage for anyone doing date aggregation. The backend groups by `date(created_at, 'localtime')` in SQLite, but the frontend was originally keying dates with `toISOString()`, which is UTC. In any non-UTC timezone, those disagree, and the heatmap and streak would drift by a day. Late-night commits landed on tomorrow. I aligned both sides on a shared local-date key. It's a small thing that completely breaks trust when it's wrong, because a streak that's off by one is a streak you stop believing.

## The Stale Work Radar

This is the feature I'd defend hardest. The radar flags projects that are quietly rotting: real uncommitted changes sitting on disk, or no activity for seven days or more. One click opens a terminal in that repo so I can act on it before it's a mystery.

The naive version of this is a trap. The obvious check is "`git status --porcelain` is non-empty, therefore dirty." That's wrong, and it's wrong in the most annoying way: it cries wolf. Every repo I own has `.DS_Store` files, build output, CI artifacts, iCloud conflict copies. A radar that screams "uncommitted work!" because of a `.DS_Store` is a radar you mute, and a muted radar is a dead board again.

So dirtiness is narrowed to tracked modifications only, app-wide. Untracked clutter doesn't count. And the two states are kept honest against each other: a dirty repo is never also labeled "untouched," because uncommitted changes are recent work by definition. The radar earns its alerts. That's the whole game. A status signal is only worth having if you never have to second-guess it.

## Giving the agent its own keys to the board

The launcher is the easy half. The board has a button that opens Claude Code in a project's directory with a focused prompt built from a task, plus a batch mode that fans the same thing across every open task in a project. That gets work started, but it only goes one direction: the board hands the agent a task and then waits to see what shows up in git.

The half I'm prouder of is the custom MCP server, because it lets the agent talk back.

Project Hub ships its own Model Context Protocol server, a small TypeScript process that exposes the board to any MCP-capable agent as a set of tools. There are ten of them: identify the current project, list tasks, create one, start one, resolve one, bulk-create a batch, log work, pull the work log, and get project status. So the agent doesn't just receive a task and vanish. It can read the board and write to it, mid-session, the same way I can from the GUI.

The piece I like most is how the agent figures out where it is. The first tool, `hub_identify_project`, runs `git remote get-url origin` in whatever directory the agent is working in, parses the owner and repo out of the remote, and looks that up in the board. I never tell the agent which project it's on. It's sitting in the repo, so it already knows, the same way I'd know by glancing at the folder name. Everything after that keys off a project ID it discovered on its own.

And here's the part that turns two separate tools into one loop: the MCP server writes to the exact same SQLite database the desktop app reads from, `project-hub.db` in the app's Application Support directory. No API in between, no two copies to keep in sync. When the agent calls `hub_start_task`, the card flips to in-progress on my screen. When it runs into a follow-up problem and calls `hub_create_task`, a new card appears. When it finishes and calls `hub_log_work` and `hub_resolve_task`, the work log fills in and the task closes. I sit there and watch the board update itself in real time while the agent works, because we're both just reading and writing the same file.

So there are three ways work moves between the agent and the board now, and they stack. The launcher starts a session. The MCP tools let the agent manage tasks and log progress while it runs. And when it commits with a `[hub-N]` tag, the ambient git capture closes the loop one more time on the next sync, even for work I started myself from the terminal. The board hands out work, the agent does it and reports back through its own tools, and the git history backstops all of it. I'm out of the bookkeeping entirely. I just decide what matters.

## Why these constraints

A few decisions held the whole thing together. Tauri over Electron, because I wanted a Rust backend for fast git and process spawning and a small bundle. Local SQLite with no server, because it's a single-user orchestrator and I have zero interest in standing up infrastructure to track my own side projects. And the heavy logic, like `compute_stale_projects` and the prompt builder, lives in pure Rust functions that take inputs and return outputs, with the Tauri command layer as a thin wrapper on top. That keeps the parts that actually matter unit-testable without booting Tauri or a database.

The thesis underneath all of it: status should be a byproduct of doing the work, never a separate chore. The moment a tracker asks you to maintain it, it's already dying. Project Hub reads the trail you're leaving anyway, in git, and turns that into the board. I haven't manually updated a card in months. The board has never been more accurate, and I'm closing out more of those projects than I ever did when I was trying to wrangle them by hand.
