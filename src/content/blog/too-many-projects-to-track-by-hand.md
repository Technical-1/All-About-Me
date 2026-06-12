---
title: "Too Many Projects to Track by Hand"
description: "I'm on a mission to finish every project I've started, but I have dozens active at once and couldn't hold them in my head. So I built a command center that derives status from git activity, flags work before it rots, and hands tasks to an agent."
pubDate: 2026-06-30T10:00:00-04:00
tags: ["Developer Tools", "Rust", "Tauri", "Git", "Productivity"]
---

I'm on a mission to finish every project I've ever started, and that mission has a scaling problem. At any given moment I have a small mountain of them genuinely in flight. Right now 39 are active at once, with more than 70 finished behind them and a stack more queued up. There is no holding that in my head. Which ones have drifted? Which have uncommitted changes rotting on disk that I forgot about? Out of all of them, what is the single most useful thing to do next? I kept losing that thread, and a project you've lost the thread on is a project that quietly dies.

The obvious fix is a task board, and I tried that. But a board at this scale is its own full-time job. Every card is something I have to create, move, and close by hand, and the first week I get busy and stop, it starts lying to me. It says I'm "in progress" on something I shipped a month ago. A board you can't trust is a board you stop opening, and a board you stop opening is just one more dead project on the pile.

So I did what I always do when something is wasting my time: I solved it with code. The whole thing rests on one stubborn idea. Don't make me report what I did. I already reported it, in the commit. The board should read my git history instead of interrogating me.

## The one idea everything hangs on

Project Hub is a local-first desktop app: a Tauri shell, a Rust backend, a React frontend, and a SQLite file on disk. No server. It syncs my GitHub repos and keeps per-project notes and tasks, but the part that matters is the work log, and the fact that I never write to it by hand.

During a sync, the backend reads my recent commits and records them. That is the whole mechanism. The log fills itself in because I'm committing anyway, and everything else in the app is built on top of it.

Making that not quietly corrupt itself took more care than it sounds like. A sync runs over and over, so it sees the same commits again and again. A partial unique index on `(project_id, commit_hash)` makes the ingest idempotent, so re-running it can never create a duplicate. The same pass reads the commit messages, and if it spots a tag like `[hub-12]` pointing at an open task, it closes that task and notes that the commit did it. So I type `fix auth redirect [hub-12]`, and task 12 resolves itself on the next sync. I never touched the board. The commit was the update.

## Knowing what to work on

All that history would be useless if I still had to dig through it, so it feeds a "Today" page that is the first thing I open every morning. One screen: an activity heatmap, per-project velocity sparklines, a digest of what I touched, an "Up Next" suggestion, alerts for stuck tasks, and a Stale Work Radar I'll come back to. The job of that page is to answer "what should I work on" so I never have to reconstruct it from memory.

Getting it right cost me a day to a bug that everyone who has ever aggregated by date eventually meets. The backend grouped commits by local date; the frontend was keying them by UTC. In any timezone but UTC those two disagree, so late-night commits landed on "tomorrow" and the streak counter drifted by a day. I put both sides on the same local-date key. It sounds like nothing, but a streak that is off by one is a streak you stop believing, and the entire value of this thing is that I believe it.

## Catching work before it rots

My favorite feature is the one that goes looking for trouble. The Stale Work Radar flags projects that are quietly dying: real uncommitted changes sitting on disk, or nothing touched in a week or more. One click drops me into a terminal in that repo so I can deal with it before it turns into a mystery.

The obvious way to build this is also a trap. "Is `git status --porcelain` non-empty? Then the repo is dirty." That cries wolf constantly, because every repo I own is full of `.DS_Store` files, build output, and iCloud conflict copies. A radar that screams about a `.DS_Store` is a radar I mute, and a muted radar might as well not exist. So it only counts tracked modifications, and it never labels a repo both "dirty" and "untouched" at the same time, because uncommitted changes are recent work by definition. It only ever fires on something I would actually want to know about. That restraint is the whole feature.

## Letting an agent run the board

Here is where it gets fun. The board doesn't just track my work. It can hand a task to an agent and let the agent work the board back.

The easy half is a launcher: a button that opens Claude Code in a project's directory with a prompt built from a task, plus a batch mode that fans that across every open task. That gets work started, but it only goes one direction. The board throws a task over the wall and waits to see what shows up in git.

The half I'm prouder of is a custom MCP server. Project Hub ships its own Model Context Protocol server, a small TypeScript process that hands any MCP-capable agent ten tools: identify the project, list tasks, create one, start one, resolve one, bulk-create a batch, log work, read the work log, and get project status. So the agent isn't a black box I fire and forget. It can read the board and write to it mid-session, the same way I do from the app.

My favorite detail is how it knows where it is. The first tool, `hub_identify_project`, runs `git remote get-url origin` in whatever directory the agent is working in, pulls the owner and repo out of the URL, and looks it up. I never tell the agent which project it's on. It's standing in the repo, so it already knows, the same way I would by glancing at the folder name. Everything after that keys off a project ID it found on its own.

And the thing that fuses all of this into one loop is the least glamorous part of it: the MCP server writes to the exact same SQLite file the desktop app reads, `project-hub.db` in the app's data directory. No API in the middle, no two copies of the truth to keep in sync. So when the agent calls `hub_start_task`, the card flips to in-progress on my screen. When it hits a side problem and calls `hub_create_task`, a new card appears. When it finishes, logs its work, and resolves the task, I watch the work log fill in live. We are both just reading and writing one file.

Stack that up and there are three paths between the agent and the board, and they reinforce each other. The launcher starts a session. The MCP tools let the agent manage and log work while it runs. And the `[hub-N]` commit capture catches anything either of us did from a plain terminal on the next sync. The board hands out the work, the agent does it and reports back, and git quietly backstops the whole thing.

## The boring choices, and the point

A few unexciting decisions are what actually hold it together. Tauri over Electron, for a Rust backend that spawns git and other processes fast and ships a small bundle. SQLite with no server, because this is a single-user tool and I have no interest in running infrastructure to babysit my own side projects. And the logic that matters, like the staleness computation and the prompt builder, lives in plain Rust functions I can test without booting the app or a database.

But the real idea is smaller than any of that. Status should be something that falls out of doing the work, never a second job you do on top of it. The moment a tool asks you to maintain it, it has already started dying in your hands. Project Hub just reads the trail I'm leaving anyway and turns it into the answer to "what now." I haven't moved a card by hand in months, and I'm finishing more of those forty-odd projects than I ever did when I was trying to hold them all in my head.
