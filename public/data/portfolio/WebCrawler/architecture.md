# Architecture Overview

## System Architecture Diagram

```mermaid
flowchart TB
    subgraph Scheduling["Scheduling Layer"]
        EB[EventBridge Rule<br/>Sunday 7 AM UTC]
    end

    subgraph Orchestration["Orchestration Layer"]
        SF[AWS Step Functions<br/>miami-scraper-weekly-sync]
    end

    subgraph Compute["Compute Layer"]
        subgraph Fargate["ECS Fargate"]
            Docker[Docker Container<br/>Python 3.11 + Chromium]
            Selenium[Selenium WebDriver<br/>Headless Chrome]
            Scraper[SeleniumCrawler<br/>Main Scraper Logic]
        end
    end

    subgraph Storage["Storage Layer"]
        S3[(S3 Bucket<br/>dev-code-compliance-s3)]
        subgraph S3Contents["S3 Structure"]
            Config[/config/scraper_config.json/]
            Markdown[/html_text/*.md/]
            Results[/scraped_data_latest.json/]
        end
    end

    subgraph AI["AI Integration"]
        Bedrock[AWS Bedrock<br/>Knowledge Base]
        Chatbot[AI Chatbot<br/>RAG System]
    end

    subgraph Notifications["Notification Layer"]
        SNS[SNS Topic]
        Email[Email Notifications]
    end

    subgraph Target["Target System"]
        Miami[Miami.gov<br/>Code Compliance Pages]
    end

    EB -->|Triggers Weekly| SF
    SF -->|1. Starts| Fargate
    SF -->|3. Triggers Sync| Bedrock

    Scraper -->|Loads Config| S3
    Scraper -->|Controls| Selenium
    Selenium -->|Crawls| Miami
    Scraper -->|Uploads Markdown| S3
    Scraper -->|Saves Results| S3

    S3 -->|Data Source| Bedrock
    Bedrock -->|Provides Context| Chatbot

    SF -->|4. Sends Notification| SNS
    SNS -->|Delivers| Email
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant EB as EventBridge
    participant SF as Step Functions
    participant ECS as ECS Fargate
    participant S3 as S3 Bucket
    participant Miami as Miami.gov
    participant Bedrock as Bedrock KB
    participant SNS as SNS

    Note over EB: Sunday 7 AM UTC
    EB->>SF: Trigger Execution
    SF->>ECS: Start Fargate Task

    ECS->>S3: Load Configuration
    S3-->>ECS: scraper_config.json

    loop For each URL (19 start URLs)
        ECS->>Miami: GET Page (Selenium)
        Miami-->>ECS: HTML Content
        ECS->>ECS: Convert to Markdown
        ECS->>S3: Upload .md File
    end

    ECS->>S3: Save scraped_data_latest.json
    ECS-->>SF: Task Complete

    SF->>SF: Wait 5 minutes

    SF->>Bedrock: Start Ingestion Job
    Bedrock->>S3: Read Markdown Files
    Bedrock->>Bedrock: Index for RAG
    Bedrock-->>SF: Ingestion Complete

    SF->>SNS: Publish Results
    SNS->>SNS: Send Email Notification
```

## Component Architecture

```mermaid
classDiagram
    class Config {
        +str s3_bucket_name
        +str s3_prefix
        +str sns_topic_arn
        +List start_urls
        +int max_pages
        +int max_depth
        +float delay
        +bool enabled
        +_apply_config(s3_config)
        +log_configuration(logger)
    }

    class SeleniumCrawler {
        +Config config
        +Set visited_urls
        +List to_visit
        +List scraped_data
        +Dict url_depths
        +WebDriver driver
        +crawl()
        +_crawl_page(url, depth)
        +_extract_html_text(url, soup)
        +_extract_links(base_url, soup, depth)
        +_upload_html_to_s3(filepath, filename)
        +close()
    }

    class HTMLTextValidationManager {
        +int min_threshold
        +str s3_bucket
        +str s3_prefix
        +validate_results(scraped_data)
        +print_validation_report(results)
    }

    Config --> SeleniumCrawler : configures
    SeleniumCrawler --> HTMLTextValidationManager : provides data
```

## Key Architectural Decisions

### 1. Selenium over Simple HTTP Requests

I chose Selenium with headless Chrome over simple HTTP libraries (requests, httpx) because:

- **JavaScript Rendering**: Miami.gov uses dynamic content loading that requires JavaScript execution
- **Anti-Bot Bypass**: The site has CloudFlare protection and bot detection that Selenium can evade with proper stealth configuration
- **Accordion Content**: Many pages have expandable sections that need to be rendered to capture all content

### 2. Serverless Architecture (ECS Fargate)

I selected ECS Fargate over EC2 or Lambda because:

- **No Server Management**: Fargate handles all infrastructure provisioning and scaling
- **Cost Efficiency**: Only pay for the 2-3 minutes of actual execution time weekly
- **Container Support**: Selenium requires a full Chrome browser which exceeds Lambda's constraints
- **Predictable Resources**: 2 vCPU and 4 GB memory allocation ensures consistent performance

### 3. Step Functions for Orchestration

I implemented AWS Step Functions instead of a monolithic script because:

- **Sequential Dependencies**: The workflow requires waiting for Fargate completion before Bedrock sync
- **Built-in Retry Logic**: Automatic handling of transient failures
- **Visual Monitoring**: AWS Console provides clear execution visualization
- **Decoupled Components**: Each step can be updated independently

### 4. S3-Based Configuration

I designed the configuration system to load from S3 rather than environment variables because:

- **No Redeployment Required**: Configuration changes don't require Docker rebuilds
- **Kill Switch**: The `enabled` flag allows immediate disabling without infrastructure changes
- **URL Management**: Adding or removing scrape targets is a simple JSON edit
- **Audit Trail**: S3 versioning tracks configuration changes over time

### 5. Markdown Output Format

I chose Markdown with YAML frontmatter over raw HTML or plain text because:

- **LLM Optimization**: Markdown preserves document structure that helps RAG systems understand content hierarchy
- **Metadata Preservation**: YAML frontmatter provides source URL, title, and scrape date for attribution
- **Human Readable**: Easy to inspect and debug extracted content
- **Bedrock Compatibility**: AWS Bedrock Knowledge Base works optimally with structured Markdown

### 6. Per-URL Depth Control

I implemented individual depth limits for each start URL rather than a global setting because:

- **Targeted Crawling**: Some pages need child page discovery (depth=1), others are standalone (depth=0)
- **Efficiency**: Prevents over-crawling unrelated content
- **Predictable Results**: Consistently extracts the same 22 pages each week

## Infrastructure Components

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Scheduling | EventBridge | Weekly cron trigger |
| Orchestration | Step Functions | Workflow management |
| Compute | ECS Fargate | Container execution |
| Container Registry | ECR | Docker image storage |
| Storage | S3 | Markdown files + config |
| AI/ML | Bedrock Knowledge Base | RAG indexing |
| Notifications | SNS | Email alerts |
| Logging | CloudWatch Logs | Execution monitoring |
| Security | IAM | Role-based access control |

## Security Architecture

- **Non-Root Container**: Scraper runs as unprivileged user (UID 1000)
- **VPC Isolation**: Fargate tasks run in private subnets with NAT gateway
- **Least Privilege IAM**: Task role only has permissions for specific S3 paths and SNS topic
- **No Hardcoded Secrets**: All credentials passed via environment variables or IAM roles
- **S3 Bucket Policy**: Not publicly accessible, only accessible via IAM roles
