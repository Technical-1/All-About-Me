# Project Q&A

## Overview

Tooling for running several Claude Code accounts on one machine and for rescuing a conversation when one of them hits its usage limit. The interesting part is that the obvious approach — copy the conversation to the other account — does not work for the conversations worth rescuing, and measuring *why* produced a different design.

## Problem Solved

Running more than one account means keeping their configuration in step, and that decays the moment you install something on one of them. Worse, when an account hits its limit mid-task, the work is stranded: the account cannot answer, so anything that needs a working turn to save state is unavailable exactly when it is needed.

## Target Users

- **Anyone running multiple Claude Code accounts** — keeps skills, settings and plugins identical without manual copying
- **Anyone who has lost a long session to a usage limit** — recovers the conversation onto another account for about 1% of a context window

## Key Features

### Account lifecycle in one command
`--add` creates a root, symlinks the shared configuration, derives settings, registers an alias, clones the plugin marketplaces, installs every plugin, and verifies the result — about eighteen seconds from nothing. `--retire` merges the account's conversations into the canonical one, verifies the merge, archives the config, deletes the directory, drops the alias and forgets the Keychain credential.

### Drift detection and repair
`--check` reports six kinds of divergence and changes nothing. Running it without the flag fixes them.

### Session rescue
Finds a conversation by id, by a phrase you remember, or by "the newest one in this directory", and builds a brief you can hand to a different account.

### Skill quality tooling
A linter that follows symlinks (the built-in validator does not) and a harness that measures which skill actually fires for a query, scored as recall and precision.

## Technical Highlights

### The context window is the binding constraint, not the quota
Handing a conversation to another account costs 2–4% of the receiving account's five-hour quota — noise. It costs **60–100% of its context window**. Measured across 5,550 real sessions, the largest are near a million tokens, so a raw copy leaves the new session with almost no room to work. The conversations most worth rescuing are exactly the ones that cannot be copied, which is why `handoff/handoff-brief.py` reconstructs intent rather than moving the transcript.

### Intent is one percent of a conversation
A token census of a 310k-token session: user messages 967 tokens (0.9%), assistant reasoning ~14.5k (12.8%), tool calls and their output ~98k (86.4%). Intent copies verbatim with no summarisation loss, and most of the bulk is re-readable from disk — so the brief carries it as a *pointer*, not as content. Median compression across 402 large sessions is 90×, and one cap on pasted-message length keeps the worst case under 4% of a context window.

### Whitespace-splitting is a silent data loss
The naive `for f in $(find ...)` idiom breaks any filename containing a space. In one real folder 12% of files were affected and the loop produced 28 outputs from 32 inputs. It is not silent in the way people assume — it prints a warning per fragment — but the warnings scroll past and the *missing outputs* are the real symptom. Every directory walk in `handoff/` uses `-print0` with `read -d ''`.

### Skill descriptions are a routing surface with an asymmetric cost
A skill that fails to fire wastes an opportunity; one that fires wrongly drags irrelevant instructions into the context window. So precision is treated as non-negotiable and recall as a backlog. Applying that to a library of skills, 9 of 18 descriptions violated the documented third-person requirement, and rewriting them for recall pushed several into a sibling's territory — which is why each now carries an explicit "not for X, use Y" clause.

## Engineering Decisions

### Symlinks over copies for shared configuration
- **Constraint**: the same skills and hooks must be identical across accounts.
- **Options**: copy on change; a two-way sync step; symlink from one canonical location.
- **Choice**: symlinks, with this repo canonical.
- **Why**: I vendored copies first and the checked-in status bar was stale within the hour. A sync step keeps the drift possible and adds something to forget.

### `settings.json` is generated, never symlinked
- **Constraint**: settings must match across accounts, but the host writes to that file itself.
- **Options**: symlink it like everything else; generate it from an allowlist.
- **Choice**: generate, from an explicit list of shared keys.
- **Why**: if the host writes with an atomic replace, a symlink is silently swapped for a real file and sharing ends with no error. One key is also excluded permanently — the auto-mode block is *learned* per account, growing from 0 to 55 entries in two days, so copying it asserts facts about the wrong machine.

### Hooks warn and adopt; they never repair settings mid-session
- **Constraint**: keeping accounts in step should not depend on remembering to run something.
- **Options**: a manual command; a hook that repairs at session start; a hook that only reports.
- **Choice**: a `Stop` hook that adopts new skills, and a `SessionStart` hook that reconciles — with every settings write done through a temp file and an atomic replace.
- **Why**: session start is exactly when the host is reading that file. Atomic replace removes the corruption risk; it does not make the change take effect until the next session, and the docs say so rather than implying otherwise.

### The Keychain credential is deleted on retire, but never on a guess
- **Constraint**: retiring an account leaves an orphaned credential behind.
- **Options**: leave it; delete it; delete it unless told otherwise.
- **Choice**: delete on `--retire`, with `--keep-credential` to opt out, and report orphans in `--check`.
- **Why**: every other step of retirement is recoverable — the archive exists, the conversations are merged. A deleted credential is not, but re-signing in is cheap, and leaving them to accumulate silently is worse. Three had built up before the check existed.

## Frequently Asked Questions

### Why not just copy the conversation to the other account?
For small sessions, that works and the tooling supports it. For large ones it does not: a 997k-token conversation consumes 99.7% of the receiving session's context window, so you arrive with no room to work.

### What is actually in the brief?
Every message you sent, verbatim; the assistant's reasoning; measurements and fetched web content that cannot be re-derived; and pointers to the files that shaped the work, ranked by how early and how often they were referenced. Ordinary file reads are omitted — those are re-readable from disk, and a pointer is exact where a summary is lossy.

### Why is the plugin marketplace cloned rather than just declared?
Because declaring one in settings leaves no local copy, and every install then fails with "plugin not found in marketplace". Measured on a fresh account: 0 of 17 installed without the clone, 17 of 17 with it.

### How does it know which Keychain entry belongs to which account?
The service name is derived from the config directory's absolute path — `Claude Code-credentials` for the default root, and `Claude Code-credentials-<first 8 hex of sha256(path)>` for any other. That is also why a config root *is* an account: the path is the identity.

### Can I find a conversation if I only remember roughly what it was about?
Yes. Pass a phrase instead of an id. Matches are ranked by how central the term is — a title hit, then hits in your own messages, then raw frequency — not by recency. It reads the whole corpus, so a common project name takes about a minute and every match is scored.

### Does the skill linter do anything the built-in validator does not?
It follows symlinks, and it is stricter. The built-in validator reports symlinked entries as unread behind a warning that is easy to miss, and separately passes a skill with unclosed frontmatter, a name containing spaces, and a directory with no skill file at all.

### Is this macOS-only?
Yes. Keychain service derivation, `sips`, and the bash 3.2 floor are all Apple-specific. The handoff and sync logic would port; the credential and image paths would need replacing.
