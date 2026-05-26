# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|---|---|---|---|
| Language | Python | 3.11+ | Mature scraping ecosystem (Selenium, BeautifulSoup) and first-class boto3 support |
| Browser | Chromium (headless) | apt latest | Needed to render JS-heavy miami.gov pages and bypass CloudFlare bot checks |
| Container runtime | Docker on ECS Fargate | n/a | Right size for a 2–3 minute weekly job; no Lambda image/time caps |
| Orchestration | AWS Step Functions | n/a | Sequencing scrape → wait → Bedrock ingestion → notify with built-in retries |
| Index | AWS Bedrock Knowledge Base | n/a | Managed RAG store consumed by the downstream chatbot |

## Backend

- **Runtime**: Python 3.11 on `python:3.11-slim` base image
- **Entry point**: `standalone_selenium/standalone_miami_scraper_selenium.py`
- **API style**: None — this is a scheduled batch job, not a service
- **Auth**: IAM task role (no static credentials)

## Infrastructure

- **Hosting**: AWS ECS Fargate, `linux/amd64`, 2 vCPU / 4 GB, ephemeral storage
- **Schedule**: EventBridge cron, weekly on Sunday at 07:00 UTC
- **Orchestration**: Step Functions state machine (RunTask → Wait 5 min → StartIngestionJob → Publish SNS)
- **Image registry**: AWS ECR
- **Storage**: S3 (config + Markdown output)
- **Notifications**: SNS topic with email subscription
- **Monitoring**: CloudWatch Logs from the Fargate task and Step Functions execution history

## Development Tools

- **Package manager**: `pip` with pinned requirements files (`requirements_standalone.txt`, `standalone_selenium/requirements.txt`)
- **Build / deploy scripts**: `scripts/build_docker_images.sh`, `scripts/push_to_ecr.sh`, `scripts/run_fargate_scraper.sh`, `scripts/monitor_current_task.sh`, `scripts/monitor_bedrock_ingestion.sh`
- **Testing**: None — single-purpose batch job, verified by re-running locally and inspecting Markdown output

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `selenium` | 4.16.0 | Drive headless Chromium |
| `beautifulsoup4` | 4.12.2 | Parse rendered HTML into a tree the extractor walks |
| `lxml` | 4.9.3 | Fast parser backend for BeautifulSoup |
| `boto3` / `botocore` | 1.34.14 | S3 upload, S3 config load, SNS publish |
| `requests` | 2.31.0 | Lightweight HTTP for any non-Selenium fetches |
| `httpx`, `cloudscraper`, `curl_cffi` | various | Available as anti-bot fallbacks; not active in the current Selenium-only path |

## Runtime Configuration

The scraper hydrates a `Config` object from defaults in code, then overlays values from `s3://{bucket}/{prefix}config/scraper_config.json`:

```json
{
  "version": "1.0",
  "enabled": true,
  "urls": {
    "start_urls": [
      {"url": "https://www.miami.gov/...", "max_depth": 1}
    ]
  },
  "crawler_settings": {
    "max_pages": 200,
    "delay_seconds": 3.0
  }
}
```

This means URL changes, delay tuning, and the kill switch are all JSON edits — no Docker rebuild required.

### Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `S3_BUCKET_NAME` | Target bucket | required in AWS |
| `S3_PREFIX` | Path prefix inside the bucket | `miami-code-compliance/` |
| `SNS_TOPIC_ARN` | Run-summary email topic | optional |
| `OUTPUT_DIR` | Local output dir | `data/` |
| `LOG_DIR` | Local log dir | `logs/` |

## Output Format

Each page becomes one Markdown file:

```yaml
---
title: "Page Title"
source_url: https://www.miami.gov/...
description: "Meta description"
scraped_date: 2025-11-17
content_type: webpage
document_format: markdown
---

# Page Title

[Markdown body...]
```

Bedrock's ingestion treats the frontmatter as metadata, so the chatbot can cite `source_url` directly in its answers.

## Cost Profile

The whole pipeline runs for ~3 minutes per week:

| Service | Approx. monthly cost |
|---|---|
| ECS Fargate (4 runs × ~3 min) | ~$0.40 |
| S3 (a few dozen small Markdown files) | <$0.01 |
| ECR (single image) | <$0.10 |
| Step Functions (4 executions) | <$0.01 |
| EventBridge | free tier |
| SNS | free tier |
| CloudWatch Logs | <$0.10 |
| **Total** | **~$0.50** |
