---
title: "I Replaced an $810/Month AWS Service With a $2/Month One"
description: "AWS Kendra has an ~$810/month floor and its crawler kept getting blocked, so I built a drop-in replacement that runs as a scheduled Fargate task and costs about $2 a month."
pubDate: 2026-06-16T10:00:00-04:00
tags: ["AWS", "Cloud", "Cost Engineering", "Web Scraping", "RAG"]
---

This one started with a line on the AWS bill for a project I was working on, for a service that wasn't even doing its job. Here's what the project needed, what that service was quietly costing it, and the small thing I built to replace it.

## What the project actually needed

The job was boring. The project had a Bedrock Knowledge Base, an AI search index, and a handful of websites it needed to be able to answer questions about. So something had to crawl those pages, turn them into clean text, and drop that text somewhere Bedrock could read it. That's the whole task.

AWS has a service for this called Kendra, and it ships with a built-in crawler that's supposed to handle exactly this. We tried it. It let us down twice.

First, the price. Kendra doesn't really charge you for what you use, it charges you for existing. There's a floor of around $810 a month whether you crawl once an hour or once a quarter. Second, and this is the part that actually got to me, it didn't even work. The sites we cared about run anti-bot defenses and render everything with JavaScript, and Kendra's crawler just bounced off them and came back with nothing. So the project was on the hook for $810 a month for a crawler that returned empty pages.

The longer I looked at it, the more I realized the project didn't need most of what it was paying for. It didn't need a search index sitting there hot around the clock. Bedrock can already point straight at an S3 bucket and ingest whatever's in it. The only piece actually missing was the crawler, and the crawler was the easy part to build.

## So I built it

It's called kendra-who, and it does one thing: it's a drop-in replacement for that one overpriced crawler.

Here's the whole design in a sentence. Drive a real, stealth-hardened Chromium browser to crawl sites that block bots, convert each page to clean Markdown, and write it to S3 so Bedrock can pick it up. The crawl runs as a scheduled Fargate task.

That last bit is the entire trick behind the price. Nothing sits around between runs. EventBridge fires on whatever schedule I set, a Step Functions workflow spins up the scraper as a Fargate task, it runs for a few minutes, and then it disappears. The only things still standing between crawls are storage and a notification topic, and those round down to about two dollars a month. I stopped paying to keep something idle and started paying only for the minutes it's actually working.

## Why a real browser instead of something faster

The cheaper, more obvious move would've been a plain HTTP crawler. Fire a request, parse the HTML, move on. I didn't, for the same reason Kendra failed us: the sites we needed render everything with JavaScript and actively try to block bots. A bare HTTP fetcher is fast and cheap, and it would've come back with the same empty pages Kendra did.

So the crawler drives actual Chromium through Selenium, dressed up to look like a normal person browsing. It strips the `navigator.webdriver` flag that screams "I'm a bot," fakes the plugins and runtime so it reads like a real Chrome session, rotates the user agent, and waits a randomized beat between requests. Because it's a real browser, the JavaScript runs and the page renders the way it would for an actual human.

And yes, a real browser is heavier and slower than an HTTP call. Normally that's exactly the kind of cost that would make me back off. But it only ever runs inside those short, scheduled Fargate bursts, so the heaviness doesn't matter. The expensive way to crawl and the cheap way to run it cancel each other out.

## Markdown, not a wall of text

Once the browser has the page, something has to turn that HTML into text the knowledge base can actually use. The lazy version is to strip the tags and dump whatever's left. That technically works, and it's also where a lot of retrieval quality quietly dies.

When you flatten a page to raw text, you throw away the structure that gave the words meaning. A heading stops being a heading and becomes one more line in the pile. A table collapses into a run of numbers with no idea which value belonged to which column. Later, when Bedrock chunks that text and pulls a piece of it back for an answer, the chunk has lost the context it needed. You end up with answers that came from the right page and are still subtly wrong, because the model is reading a column of numbers with the headers stripped off.

