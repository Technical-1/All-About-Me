# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | 3.8+ | Mature Selenium/boto3 ecosystem; the AWS SDK and scraping libraries are first-class here |
| Browser automation | Selenium | 4.16+ | Drives real Chromium so JavaScript-heavy pages render and the client looks like a browser |
| HTML parsing | BeautifulSoup4 + lxml | 4.12+ / 4.9+ | Fast, forgiving parsing of messy real-world markup |
| HTTP | requests | 2.31+ | Direct fetches for non-rendered assets (file downloads, health checks) |
| Config | PyYAML | 6.0+ | Human-editable job definitions parsed into typed dataclasses |
| CLI | Click | 8.1+ | Declarative subcommands (`scrape`, `deploy`, `status`, `logs`, ...) |

## Backend / Runtime

- **Execution model**: Local process for development; ECS Fargate task for scheduled production runs
- **Orchestration**: AWS Step Functions, triggered by EventBridge schedules
- **Output formats**: Markdown (default), JSON, HTML, plain text (`formatters.py`)

## Infrastructure

- **Hosting**: AWS ECS Fargate (serverless containers), provisioned via CloudFormation
- **Container registry**: Amazon ECR
- **Storage**: S3 (default, feeds Bedrock Knowledge Base), with EFS / DynamoDB / RDS / local backends selectable per job
- **CI/CD**: None committed — deployment is driven by the `kendra-who deploy` command
- **Monitoring**: CloudWatch logs; SNS notifications/alerts

## Optional extras (installable feature sets)

- **`[aws]`**: boto3 / botocore — all AWS integrations
- **`[storage]`**: psycopg2-binary (PostgreSQL), PyMySQL (MySQL) — the RDS backend
- **`[gui]`**: Streamlit + pandas — the visual configuration/monitoring UI
- **`[all]`**: everything above

## Development Tools

- **Package manager**: pip (editable install, `pip install -e '.[all]'`)
- **Linting**: flake8
- **Formatting**: black
- **Typing**: mypy
- **Testing**: pytest — unit tests mock AWS via `unittest.mock` patches rather than hitting live services

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `selenium` | Real-browser crawling with stealth fingerprinting |
| `beautifulsoup4` / `lxml` | HTML extraction and cleanup |
| `boto3` | Every AWS service call (S3, ECS, Step Functions, DynamoDB, STS, ...) |
| `click` | Command-line interface |
| `pyyaml` | Job configuration parsing |
| `psycopg2-binary` / `pymysql` | RDS storage backend (optional) |
| `streamlit` / `pandas` | GUI for building configs and monitoring runs (optional) |
