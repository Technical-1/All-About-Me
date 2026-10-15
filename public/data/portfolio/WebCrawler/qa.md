# Project Q&A

## Overview

The Municipal Code Compliance Web Scraper extracts content from a municipal government's code-compliance pages, turns it into Markdown, and feeds an AWS Bedrock Knowledge Base that powers a citizen-facing chatbot. It runs once a week on Fargate, walks 19 starting URLs (expanding to 22 pages via per-URL depth limits), and the interesting parts sit in the JavaScript-aware stealth crawler, the HTML-to-Markdown extractor that survives a CMS-heavy government site, and an S3-loaded config that includes a live kill switch.

## Problem Solved

The city's Code Compliance documentation is spread across dozens of pages on permits, inspections, business licenses, and enforcement. Citizens have to know where to look, and that's the bottleneck. By pulling the content into a structured Markdown corpus and indexing it in Bedrock, the chatbot can answer plain-language questions and link back to the original source page.

## Target Users

- **City residents and business owners** — ask the downstream chatbot in plain English instead of navigating a sitemap.
- **City staff** — get quick answers when fielding inbound questions.
- **The operator of this pipeline** — gets a one-email-per-week summary of what was scraped and indexed.

## Key Features

### Stealth Selenium crawl
A headless Chromium configured to defeat the common automation tells (`navigator.webdriver` shimmed, `--disable-blink-features=AutomationControlled`, realistic UA/window size, `enable-automation` switch removed). This is what gets the crawler past the site's CloudFlare layer reliably.

### HTML to Markdown with YAML frontmatter
A multi-pass extractor that removes nav/footer/script noise, drops CMS-template fragments (e.g., `"DO NOT REMOVE"` blocks), deduplicates short repeating phrases, and walks the remaining DOM in order to keep headings and lists intact. Output carries `title`, `source_url`, `description`, and `scraped_date` so Bedrock can cite the original page.

### Per-URL depth control
Each entry in `start_urls` has its own `max_depth`. Standalone pages stay at depth 0; pages with meaningful children get depth 1. The result is the same ~22 pages every run — predictable for the index.

### S3-loaded config with a kill switch
`scraper_config.json` lives in S3. Adding a URL or changing the delay is a JSON edit. Setting `enabled: false` makes the task log and exit 0 on its next run — no infra change, no redeploy.

### Step Functions orchestration
The state machine runs the Fargate task, waits five minutes for S3 consistency, kicks off a Bedrock Knowledge Base ingestion job, and publishes an SNS message with the outcome. Each step can fail and retry independently.

## Technical Highlights

### Multi-pass HTML extractor for CMS-heavy pages
Government CMS pages reuse the same navigation, banner, and template blocks across every URL, and naive `BeautifulSoup.get_text()` produces a wall of duplicated boilerplate. The extractor strips `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`; filters elements whose text matches known CMS markers (`"DO NOT REMOVE"`, template directives); tracks short phrases already emitted to skip cross-page repeats; and walks remaining nodes in DOM order so heading hierarchy survives. Logic lives in the HTML-to-Markdown path of the scraper module in `standalone_selenium/`.

### Stealth Chromium configuration
CloudFlare's bot heuristics pick up on automation flags, missing `chrome.runtime`, and `navigator.webdriver=true`. The crawler sets `--disable-blink-features=AutomationControlled`, removes the `enable-automation` switch, and runs an `execute_script` that defines `navigator.webdriver` as `undefined` and stubs `window.chrome.runtime`. With this configuration the site serves pages normally; without it, several pages return interstitials.

### Per-URL BFS with per-seed depth budgets
Crawl state is kept in `visited_urls`, a `to_visit` queue, and a `url_depths` dict. When the crawler enqueues a discovered link, it looks up the depth budget of the *seed* that produced it, not a global setting. This keeps the crawl tight: depth-0 seeds never enqueue children, depth-1 seeds enqueue children but those children don't recurse further. The same dispatch loop handles both cases without conditional code paths per seed type.

### S3 config overlay on code defaults
`Config._apply_config()` starts from in-code defaults, then deep-merges the JSON pulled from `s3://{bucket}/{prefix}config/scraper_config.json`. Missing keys fall through to defaults, so a partial config file (e.g., updating only `delay_seconds`) is safe. The full effective configuration is logged at startup, which makes CloudWatch the ground truth for "what just ran".

### Run validation that can actually fail
A weekly unattended job is only useful if its "success" signal is honest. Three things back that up: a page counts as *extracted* only when its Markdown body clears a configurable character threshold (`min_content_chars`), so an empty or blocked page can't inflate the extraction rate; the run summary reports the real crawled/failed counts rather than an assumed zero; and the S3 freshness check pages through `list_objects_v2` so the "all files updated today" assertion stays correct beyond the 1,000-object response cap. The result that lands in the SNS email reflects what really happened.

### Failing safely without leaking a browser
The crawler initializes headless Chromium and then applies stealth scripting and timeouts. If any of that post-launch setup throws, the constructor quits the already-created driver before re-raising, so a startup failure doesn't strand a Chromium process in the container. Config loading is similarly defensive: a missing `scraper_config.json` (`NoSuchKey`) is an expected fall-through to defaults logged at INFO, while any other S3 error (e.g., `AccessDenied`) is logged at ERROR so a real misconfiguration is visible in CloudWatch instead of silently masquerading as "no config".

