# Project Q&A

## Project Overview

The Miami Code Compliance Web Scraper is an automated system I built to extract content from Miami's government website and feed it into an AI knowledge base. The scraper runs weekly, crawling 19 starting URLs (expanding to 22 total pages with child page discovery), converting HTML to structured Markdown, and uploading to AWS S3. From there, AWS Bedrock Knowledge Base indexes the content for use by an AI chatbot that helps citizens navigate code compliance processes.

### Problem Solved

Miami's Code Compliance department has extensive documentation spread across dozens of web pages covering permits, inspections, business licenses, and enforcement procedures. Citizens often struggle to find the right information or understand complex processes. By extracting this content into an AI-powered chatbot, I made this information instantly accessible through natural language queries rather than manual navigation.

### Target Users

- **Primary**: City of Miami residents and business owners seeking code compliance information
- **Secondary**: City staff who can use the chatbot to quickly answer citizen inquiries
- **Tertiary**: Developers maintaining or extending the scraping infrastructure

## Key Features

### 1. Intelligent HTML-to-Markdown Conversion

I built a custom extraction pipeline that preserves document structure while removing noise. The converter:
- Maintains heading hierarchy (H1-H6) for proper document structure
- Preserves lists, tables, and accordion content
- Removes navigation, footers, CMS artifacts, and duplicate text
- Adds YAML frontmatter with metadata for RAG attribution

### 2. Stealth Browser Automation

To handle Miami.gov's bot protection, I implemented advanced stealth techniques:
- Headless Chrome with automation detection disabled
- Custom user agent and navigator property overrides
- Realistic window size and browser fingerprint
- Configurable delays to avoid rate limiting

### 3. S3-Based Dynamic Configuration

The scraper loads its configuration from S3 at runtime, enabling:
- Adding/removing URLs without code changes
- Kill switch for emergency stops
- Tunable parameters (delay, depth, max pages)
- No Docker rebuilds for configuration updates

### 4. Per-URL Depth Control

Each starting URL can have its own crawl depth setting:
- `depth=0`: Scrape only the specified page
- `depth=1`: Scrape the page plus direct child pages
- This allows targeted extraction without over-crawling

### 5. Automated Validation

After each run, the system validates results:
- Checks if minimum page threshold was met
- Verifies S3 files were updated today
- Generates validation report for monitoring

### 6. End-to-End Workflow Orchestration

AWS Step Functions coordinates the entire pipeline:
1. Trigger Fargate scraping task
2. Wait for completion (5-minute buffer)
3. Sync Bedrock Knowledge Base
4. Send email notification with results

## Technical Highlights

### Challenge 1: JavaScript-Rendered Content

**Problem**: Miami.gov uses JavaScript to load content dynamically, including accordion sections that hide important information until clicked.

**Solution**: I used Selenium with headless Chrome instead of simple HTTP requests. The browser executes JavaScript and renders the full page before extraction. I also implemented wait conditions to ensure all dynamic content loads before parsing.

### Challenge 2: Bot Detection and Rate Limiting

**Problem**: The website has CloudFlare protection and bot detection that blocked simple HTTP requests.

**Solution**: I implemented a comprehensive stealth configuration:
```python
# Disable automation detection
chrome_options.add_argument('--disable-blink-features=AutomationControlled')
chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])

# Override navigator properties
self.driver.execute_script("""
    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    window.chrome = {runtime: {}};
""")
```

### Challenge 3: Content Duplication

**Problem**: Government sites often have repeated headers, navigation elements, and CMS artifacts that pollute extracted text.

**Solution**: I built a multi-pass extraction pipeline:
1. Remove script, style, nav, header, footer elements
2. Filter out CMS keywords ("DO NOT REMOVE", "Template", etc.)
3. Track seen text to deduplicate short phrases
4. Process elements in DOM order to maintain structure

### Challenge 4: Container Resource Constraints

**Problem**: Running a full Chrome browser in a container requires significant resources, but Lambda has a 10GB limit and 15-minute timeout.

**Solution**: I chose ECS Fargate with 2 vCPU and 4 GB memory. This provides enough resources for Chrome while only billing for actual execution time (~2-3 minutes weekly). Fargate has no timeout limit, giving flexibility for future expansion.

