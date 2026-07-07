---
title: "The Project That Got Me My Job, Finally Finished for Real"
description: "At a three-day externship in 2023 I built a collaborative whiteboard overnight, and it helped land me my job at Deloitte. I finally shipped it for real. The story of doing that says more about my workflow than any token count ever could."
pubDate: 2026-06-08
tags: ["Claude Code", "AI-Assisted Development", "CRDT", "Yjs", "Cryptography", "Shipping"]
---

In 2023, I was at a three-day externship working on a prompt that sounded simple and wasn't: how do you get people who have gotten comfortable working alone, in their own bubbles, to come back to a collaborative, in-person way of working? We were still untangling what COVID had done to the way people work, and that gap had not closed nearly as fast as everyone assumed it would.

My group talked it around in circles for a while. Slides, surveys, policy ideas. None of it felt real. So I pitched something I actually wanted to build: a shared digital whiteboard that worked the same whether you were standing in a conference room or sitting at your kitchen table three states away. One canvas, everyone on it, no second-class remote experience.

Then I did the thing I always do when an idea grabs me. The second night, back at the hotel, I stayed up and built it. Not a mockup. A working app I could open in two browser windows and actually draw on, live, both windows updating at once. The next morning I demoed the real thing instead of talking about a hypothetical one.

The externship was not really a contest with a single winner, almost everyone there ended up getting hired, but that whiteboard was the thing I walked in with and the thing I could point to. It is a big part of why I got my job at Deloitte.

And then, like so many of my projects, it sat there. It worked well enough to turn heads in that room, but "well enough to demo" and "actually finished" are very different states. For years it lived in the same purgatory as everything else I have ever started and not completed.

## The mission, again

If you read my earlier post about consolidating every unfinished project I have ever started into one directory and committing to finishing them, you already know the shape of this. What changed since then is the engine.

I am running an AI-assisted workflow now that is genuinely high volume. Two Claude Ultra accounts, the full weekly allowance burned on each, and for four weeks straight the models wrote around 40 million tokens a day for me. I used to quote that as just "40 million tokens a day," and that framing undersells what is actually happening, because output is the smallest layer of the stack. Before a model writes anything, it reads: the codebase, the conversation so far, every tool result fed back in, on every single call. I pulled the real ratio out of my own session logs, across both accounts, and in my workflow the models read about 200 tokens for every one they write, with roughly 96 percent of that reading being the same context re-read call after call. So a 40-million-token writing day is billions of tokens processed. Not a one-off spike on a busy afternoon, a steady daily rate held for a month. I am telling you these numbers because people ask, and because I want to immediately take them apart.

## Tokens are the wrong metric

You can burn through all of that in a day and ship absolutely nothing. I have done it. You can wander, regenerate the same file twelve times, chase a refactor you didn't need, and end the day with a huge bill and an unchanged repo. Raw token count measures effort at best and waste at worst. It does not measure output.

The numbers I actually watch live in ProjectHub, which is a dashboard I built to track all of this (and which is, fittingly, one of the projects it tracks). Right now it shows 38 projects active and in flight at the same time, 61 finished, and another 12 completed and then retired to the archive. The archived ones aren't failures. They got done with this exact workflow. I just know I will never touch them again, so they are off the board.

So the real tally is not "40 million tokens." It is 38 things in flight right now and over 70 that are genuinely done, and the fact that almost none of it happened one project at a time. The autonomous workflows I built would push roughly 30 projects forward at once, each grinding through its own changes on its own while I stayed out of the way. That is where the volume actually goes. Then, when one of them reached a state that was finally worth polishing, I would pull that single project into focus and ship it by hand, start to finish, before letting it go and turning back to the pile. Parallel and hands-off for the messy 80 percent, deliberate and one at a time for the last mile. Keeping that many plates spinning, and knowing which one was ready to come off the rack, was the part that actually took skill.

## What the volume actually buys, and what it doesn't

Here is the honest version, because I think the honest version is more useful than a victory lap.

