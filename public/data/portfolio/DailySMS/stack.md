# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (Node.js) | 10.x | Familiar from school projects; Twilio's first-party SDK is for Node |
| Web framework | Express | 4.x | Minimal surface area for a single-purpose webhook server |
| SMS platform | Twilio Programmable SMS | — | Industry standard with US carrier coverage and a generous free trial |
| Sentiment | Twilio Add-ons Marketplace (Marchex Sentiment) | — | Runs inline on Twilio's side, scoring messages before the webhook fires |
| Scheduler | node-cron | 2.x | Lets the scheduler live in the same process as the webhook server |
| Database | MongoDB | 4.x (Atlas free tier) | Schema-flexible; matched the budget for a high-school side project |
| Templating | EJS | 2.x | Simple server-rendered HTML for the counselor dashboard |

## Backend

- **Runtime**: Node.js (LTS at the time of build)
- **Framework**: Express with `body-parser` middleware for the URL-encoded webhook payloads Twilio sends
- **API style**: A single inbound webhook (`POST /sms`) and a handful of authenticated GET routes for the dashboard
- **Auth**: HTTP Basic auth on dashboard routes, scoped to staff accounts in the `staff` collection

## Infrastructure

- **Hosting**: A single small Linode VM running the Express server and the cron job in the same process
- **Public URL**: A reverse-proxied HTTPS endpoint that Twilio could reach for the inbound webhook
- **CI/CD**: None — deploys were a `git pull && pm2 restart` over SSH
- **Monitoring**: pm2 process logs; sentiment classification errors surfaced in the standard logs

## Development Tools

- **Package manager**: npm
- **Process manager**: pm2 (kept the Node process alive across reboots)
- **Local tunneling**: ngrok for pointing Twilio at a laptop during development
- **Testing**: Manual — sending real SMS from a personal phone to the school number through the dev tunnel

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server and routing for the webhook + dashboard |
| `body-parser` | URL-encoded body parsing (this is what makes `req.body.AddOns` work) |
| `twilio` | Sending outbound prompts and building TwiML responses inline |
| `node-cron` | Cron-style schedule for the daily outbound batch |
| `mongoose` | MongoDB models for students, staff, and messages |
| `ejs` | Server-rendered templates for the counselor dashboard |
| `dotenv` | Loading Twilio + Mongo credentials from environment variables |

## Why this stack (in one paragraph)

Twilio dictated Node, MongoDB came from familiarity with school tutorials and a zero-dollar Atlas tier, and Express was the only sensible web framework for a webhook this small. Everything else (node-cron, EJS, pm2) was picked because it kept the entire system inside a single process on a single VM — which is what a high schooler could reasonably operate without a DevOps team behind them.