### Challenge 5: Configuration Without Redeployment

**Problem**: Adding new URLs or changing crawl parameters required rebuilding and deploying the Docker image.

**Solution**: I implemented S3-based configuration loading:
```python
def load_config_from_s3(bucket, prefix):
    s3 = boto3.client('s3')
    response = s3.get_object(Bucket=bucket, Key=f"{prefix}config/scraper_config.json")
    return json.loads(response['Body'].read().decode('utf-8'))
```

Now configuration changes are just JSON edits in S3, taking effect on the next scheduled run.

## Frequently Asked Questions

### Q1: Why did you choose ECS Fargate over Lambda?

I evaluated both options and chose Fargate because:
- **Container Size**: Lambda's 10GB limit is tight for Chrome + dependencies
- **Execution Time**: Lambda's 15-minute limit doesn't leave margin for retries
- **Memory**: Fargate allows up to 30GB; Lambda maxes at 10GB
- **Cost**: At 4 runs/month of 3 minutes each, Fargate costs ~$0.40/month - comparable to Lambda

### Q2: How does the scraper handle page failures?

Currently, failed pages are logged and skipped. The scraper continues to the next URL. Failed pages are recorded in the JSON results file and included in the SNS notification. I chose this approach over aggressive retries to avoid IP blocking and keep execution time predictable.

### Q3: Why Markdown instead of raw HTML or JSON?

Markdown provides the best balance for RAG applications:
- **Structure Preservation**: Headers, lists, and tables maintain document hierarchy
- **Noise Reduction**: No HTML tags, scripts, or styling polluting the text
- **LLM Optimization**: Language models understand Markdown structure better than raw HTML
- **Human Readable**: Easy to inspect and debug extracted content

### Q4: How do you ensure the scraper doesn't miss content?

I implemented several safeguards:
- **Validation Thresholds**: Alert if fewer than 20 pages extracted
- **S3 Freshness Check**: Verify all files updated today
- **SNS Notifications**: Email summary after each run
- **CloudWatch Logs**: Full execution logs for debugging

### Q5: What happens if the scraper is disabled?

The S3 configuration has an `enabled` flag. When set to `false`:
1. Scraper starts normally
2. Loads configuration from S3
3. Sees `enabled: false`
4. Logs a message and exits gracefully (exit code 0)
5. No scraping occurs, but no error is raised

This allows quick stops without infrastructure changes.

### Q6: How do you handle website structure changes?

The extraction is content-based rather than selector-based, making it resilient to minor layout changes. However, significant restructuring would require code updates. I monitor:
- Page count changes (threshold alerts)
- Extraction rate drops
- Error spikes in CloudWatch

### Q7: Why weekly instead of daily scraping?

Government content changes infrequently. Weekly runs balance:
- **Freshness**: Content updates within a week
- **Cost**: Only ~$0.10/run
- **Rate Limiting**: Minimizes risk of IP blocking
- **Resource Usage**: Reduces S3 operations and Bedrock sync costs

The schedule can be changed via EventBridge without code changes.

### Q8: How does the Bedrock Knowledge Base integration work?

After scraping completes:
1. Step Functions waits 5 minutes (ensures S3 consistency)
2. Triggers Bedrock ingestion job via API
3. Bedrock reads Markdown files from S3
4. Content is chunked and embedded for vector search
5. Chatbot queries the knowledge base for relevant content

### Q9: What security measures are in place?

- **Non-Root Container**: Runs as unprivileged user (UID 1000)
- **IAM Least Privilege**: Task role only accesses specific S3 paths
- **No Hardcoded Secrets**: Credentials via IAM roles, not env vars
- **Private S3 Bucket**: Not publicly accessible
- **VPC Isolation**: Fargate runs in private subnets

### Q10: How would you scale this for more URLs?

For significant scale increases, I would:
1. **Parallelize**: Run multiple Fargate tasks, each handling a subset of URLs
2. **Queue-Based**: Use SQS to distribute URLs across workers
3. **Caching**: Add DynamoDB to track page versions, only refetch changes
4. **Rate Limiting**: Implement distributed rate limiting across workers
5. **Retry Queue**: DLQ for failed pages with exponential backoff

The current single-task architecture handles ~200 pages comfortably within 5 minutes.
