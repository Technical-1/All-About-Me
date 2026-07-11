# Project Q&A

## Overview

EbayViews is a minimal Python command-line script that sends repeated HTTP requests to an eBay item page. The interesting technical angle is its compact use of per-request user-agent generation and thread-based dispatch in a single file, which makes the concurrency and HTTP behavior easy to inspect.

## Problem Solved

The project demonstrates how a Python script can collect command-line input, build browser-like HTTP headers, and dispatch repeated network requests concurrently. It is best understood as a learning artifact for basic networking and threading rather than a production automation tool.

## Target Users

- **Python beginners** — can see a small end-to-end example of prompts, functions, imports, HTTP requests, and threads.
- **Engineers reviewing lightweight automation patterns** — can quickly inspect the trade-offs of direct requests, unbounded thread creation, and minimal error handling.

## Key Features

### Runtime request configuration

The script asks for both the number of requests and the target item ID at runtime, so the same file can be reused without editing constants in source code.

### Browser-style request headers

`viewItem()` builds an HTTP header dictionary with a generated `User-Agent` and a broad `Accept` header. This keeps the request shape closer to a normal browser navigation than a bare default Python request.

### Threaded dispatch

`go()` starts one `Thread` per requested page request. That design keeps the script short while showing how Python can overlap I/O-bound work.

## Technical Highlights

### Per-request header variation

The dispatcher calls `generate_user_agent()` for each request before starting the worker thread. This keeps header generation close to the dispatch loop and avoids sharing mutable header state across workers.

### Minimal worker boundary

`viewItem(itemID, viewNum, useragent)` receives all request-specific values as arguments. That boundary makes each worker independent: it can build its own headers, construct its target URL, and print its own progress line without reading global state.

### Simple pacing between thread starts

The dispatcher sleeps for `0.1` seconds after starting each thread. This is a lightweight throttle that prevents all worker threads from being launched in the exact same instant, while keeping the code understandable.

## Engineering Decisions

### Direct requests over API integration
- **Constraint**: The script only needs to request a public item page.
- **Options**: Use an official marketplace API, automate a browser, or send direct HTTP requests.
- **Choice**: Send direct HTTP GET requests with `requests`.
- **Why**: Direct requests are the smallest implementation for this learning-focused script, though they provide fewer guarantees than an official API and should be used responsibly.

### Threads over async I/O
- **Constraint**: The work is network-bound and the script is small.
- **Options**: Sequential requests, Python threads, or `asyncio` with an async HTTP client.
- **Choice**: Use `threading.Thread`.
- **Why**: Threads keep the implementation approachable for a compact script. `asyncio` would be more scalable, but it would add concepts and dependencies that are unnecessary for demonstrating the core idea.

### Runtime prompts over command-line flags
- **Constraint**: The script is meant to be run manually.
- **Options**: Hardcoded constants, `input()` prompts, or a full argument parser.
- **Choice**: Use `input()` prompts.
- **Why**: Prompts make the script easy to run without memorizing flags. A parser like `argparse` would be better for automation or repeatable command history.

## Frequently Asked Questions

### How does the script build the target URL?

`viewItem()` concatenates the provided item ID onto `https://www.ebay.com/itm/`. For example, an item ID of `123` becomes `https://www.ebay.com/itm/123`.

### Does it use the official eBay API?

No. It sends direct HTTP requests to public item pages with `requests.get()`. That keeps the code small, but it also means there is no API-level authentication, structured response parsing, or official rate-limit handling.

### Why does it use threads?

The script sends network requests, which spend most of their time waiting on I/O. Threads allow multiple requests to be in flight without requiring a larger async architecture.

### Does the script check whether requests succeed?

No. The current implementation prints progress after `requests.get()` returns, but it does not inspect status codes, catch exceptions, or retry failures.

### Can I control the delay between requests?

Only by editing `time.sleep(.1)` in `go()`. There is no command-line option for throttling in the current script.

### Is this safe to run against any listing?

Automated traffic can violate terms of service, distort analytics, or trigger rate limits. Treat this as a code-learning project and avoid using it in ways that affect real marketplace activity.