So the crawler doesn't flatten anything. It parses the HTML with BeautifulSoup and lxml and converts it to clean Markdown in `formatters.py`. Headings become real Markdown headings, so a chunk still knows what section it came from. Tables become Markdown tables, so a cell still lines up under its column. Lists stay lists. The output reads like a document instead of the wreckage of one.

That single choice does more for answer quality than anything else in the pipeline. Same crawl, same storage, but the content lands as marked-up text that carries its own structure, instead of raw text with context gaps the retriever has to guess across. Markdown is the default, but `formatters.py` can also emit JSON, HTML, or plain text if a backend wants something else.

## The boring bug that quietly corrupts your files

S3 is where things land by default, since that's what Bedrock reads, but I didn't hardcode it. There's one small storage interface with five backends behind it: S3, EFS, DynamoDB, RDS, or just your local disk, picked per job from a single line of config. The scraper has no idea which one it's writing to. Adding a new one later is a contained change instead of surgery, and the price of that flexibility is keeping the interface tiny: `save`, `save_json`, `save_structured`.

One thing I'm glad I caught early: this thing downloads PDFs and images, not just HTML. The classic way to ruin that is to treat everything like text. You decode the bytes into a string, something quietly re-encodes it as UTF-8 on the way out, and now your PDF is corrupted and you have no idea why. So `save()` takes either a string or raw bytes, and every backend writes bytes exactly as they came in, only encoding when it's genuinely handed text. Slightly uglier signature, files that actually open. Easy trade.

The RDS backend had its own trap. It builds an `INSERT` where the column names come from the scraped record's own keys, which means those column names are effectively untrusted input. Parameter binding keeps the values safe, but you can't bind an identifier. So every table and column name gets checked against a strict allow-list (anything that isn't a clean identifier is rejected outright) and then properly quoted before it goes anywhere near the query. Reject anything malformed outright, don't try to clean it up.

## Failing loud, because no one's watching

The deployed version wires up around fourteen optional AWS services: messaging, change detection, cost tracking, all of it gated behind config. For a job that runs unattended on a schedule, the scary failure isn't a crash. A crash is loud, you notice a crash. The scary one is the job that cheerfully reports success while notifications were silently switched off by one bad credential, and you find out a week later that none of your alerts ever fired.

So I made it fail loud on purpose. Anything you didn't configure gets skipped quietly. But anything you did configure that then fails to start kills the whole run with a full traceback. A noisy startup failure that tells me exactly what's wrong is so much cheaper than discovering silent rot days later. For something I'm not babysitting, that's not a close call.

Two smaller things in the same spirit. The ARNs it builds resolve the real account ID once through STS instead of using a wildcard AWS would reject, so it deploys cleanly into any account. And the ECR login pipes the registry password into `docker login` over stdin with `shell=False`, so the credential never shows up in the process list or in some shell's history.

## Shipping it

The whole thing deploys with one command. `kendra-who deploy` builds the container, pushes it to ECR, and stands up everything (Fargate, Step Functions, the EventBridge schedule, S3, SNS, IAM) through CloudFormation. `status` and `logs` let me peek at a run, `destroy` tears it all back down. If you'd rather not touch YAML, there's a small Streamlit GUI for building configs, previewing a scrape locally, and watching deployed runs. And if you want nothing to do with AWS at all, the local backend plus `kendra-who scrape` runs the entire crawl on your own machine and writes to disk.

## The actual lesson

To be clear, this isn't a "managed services bad" rant. Kendra is genuinely good if you need a hot, always-on search index and your target sites play nice. Ours didn't, on either count.

The thing I keep coming back to is the decision in the middle. I looked at the $810 line item on the project's bill, asked what it was actually buying, and the honest answer was "one crawler I could write in a weekend, plus a pile of standing compute the project would never use." Once you see it that way, the fix is obvious: pull out the one piece you actually need, run it only when it's working, and point it at the bucket Bedrock already reads. Same content, a couple of dollars a month. The hard part was never the code. It was being willing to look at the bill and ask why the project was paying to keep something idle.
