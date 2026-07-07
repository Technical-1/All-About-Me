---
title: "You Don't Have to Build MCP Servers to Do Something New With Them"
description: "I built a personal relationship knowledge graph from my own iMessage history by wiring together two off-the-shelf MCP servers. The novelty isn't a server I wrote, it's the combination."
pubDate: 2026-07-24T11:00:00-04:00
tags: ["MCP", "AI", "Local-First", "Knowledge Graph", "Privacy"]
---

Everyone's busy writing MCP servers right now. New ones land every day: one for your database, one for your calendar, one for your filing cabinet. That's great. But I think the more interesting question is the one almost nobody's asking: what can you *build on top of* the servers that already exist?

So I built Orbit. It's a personal relationship knowledge graph, assembled entirely from my own iMessage history, running fully local on my Mac. Nothing leaves the machine. And the part I'm proudest of isn't a server I wrote. It's that I didn't write one at all.

## The thing iMessage won't tell you

My Messages app holds years of signal about the people in my life. Who I actually talk to. Who I've drifted from. When a conversation went warm, when it went cold, who tends to text first. All of it is sitting right there in `chat.db`, and the app shows me exactly none of it. I get the most recent thread and nothing else.

I wanted to turn that latent history into something I could query and look at. Who am I ghosting? Who's chasing whom? What did a real year-in-review of my conversations actually look like? That's the problem Orbit solves, and only for me. It's a single-user tool that runs on my Mac against my own message store.

## Two servers I didn't write

Here's the move. Two of the hard parts already existed as off-the-shelf MCP servers.

`mac-messages-mcp` reads iMessage. `@modelcontextprotocol/server-memory` is a knowledge-graph store: entities, relations, observations. Both of those are real problems I could have spent weeks reimplementing. Instead I registered them in a `.mcp.json` at the project root and let an MCP-capable LLM client load them when it starts in that directory.

That's the whole integration layer. There's no custom backend tying iMessage to a graph database, because the two servers already speak a common protocol, and the client knows how to drive both. The novelty here isn't a server. It's the *combination*: pointing a message-reader and a graph-store at each other to turn a chat database into a relationship graph, which as far as I can tell nobody had done before.

The application logic that glues them lives in Markdown prompts, not code. I paste `prompts/bootstrap.md` into a session. The agent reads my messages through the `messages` server, works out per-contact stats, topics, tone, and a one-line bio, then writes entities and relations through the `memory` server. That server appends to a `memory.jsonl` file. Done. The reason that logic lives in a prompt and not a script is that seeding involves actual judgment: which threads are just transactional noise, what's a fair one-line read on someone's tone. I'd rather a reasoning model make that call every run than try to hard-code rules for it.

## The schema is one good convention

The graph itself leans on a tiny convention that does a lot of work. Every Person entity carries exactly one tagged observation of each kind: `[freq]` for frequency, `[topic]`, `[tone]`, `[bio]`, and optionally `[sent]` for sentiment. The rule for updates is delete-the-line-then-add-the-line, never append.

That one decision makes the whole thing behave. Updates are idempotent, so I can refresh as often as I like and the graph stays clean instead of accumulating duplicate observations. Parsing on the frontend is a one-liner: `obs.find(o => o.startsWith("[topic]"))`. No schema, no migrations, no ORM, no merge conflicts. For roughly a hundred contacts, re-reading a JSONL file on every page load is plenty fast, and I can open the file in any editor and read the whole graph by eye.

## Then I get to look at it

The graph is only half the project. The other half is a Next.js app that turns it into something you actually browse, with a stack of focused routes, each a different lens.

`/network` renders the people graph in Cytoscape, with Louvain community detection coloring the clusters so my friend groups separate out visually. `/person/[name]` is the deep dive on any one contact: frequency, a rhythm fingerprint, topic cloud, sentiment arc, response-time stats, an attachment gallery, the full message timeline.

A cluster of pages does drift detection, which was the original itch. `/ghosts` surfaces people I've lost touch with. `/initiation` shows who chases whom. `/responsiveness` ranks reply latency. And `/hygiene` handles the messy reality that one person shows up under a phone number, an email, and an iMessage ID all at once: it lists the unnamed handles next to AddressBook candidate names so I can confirm and merge by hand. I tried automatic merging and it always either fused two different people or missed an obvious match. A human confirm is right far more often.

Then there's `/wrapped`, which is exactly what it sounds like: a Spotify-Wrapped-style slideshow of my year in conversations. Top contacts, sentiment over time, busiest day, the hour-of-day fingerprint. It's the most fun page and the one that surprised me most about my own habits.

A few of those views need raw data the memory server doesn't expose, like message bodies and attachment IDs, so those pages open `chat.db` and the AddressBook directly with `better-sqlite3`, read-only, in server components marked `server-only`. That keeps the raw reads on the server and out of the browser bundle entirely. Every route sits on one shared design substrate, a token-based theme plus a library of UI primitives, so a restyle is a token edit instead of a sweep across every page.

The browser flow is the canonical way to run it. There's also an optional Electron wrapper with one feature worth its weight: an in-app Refresh button that shells out to the LLM client headlessly, runs the update and sentiment prompts in the background, and pulls in new messages without my leaving the window.

## The privacy part is the whole point

None of this would be worth doing if it phoned home. It doesn't. The MCP servers run as local stdio processes, the SQLite reads are local, the graph is a local file. The published repo has source code, prompts, and conventions and nothing else. The files with real names and sentiment rationales are gitignored. Your message history is about the most personal data you own, and the only place it goes is your own screen.

That's the takeaway I keep coming back to. The ecosystem is fixated on writing more MCP servers. But the servers we already have are composable primitives, and the interesting work is increasingly in *what you wire them into*. You don't have to build the server to build something new with it. Sometimes the new thing is just two old ones, pointed at each other, looking at data nobody had looked at this way before.