## Engineering Decisions

### Selenium + Chromium versus plain HTTP fetchers
- **Constraint**: Targets are JavaScript-rendered and CloudFlare-protected. `requests`, `httpx`, and `cloudscraper` either returned partial DOMs or interstitials.
- **Options**: Pure HTTP with TLS-fingerprint impersonation (`curl_cffi`); a hybrid `cloudscraper` + `requests` path; full Selenium.
- **Choice**: Selenium with headless Chromium and stealth flags.
- **Why**: One code path that works on every target page. The container is heavier and the run is slower, but at one execution per week the cost is negligible and the maintenance burden is lower than chasing TLS-fingerprint changes.

### ECS Fargate versus AWS Lambda
- **Constraint**: Chromium-based image + ChromeDriver + Python; a 2–3 minute weekly burst.
- **Options**: Lambda container image; Fargate task; an always-on EC2 worker.
- **Choice**: Fargate, 2 vCPU / 4 GB.
- **Why**: Lambda's 10 GB image and 15-minute caps left no margin for retries with Chromium loaded; EC2 would idle 99% of the time. Fargate bills only for the active minutes and has no relevant timeout.

### Step Functions versus a monolithic Python script
- **Constraint**: Three discrete steps with different failure modes — scrape, wait for S3 consistency, trigger Bedrock ingestion — plus a notification.
- **Options**: Do everything in the same Python process; a small shell wrapper around `aws` CLI calls; Step Functions.
- **Choice**: Step Functions state machine.
- **Why**: Built-in `Wait` and `Retry`, free visual run history in the console, and each step can be re-run or swapped without touching the others. The Bedrock ingestion call doesn't block the Fargate task either.

### S3-hosted config with a kill switch
- **Constraint**: URLs and crawl parameters change more often than the code; the operator needs an emergency stop without an ECR push.
- **Options**: Bake config into the image; env vars on the task definition; Parameter Store; S3 JSON.
- **Choice**: S3 JSON loaded at task start, with an `enabled` boolean.
- **Why**: Editing a JSON file is faster than revising a task definition; S3 object versioning is a free audit trail; the kill switch needs no infra change to flip.

## Frequently Asked Questions

### How does the scraper get past CloudFlare on the target site?
By looking like a regular Chromium session. The crawler launches headless Chrome with `--disable-blink-features=AutomationControlled`, removes the `enable-automation` switch, and runs an `execute_script` that hides `navigator.webdriver` and stubs `window.chrome.runtime`. CloudFlare's challenge then resolves normally and the page renders.

### Why is each starting URL allowed its own depth instead of a global setting?
Some seeds are leaf pages — only the page itself is useful. Others have a handful of meaningful child pages. A global depth would either miss the children or pull in noise. Per-seed `max_depth` keeps the output set at the same ~22 pages every week, which matters for downstream RAG quality.

### Can I add or remove URLs without redeploying?
Yes. Edit `scraper_config.json` in S3 at `{prefix}config/scraper_config.json`. The next scheduled run picks up the change. Same path for tuning `max_pages`, `delay_seconds`, or flipping the `enabled` kill switch.

### What happens to pages that fail mid-run?
They're logged, counted, recorded in the JSON run summary, and the crawler moves on. The choice is deliberate: aggressive retries on a CloudFlare-protected site invite IP blocks, and the next weekly run will pick them up if the failure was transient. The summary reports the true failure count, and the SNS email surfaces any drop below the validation threshold — so a run that quietly degraded doesn't look like a clean success.

### Why Markdown output instead of raw HTML or JSON?
Bedrock's chunker handles Markdown well — headings become section boundaries, lists stay grouped — and the YAML frontmatter gives the chatbot a clean `source_url` for citations. Raw HTML wastes tokens on tags; JSON loses the document structure that makes retrieval coherent.

### How does Bedrock ingestion stay in sync with the scrape?
Step Functions doesn't trigger the ingestion job until five minutes after the Fargate task finishes (an S3 consistency buffer), then calls `StartIngestionJob` against the Knowledge Base data source. The ingestion job itself is asynchronous; the state machine reports its job id in the SNS email so the operator can confirm it completed.

### Why weekly instead of nightly?
Government documentation changes on the order of months, not days. Weekly keeps content fresh enough for the chatbot, keeps the cost at roughly fifty cents a month, and keeps the request rate to the municipal site polite. EventBridge can move the schedule without code changes if that ever needs to flip.

### Is there a test suite, given it drives a real browser?
Yes. The logic that's worth protecting — frontmatter serialization, the content-length extraction gate, per-URL depth resolution, the paginated S3 freshness count, and config-load error handling — is factored into functions that don't depend on a live browser or AWS, so the `pytest` suite calls them directly and mocks boto3 and the WebDriver. That keeps the tests fast and runnable anywhere, without standing up Chromium or hitting S3.

### How would scaling to many more URLs look?
The current single-task architecture handles around 200 pages comfortably inside one run. Past that point the natural shape is to split the URL list across parallel Fargate tasks (one queue, multiple workers) and add a small DynamoDB table to track content hashes so only changed pages are re-extracted. None of that is needed today.