What the volume buys me is real. I can explore three approaches to a problem in parallel and throw two of them away without feeling like I wasted a weekend. I can spin up a prototype I would never have hand-built just to find out whether an idea is worth pursuing. And I am almost never blocked on the boring 80 percent of a task, the plumbing and the boilerplate and the config, which used to be exactly where my projects went to die.

What it does not buy me is judgment. It will happily help me finish the wrong project beautifully. It does not know which of my 38 active ideas actually deserves to ship, or when a feature is good enough, or when an entire direction should be scrapped. It writes confidently in places where the right answer was to stop and delete. The bottleneck in my work moved. It used to be typing. Now it is deciding: what to build, what to keep, what to reject. Taste did not get automated. If anything it became the whole job.

Which brings me back to the whiteboard, because deciding to finally finish that one was the easiest call I have made in a long time.

## Spotlight: making the whiteboard real

Finishing it for real meant turning that all-nighter demo into something I would actually trust people to use. The fun part is that the hardest problems were not on the canvas. They were underneath it.

The sync layer is built on Y.js, a CRDT library. The short version of why that matters: there is no central source of truth that everyone has to agree with. Each browser holds its own copy of the document, edits happen locally and instantly, and the library merges everyone's changes without conflicts even when two people draw on the same spot at the same time. No spinner, no "someone else is editing," no lost strokes.

My first instinct for getting those edits between browsers was y-webrtc, true peer-to-peer over WebRTC. It sounded perfect and it fought me the whole way. WebRTC connections die on NAT traversal constantly, the moment two users are behind the wrong kind of home routers, and debugging that across machines is its own special misery. So I pivoted to something almost insultingly simple: a relay built on PartyKit that is about 35 lines of TypeScript. It does exactly one thing. It receives a message from one browser and broadcasts it to the others. It is stateless, it stores nothing, and crucially it never understands what it is passing along.

That last point is the one I am proudest of, because the whole security model hangs off it.

Every room can be encrypted with AES-256-GCM, and the relay only ever sees ciphertext. The plaintext of your board, the actual shapes and notes and drawings, never leaves the browsers that are allowed to see it. The server is a dumb pipe by design.

Access works through capabilities, not accounts. There is no login. Instead, the role you have is baked into a signed link, and the role lives in the URL fragment, which browsers never even send to a server. There are three roles. The owner holds the master key. Editors hold a signing key bound to the room's current epoch. Viewers hold no signing key at all. Every edit is signed with ECDSA on the P-256 curve, and every peer verifies that signature before applying the change. This is the detail I like most: a viewer cannot cheat their way into editing by flipping some flag in their browser console, because there is no flag. Their edits get rejected by every other peer in the room because they simply cannot produce a valid signature. The permission is enforced by math, not by hoping the client behaves.

And if a link leaks, the owner rotates the room to a new epoch. Every old link stops working instantly. No password reset email, no revocation list to maintain, just a clean cut.

On top of all that sits the part people actually see: an infinite canvas, freehand and shapes and arrows that re-route themselves when you move the things they connect, sticky notes, a laser pointer for presenting that leaves an ephemeral trail and never gets saved, multiple boards per room, and export to PNG or PDF. A strict Content-Security-Policy locks the whole thing down so that even the data coming from other peers gets sanitized before it can touch the page.

It is, finally, the app I was trying to build in a single hotel-room night three years ago. It just took the version of me that knows how to finish things to get it there.

## Full circle

I think about that externship a lot. A tired version of me in a hotel room at 4 a.m., building a thing about not being alone, for a prompt about getting people to come back together. Staying up to build something real, fast, under my own steam is just who I am, it is what I do whenever an idea grabs me. The whiteboard was one of the times that instinct paid off in a way I could point to. It is a big part of how I got the job that started my career.

So finishing it was never really about the whiteboard. It was about closing loops, some of them seven and eight years old, and proving to myself that the loud numbers, the billions of tokens, the two Ultra accounts, the firehose, only count for anything when they come out the other side as something done. The tokens are just the gas powering the engine. The 73 finished projects are the point. And the one that helped start all of it is finally, actually, finished.
