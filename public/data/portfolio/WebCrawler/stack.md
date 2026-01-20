# Technology Stack

## Overview

This project is a Python-based web scraper deployed on AWS serverless infrastructure. I designed it to extract content from government websites and feed it into an AI knowledge base for chatbot applications.

## Backend

### Core Language

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Primary development language |

I chose Python 3.11 for its excellent library ecosystem for web scraping, AWS SDK support, and straightforward deployment to containerized environments.

### Web Scraping Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Selenium | 4.16.0 | Browser automation for JavaScript-heavy pages |
| BeautifulSoup4 | 4.12.2 | HTML parsing and content extraction |
| lxml | 4.9.3 | Fast XML/HTML parser backend for BeautifulSoup |
| requests | 2.31.0 | HTTP client for simple requests |

**Why Selenium?** Miami.gov uses JavaScript-rendered content and has CloudFlare protection. I needed a full browser to:
- Execute JavaScript for dynamic content loading
- Bypass bot detection with stealth configurations
- Render accordion/expandable sections that hide content

**Why BeautifulSoup?** After Selenium loads the page, I use BeautifulSoup to parse the HTML and extract structured content. It provides a clean API for navigating the DOM and extracting text.

### Optional Anti-Bot Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| httpx | 0.25.2 | HTTP/2 support for faster requests |
| cloudscraper | 1.2.71 | CloudFlare bypass capabilities |
| curl_cffi | 0.5.10 | TLS fingerprint impersonation |

These are included in the requirements but only used as fallbacks. The Selenium stealth configuration handles most anti-bot measures.

### AWS SDK

| Library | Version | Purpose |
|---------|---------|---------|
| boto3 | 1.34.14 | AWS service interactions (S3, SNS, Bedrock) |
| botocore | 1.34.14 | Low-level AWS client library |

I use boto3 for all AWS interactions:
- Uploading Markdown files to S3
- Loading configuration from S3
- Sending SNS notifications
- Triggering Bedrock ingestion jobs

## Infrastructure

### Container Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| Docker | Multi-stage | Container packaging |
| Python 3.11-slim | Base image | Minimal Python runtime |
| Chromium | Latest (apt) | Headless browser |
| ChromeDriver | Latest (apt) | Selenium WebDriver |

I built the Docker image on `python:3.11-slim` to minimize image size while including all necessary dependencies. The Chromium browser and ChromeDriver are installed via apt for compatibility across architectures.

### AWS Services

| Service | Resource Name | Purpose |
|---------|---------------|---------|
| **ECS Fargate** | miami-scraper-cluster | Serverless container execution |
| **ECR** | miami-scraper-selenium | Docker image registry |
| **Step Functions** | miami-scraper-weekly-sync | Workflow orchestration |
| **EventBridge** | miami-scraper-weekly-sunday | Scheduled triggers |
| **S3** | dev-code-compliance-s3 | File storage (config + output) |
| **Bedrock** | Knowledge Base 0YIOECVXQO | AI/RAG indexing |
| **SNS** | miami-scraper-notifications | Email notifications |
| **CloudWatch** | /ecs/miami-scraper-selenium | Logging and monitoring |
| **IAM** | ecsTaskExecutionRole | Security and permissions |

### Compute Configuration

| Resource | Specification |
|----------|---------------|
| CPU | 2 vCPU (2048 units) |
| Memory | 4 GB (4096 MB) |
| Architecture | linux/amd64 |
| Network Mode | awsvpc |
| Storage | Ephemeral (Fargate default) |

I allocated 2 vCPU and 4 GB memory because:
- Chromium is memory-intensive, especially with JavaScript execution
- 2 vCPUs allow parallel processing of page rendering
- This configuration completes the full crawl in 2-3 minutes

## Deployment Pipeline

### Build Process

```
Local Development
       |
       v
Docker Build (--platform linux/amd64)
       |
       v
ECR Push (975050039982.dkr.ecr.us-east-1.amazonaws.com)
       |
       v
Task Definition Update
       |
       v
Step Functions Update
```

### Scripts

| Script | Purpose |
|--------|---------|
| `build_docker_images.sh` | Build Docker image for AMD64 architecture |
| `push_to_ecr.sh` | Authenticate and push to ECR |
| `run_fargate_scraper.sh` | Manually trigger Fargate task |
| `monitor_current_task.sh` | Monitor running task status |
| `monitor_bedrock_ingestion.sh` | Check Bedrock sync status |

## Configuration Management

### Runtime Configuration (S3)

```json
{
  "version": "1.0",
  "enabled": true,
  "urls": {
    "start_urls": [
      {"url": "https://...", "max_depth": 1}
    ]
  },
  "crawler_settings": {
    "max_pages": 200,
    "delay_seconds": 3.0
  }
}
```

I designed the configuration to be loaded from S3 at runtime, allowing:
- URL changes without redeployment
- Kill switch for emergency stops
- Tunable crawl parameters

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `S3_BUCKET_NAME` | Target S3 bucket | (required in AWS) |
| `S3_PREFIX` | S3 path prefix | miami-code-compliance/ |
| `SNS_TOPIC_ARN` | Notification topic | (optional) |
| `OUTPUT_DIR` | Local output directory | data/ |
| `LOG_DIR` | Log file directory | logs/ |

## Output Format

### Markdown with YAML Frontmatter

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

[Markdown content...]
```

I chose this format because:
- **AWS Bedrock Compatibility**: Knowledge Base ingestion works best with structured Markdown
- **Source Attribution**: YAML frontmatter preserves metadata for RAG responses
- **Human Readable**: Easy to inspect and debug extracted content

## Cost Analysis

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| ECS Fargate | ~$0.40 | 4 runs/month @ 2-3 min each |
| S3 | <$0.01 | 22 small Markdown files |
| ECR | <$0.10 | Single Docker image |
| Step Functions | <$0.01 | 4 executions/month |
| EventBridge | Free | Within free tier |
| SNS | Free | Within free tier |
| CloudWatch | <$0.10 | Log storage |
| **Total** | **~$0.50/month** | |

I optimized for cost by:
- Using Fargate Spot (when available)
- Minimizing execution time with disabled images/CSS
- Only running once per week
- Using ephemeral storage instead of EBS

## Limitations

### Current Constraints

1. **Single Region**: Deployed only in us-east-1; no multi-region redundancy
2. **No Caching**: Each run fetches all pages fresh (no incremental updates)
3. **Fixed Schedule**: Weekly runs only; no on-demand API trigger
4. **Rate Limiting**: 3-second delay between pages to avoid IP blocking
5. **No Retry Queue**: Failed pages are logged but not retried in same run

### Future Improvements

1. Add DynamoDB for tracking page versions and changes
2. Implement incremental crawling (only fetch changed pages)
3. Add API Gateway for on-demand triggers
4. Multi-region deployment for redundancy
5. Implement dead-letter queue for failed pages
