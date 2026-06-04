# Project Q&A

## Overview

kendra-who is a web scraping platform I built as a drop-in replacement for AWS Kendra's web crawler. It drives a real, stealth-hardened Chromium browser to crawl sites that block conventional bots, converts pages to clean Markdown, and writes the result to a storage backend — typically an S3 bucket that feeds an AWS Bedrock Knowledge Base. The interesting angle is that it delivers Kendra-style content ingestion on a serverless, pay-per-run footprint (~$2/month) instead of Kendra's ~$810/month floor, by running the scraper as a scheduled ECS Fargate task.

## Problem Solved

AWS Kendra's built-in crawler is expensive and, in practice, gets blocked by modern anti-bot systems and can't render JavaScript single-page apps. I wanted the same outcome — clean, searchable content flowing into a Bedrock Knowledge Base — without the cost floor and without the crawler silently failing on real sites.

## Target Users

- **Teams already using Bedrock Knowledge Bases** — get site content ingested without paying for Kendra's crawler.
- **Engineers who need to scrape JS-heavy or bot-protected sites** — a real browser with stealth defaults, not a brittle HTTP fetcher.
- **Cost-conscious operators** — a scheduled serverless pipeline that costs cents, deployed with one command.

## Key Features

### Stealth browser crawling
Real Chromium via Selenium with fingerprint hardening (WebDriver property removal, plugin/runtime mocking, randomized user agents, configurable delays), so pages render fully and the client reads as a genuine browser.

### Pluggable storage
One storage interface with five interchangeable backends — S3, EFS, DynamoDB, RDS, and local filesystem — selected per job. S3 output is structured to drop straight into a Bedrock Knowledge Base.

### One-command serverless deployment
`kendra-who deploy` builds the container, pushes it to ECR, and provisions the whole pipeline (ECS Fargate, Step Functions, EventBridge schedule, S3, SNS, IAM) via CloudFormation.

### Config-first, GUI-optional
Jobs are defined in human-readable YAML parsed into typed dataclasses; a Streamlit GUI can build configs, preview local scrapes, and monitor deployed runs for users who prefer not to hand-write YAML.

## Technical Highlights

### Byte-accurate storage for mixed text and binary content
The crawler downloads PDFs and images alongside HTML. The storage interface (`storage.py`) accepts `Union[str, bytes]` and writes bytes verbatim — binary file mode for the filesystem backends, raw body for S3 — encoding only when given a string. This prevents the classic corruption where binary bytes get decoded to a string and silently re-encoded as UTF-8 on the way to the backend.

### Injection-safe dynamic SQL in the RDS backend
`RDSStorageHandler.save_structured` builds an `INSERT` whose columns are the scraped record's keys, so the identifiers are effectively untrusted input. Values are parameter-bound, but parameters can't cover identifiers — so every table/column name is validated against a strict allow-list (rejecting anything that isn't a plain identifier) and then dialect-quoted before it reaches the query.

### Fail-fast wiring of optional AWS services
`AWSIntegratedScraper` composes ~14 optional services. A shared `_init_service(name, configured, factory)` helper skips unconfigured services but makes a *configured* service that fails to initialize abort the run with a full traceback — so a scheduled job can never run "successfully" with notifications or change-detection silently disabled by a bad credential.

### Account-portable ARNs and shell-free ECR login
Constructed ARNs resolve the real account ID once via STS (cached per instance) instead of a wildcard that AWS would reject, so deploys work in any account. The ECR login passes the registry password to `docker login` on stdin with an argument list and `shell=False`, keeping the credential out of the process list and out of any shell.

## Engineering Decisions

### Real browser vs. headless HTTP fetcher
- **Constraint**: Targets render content with JavaScript and actively block obvious bots.
- **Options**: A fast requests-based crawler, or a heavier real-browser approach.
- **Choice**: Selenium-driven Chromium with stealth defaults.
- **Why**: An HTTP crawler is cheaper but retrieves nothing useful from JS apps and is trivially detected. Running the browser on per-run Fargate tasks keeps the cost of that choice bounded.

### Single storage contract vs. backend-specific code paths
- **Constraint**: Different deployments need S3, DynamoDB, RDS, EFS, or local output.
- **Options**: Branch on backend throughout the scraper, or hide backends behind one interface.
- **Choice**: A small `StorageHandler` contract plus a factory.
- **Why**: The crawl logic stays backend-agnostic and adding a sink is a localized change; the cost is a deliberately minimal interface.

### Fail-fast vs. graceful degradation on service init
- **Constraint**: Unattended scheduled runs make silent partial failures dangerous.
- **Options**: Warn-and-continue (disable the broken service) or abort.
- **Choice**: Abort when a *configured* service can't initialize.
- **Why**: For automation, discovering days later that alerts never fired is far worse than a loud startup failure that names the problem.

## Frequently Asked Questions

### How does the stealth crawling avoid bot detection?
The browser setup in `scraper.py` removes the `navigator.webdriver` signal, mocks plugins/runtime to look like a normal Chrome session, randomizes the user agent, and applies configurable inter-request delays. Because it's real Chromium, JavaScript executes and the page renders exactly as it would for a human.

### How does the output reach a Bedrock Knowledge Base?
The scraper writes clean Markdown to an S3 bucket, and that bucket is configured as the Knowledge Base's data source — so ingestion happens through S3 rather than any Kendra-specific API.

### Which storage backend should I use?
S3 is the default and the one wired for Bedrock. DynamoDB is best for structured records and fast key lookups, RDS for SQL queries, EFS for a shared filesystem across services, and local for development. They're interchangeable via one config field.

### How is the ~$2/month cost achieved?
There are no always-on servers. EventBridge triggers a Step Functions workflow on your schedule, which runs the scraper as an ECS Fargate task that exists only for the duration of the run; storage and notifications are the only standing costs.

### How are database and proxy credentials handled?
The RDS backend reads credentials from AWS Secrets Manager when given a secret ARN, falling back to environment variables — credentials are never stored in the YAML config.

### Can I run it without any AWS account?
Yes. The local storage backend and `kendra-who scrape` run the full crawl on your machine and write output to disk; AWS is only required for the deployed, scheduled pipeline.

### How do I deploy and tear it down?
`kendra-who deploy` provisions the CloudFormation stack and pushes the image; `kendra-who status` / `logs` inspect a running project, and `kendra-who destroy` removes the stack.
