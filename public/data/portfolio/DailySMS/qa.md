# Project Q&A

## Overview

DailySMS is an SMS-based student wellness check-in system I built with my high school's guidance counselors. Every morning, every enrolled student gets a short text asking how they're doing. The reply is scored for sentiment as it comes through Twilio, and if it reads as negative, a counselor's phone buzzes with the message so they can follow up the same day. It was my first time using Twilio — I went to the counselors with a half-formed idea and they helped me reshape it into something they would actually use.

## Problem Solved

A school's guidance team can only see a student who walks into their office. Plenty of kids who are struggling never do. DailySMS turned that backwards: instead of waiting for students to surface, the system reached out daily on the channel they already used (text), made replying low-effort (one message, no app), and routed at-risk responses to a counselor in real time.

## Target Users

- **Students** — Anyone enrolled (with parent permission) who wanted a low-friction way to flag they were having a rough day.
- **Guidance counselors** — The actual operators of the system. They received the negative-sentiment pages and used the dashboard to look at trends over time.
- **School administrators** — Indirect users; they wanted aggregate signal on the student body's wellbeing without reading individual messages.

## Key Features

### Daily outbound check-in
A scheduled job texts every opted-in student a short prompt each morning. The system rotates between a handful of question variants in `data/prompts.json` so the text doesn't read like the same automated message every day.

### Inline sentiment classification
Each inbound reply is scored by Twilio's Marchex Sentiment Add-on before the webhook even fires. The classification arrives in the same HTTP request as the message body, so the alerting decision is made on the first hop.

### Counselor SMS alerts
When a reply is flagged negative, the on-duty counselor gets an SMS with the student's name, the message, and a link into the dashboard. The whole point of the system is that a human reads it within hours, not days.

### Immediate acknowledgement reply
Every inbound message gets a TwiML response saying the message was received. It costs nothing to send and reassures students that someone is actually on the other end.

### Counselor dashboard
A small Express-rendered dashboard lets counselors browse recent check-ins, filter by sentiment, and view per-student sentiment trends over time.

## Technical Highlights

### Sentiment scoring in the same request as the message
Most SMS apps with sentiment analysis make a second call to an NLP API after the webhook fires. I used Twilio's Marchex Sentiment Add-on, which runs on Twilio's infrastructure and attaches the score to the inbound payload at `AddOns.results.marchex_sentiment.result.result`. That removes a second API key, a second failure mode, and a few hundred milliseconds of latency from the alert path.

### Single-process scheduler + webhook
The system runs as one Node.js process: Express handles inbound webhooks, node-cron handles the morning batch, and they share the same MongoDB connection pool. For a single-school deployment this avoids the operational tax of a separate worker tier without giving anything up — the cron job runs once a day and the webhook traffic peaks well within what one VM can handle.

### TwiML inline reply
The `/sms` handler returns a `MessagingResponse` directly from the webhook, so Twilio sends the acknowledgement to the student without me having to make a follow-up REST API call. This is a small piece of Twilio's design that's easy to miss in a first-time integration, and it cut the outbound API volume roughly in half.

### Alert deduplication
A student who replies to the acknowledgement, or who texts in repeatedly after a bad day, used to generate a flurry of counselor pages. I added an alert record on the message document so subsequent negative messages within a configurable window only annotate the existing alert instead of paging again. Counselors got one buzz per situation, not one per message.

## Engineering Decisions

### Marchex Sentiment Add-on over a separate NLP API
- **Constraint**: The webhook needs to know sentiment before deciding whether to alert a counselor.
- **Options**: Call Google Cloud Natural Language or AWS Comprehend from the webhook; ship a small classifier on-server; use Twilio's Marketplace Add-on.
- **Choice**: Marchex Sentiment Add-on, configured at the Twilio messaging service level.
- **Why**: One credential, one inbound request, no second round trip. The classifier doesn't need to be state-of-the-art for the three-bucket positive/negative/neutral decision the system actually makes.

### SMS as the entire user interface
- **Constraint**: Reach students with no install friction, no login, and no app store gatekeeping.
- **Options**: A school portal page, a dedicated wellness app, a Google Form link, plain SMS.
- **Choice**: SMS.
- **Why**: The counselors had already tried a portal and a form — both went unused. Texting is the one channel high schoolers actually reply on, and it works the same on any phone the school has approved.

### Cron in the same process as the webhook
- **Constraint**: One daily outbound batch, one inbound webhook, one developer maintaining the system.
- **Options**: System-level cron firing a script, a managed job queue (Sidekiq-style), node-cron embedded in the Express process.
- **Choice**: node-cron inside Express.
- **Why**: At one-school scale, splitting the scheduler out adds operational complexity (a second process to deploy, a second log stream to watch) with no reliability or throughput payoff. A single `pm2` process is easier for a student maintainer to keep alive.

### MongoDB over a relational store
- **Constraint**: The message schema was going to keep changing as the counselors gave feedback (add alert metadata, add prompt-variant tracking, add country field once Twilio started exposing it).
- **Options**: Postgres with migrations, SQLite with a hand-rolled schema, MongoDB Atlas.
- **Choice**: MongoDB Atlas free tier.
- **Why**: As a first-time builder iterating with non-technical stakeholders, every schema change in Postgres would have been a tax on momentum. The free Atlas tier also fit the budget for a high-school project ($0).

## Frequently Asked Questions

### How did you handle student privacy?
Only counselors with credentialed dashboard accounts could read message content. The system stored phone numbers and message text in MongoDB; it did not share any of that outside the school. Enrollment required parental consent on top of the student opting in, and a student could text `STOP` to unenroll at any time (Twilio handles this natively).

### Why use Twilio's Add-on instead of a real sentiment model?
For the decision this system makes — "should a human get paged?" — three buckets is enough. A more sophisticated classifier would have given me a continuous score I'd still threshold into the same three buckets. The Add-on collapsed the whole NLP layer into a single field on the inbound webhook, which was the right complexity for a first Twilio project.

### What happened when a student replied something the system couldn't classify?
The Marchex Add-on returned a neutral classification by default when confidence was low. Those messages still got stored and shown on the dashboard, but they didn't trigger a counselor page. The bias was intentional: false negatives (missing an at-risk student) are worse than false positives (paging a counselor on a message that turns out to be fine).

### How did counselors interact with the system day to day?
Most of the day-to-day interaction was just receiving SMS pages on their personal phones. The dashboard was used a few times a week — usually to review a student's recent trend before a scheduled check-in or to look back at the previous week in aggregate.

### How were students enrolled?
Through the counselor's office. A counselor would walk a new student through what the system did, get the parental-consent form signed, and add the student to the roster from the dashboard. The friction was deliberate — the consent conversation also doubled as a wellness-resources introduction.

### Why send only once a day?
The counselors and I agreed early that more than once a day would turn the system into noise and get students to ignore it. Once a day, at a predictable time, treats the check-in as a routine rather than an interruption.

### What did the on-duty rotation look like?
The `staff` collection stored each counselor along with their on-duty days. The alerter pulled the active staff member for the current day; outside school hours, alerts queued until the next school morning, with an explicit note in the SMS that the student had texted overnight.

### Why a single VM instead of something serverless?
Serverless functions on a free tier were limited and finicky for long-lived processes in 2018-2019. A small VM running a single `pm2`-managed Node process gave me a predictable home for both the webhook and the daily cron without juggling cold starts or background-job products.
