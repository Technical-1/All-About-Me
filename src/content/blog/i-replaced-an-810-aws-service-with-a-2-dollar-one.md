---
title: "I Replaced an $810/Month AWS Service With a $2/Month One"
description: "AWS Kendra has an ~$810/month floor and its crawler kept getting blocked, so I built a drop-in replacement that runs as a scheduled Fargate task and costs about $2 a month."
pubDate: 2026-06-16T10:00:00-04:00
tags: ["AWS", "Cloud", "Cost Engineering", "Web Scraping", "RAG"]
---

AWS Kendra costs about $810 a month before you've crawled a single page. I replaced it with something that costs about $2.

That gap is the whole story, so let me explain how I got there and why the cheap version is, for my use case, actually the better one.

## What I actually needed

I had a Bedrock Knowledge Base and a set of websites I wanted searchable inside it. That's it. The job is unglamorous: crawl some pages, turn them into clean text, drop that text somewhere Bedrock can ingest it. AWS's answer to this is Kendra, which ships a built-in web crawler that feeds the index for you.

Two problems. The first is the price. Kendra has a floor. You're paying for an always-on index whether you crawl once a day or once a quarter, and that floor lands around $810/month. The second problem is worse: in practice, Kendra's crawler gets blocked. Modern sites run anti-bot systems, and plenty of the content I cared about lived behind JavaScript that a plain HTTP fetcher never renders. So I'd be paying a premium for a crawler that quietly came back with nothing.

When you write out what you're actually buying, the value proposition falls apart. I didn't need a managed index sitting hot 24/7. I needed content to land in S3 on a schedule. Bedrock can already point at an S3 bucket as a data source. The crawler was the only piece I was missing, and it was the cheap piece to build.

So I built it. The project is called kendra-who, and it's a drop-in replacement for exactly that one expensive crawler.

## The design, in one sentence

Drive a real, stealth-hardened Chromium browser to crawl sites that block bots, convert each page to clean Markdown, and write the result to S3 so Bedrock ingests it. The crawl runs as a scheduled ECS Fargate task, so I pay only for the minutes it runs.

That last clause is where the $810 turns into $2. There are no always-on servers. EventBridge fires on whatever schedule I set, kicks off a Step Functions workflow, and that workflow runs the scraper as a Fargate task that exists only for the duration of the run. When the crawl finishes, the compute goes away. What's left standing is storage and notifications, which round to a couple of dollars a month. It's pay-per-run instead of pay-to-exist.

## Why a real browser, not a fast fetcher

The obvious cheaper path is a requests-based crawler. Fire HTTP, parse HTML, done. I didn't do that, and the reason is the same reason Kendra's crawler failed me: the targets render content with JavaScript and actively block obvious bots. A fetcher is faster and cheaper per page, but it retrieves nothing useful from a JS app and it's trivially detected.

So the crawler drives real Chromium through Selenium, with fingerprint hardening so the client reads as a genuine browser. It removes the `navigator.webdriver` signal, mocks plugins and runtime to look like a normal Chrome session, randomizes the user agent, and applies configurable inter-request delays. Because it's actual Chromium, JavaScript executes and the page renders the way it would for a person.

A real browser is heavier than an HTTP call, and normally that cost would scare me off. But running it on per-run Fargate tasks bounds the cost. I only pay for the browser while the scheduled crawl is actually happening, which is the same trick that kills the Kendra bill. The expensive choice and the cheap architecture cancel out.

## Storage, and the boring bug that corrupts everything

S3 is the default sink because that's what Bedrock reads, but the crawler doesn't hardcode S3. There's one storage interface with five interchangeable backends: S3, EFS, DynamoDB, RDS, and local filesystem, picked per job from a single config field. The scraper never knows which one it's writing to. Adding a new sink is a localized change instead of a rewrite, and the cost is a deliberately small interface: `save`, `save_json`, `save_structured`.

One detail I'm glad I got right early: the crawler downloads PDFs and images, not just HTML. The classic mistake here is to treat everything as a string. Bytes get decoded into a string, then silently re-encoded as UTF-8 on the way to the backend, and your PDF is quietly corrupted. So `save()` accepts a `str` or `bytes`, and every backend writes bytes verbatim (binary file mode for the filesystem backends, raw body for S3), encoding only when it's actually handed a string. Correctness for binary payloads mattered more than a tidy string-only signature.

The RDS backend has its own sharp edge. It builds an `INSERT` whose columns come from the scraped record's keys, which means the column identifiers are effectively untrusted input. Parameter binding protects values, but parameters can't cover identifiers. So every table and column name is validated against a strict allow-list (anything that isn't a plain identifier gets rejected) and then dialect-quoted before it goes near the query. Rejecting suspicious identifiers outright beats trying to sanitize them.

## Failing loud, because nobody's watching

The deployed scraper composes around fourteen optional AWS services: messaging, change detection, cost tracking, and more, each gated on config. The dangerous failure mode for an unattended scheduled job isn't a crash. It's a job that reports success while notifications or change detection were silently disabled by one bad credential. You find out days later that the alerts never fired.

So service init fails fast. A shared helper skips anything unconfigured, but a service you *did* configure that fails to initialize aborts the whole run with a full traceback. A loud startup failure that names the problem is much cheaper to debug than silent degradation. For automation, that trade is not close.

A couple of smaller things in the same spirit: constructed ARNs resolve the real account ID once via STS instead of a wildcard AWS would reject, so deploys work in any account. And the ECR login passes the registry password to `docker login` on stdin with `shell=False`, keeping the credential out of the process list and out of any shell.

## Deploying it

The whole pipeline goes up with one command. `kendra-who deploy` builds the container, pushes it to ECR, and provisions everything (ECS Fargate, Step Functions, EventBridge schedule, S3, SNS, IAM) through CloudFormation. `status` and `logs` inspect a run, `destroy` tears it down. If you don't want to hand-write YAML, there's a Streamlit GUI that builds configs, previews a local scrape, and monitors deployed runs. And you can skip AWS entirely: the local backend and `kendra-who scrape` run the full crawl on your machine and write to disk.

## The point

The lesson isn't "managed services bad." Kendra is fine if you need a hot, always-on search index and your sites cooperate. Mine didn't, on either count. The judgment that mattered was looking at an $810 line item, asking what I was actually buying, and noticing the answer was "one crawler I could write, plus a lot of standing compute I didn't need." Pull the crawler out, run it pay-per-run, point it at the S3 bucket Bedrock already reads, and the same content shows up for cents. Sometimes the senior move is just refusing to pay for the idle.
