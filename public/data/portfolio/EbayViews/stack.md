# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | Not pinned | Fastest path for a small CLI networking script. |
| HTTP client | `requests` | Not pinned | Familiar, readable API for direct HTTP GET requests. |
| Concurrency | `threading` | Python standard library | Good enough for I/O-bound request dispatch without extra dependencies. |
| User-agent generation | `user_agent` | Not pinned | Avoids maintaining a static list of browser user-agent strings. |

## Backend

- **Runtime**: Python 3
- **Framework**: None
- **API Style**: Direct HTTP requests to public item pages
- **Auth**: None

## Infrastructure

- **Hosting**: Not hosted; local command-line script
- **CI/CD**: None
- **Monitoring**: Console progress output only

## Development Tools

- **Package Manager**: `pip`
- **Linting**: None configured
- **Formatting**: None configured
- **Testing**: None — small enough to verify by hand

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `requests` | Sends the HTTP GET request to the target item URL. |
| `user_agent` | Generates browser-style `User-Agent` values for request headers. |

## Runtime Files

| File | Purpose |
|------|---------|
| `EbayViewBot.py` | Contains the CLI prompts, request dispatcher, worker function, and eBay URL construction. |
| `README.md` | Documents setup, usage, and responsible-use caveats. |
