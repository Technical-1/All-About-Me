---
title: "My First Repo Texted Me About College. I Never Stopped."
description: "My first GitHub project was a script that texted me when my college admission decision posted. Every project since has come from the same instinct: if something annoys me or I want to learn it, I build it, and I take it past the prototype to something real."
pubDate: 2026-06-12
tags: ["Automation", "Side Projects", "Learning by Building", "OCR", "Productivity"]
---

When I was applying to the University of Central Florida, I ran into the particular torture of rolling admissions. There is no decision day to count down to. Your answer just appears in the portal at some unannounced moment, any day across a window of weeks, with no email and no alert. The official advice is to keep checking.

So at first, that is what I did. I logged in every single day to find out whether I had gotten in. Log in, brace myself, see nothing, carry the not-knowing for another twenty-four hours. It was not the clicking that wore me down. It was the small daily dread of it, the pressure of checking over and over with no idea when it would end.

So of course, after about a week of that, I decided: eh, let's just automate it.

I wrote a Puppeteer automation script, running every twelve hours. It logs into the student portal through the SAML single sign-on, finds the decision panel, and reads it. The piece I am still a little proud of is how it reads it. The obvious approach is to scrape the DOM, but that portal is built on PeopleSoft, which means nested iframes and auto-generated class names that change out from under you. It is a moving target. So instead of fighting the markup, the script screenshots the decision panel and runs OCR on a fixed pixel region, with a little OpenCV preprocessing so the text actually comes through cleanly. Then, rather than write brittle rules to match exact phrases like "Congratulations" or "we regret," I ran the extracted text through sentiment analysis and let it judge whether the decision read as positive or negative. I did not need the precise wording, I just needed to know if it was good news. That whole approach, screenshot, read, and gauge the sentiment, turned out to be both simpler and more robust than scraping. Then it texts me the result.

And sure enough, that's how I found out I got into UCF. A text message, in the middle of class, that made me jump up out of my seat. Partly because the script actually worked, and partly because, hey, I got into my backup school.

But honestly, the script wasn't really about that one decision. Building it flipped a switch in my head. I had a growing pile of small computer tasks I was doing over and over by hand, and a strong instinct that this is exactly what computers are for. The UCF checker was the first time I acted on that instinct instead of just feeling it. Fittingly, it is also the very first thing I ever pushed to GitHub.

I never stopped.

## The pattern

Ever since, it's been the same move, over and over. Something annoys me, or there is something I want to understand, and it turns into a repo.

I wanted a digital wishlist that didn't feel like a chore, so I built one where you paste a product link and it scrapes it into a card you can organize and share. My favorite backgammon app started shoving in random AI features I never asked for and burying the part I actually used, so I built my own with the opponent I wanted and 3D dice because I felt like it. A friend complained that there were no good Christmas crosswords, so I built a generator that turns any theme you type into a playable puzzle. I wanted to actually learn the NATO phonetic alphabet, then Morse, then Braille and ASL, so instead of buying flashcards I built a spaced-repetition app to drill all of them.

That last one is the clearest version of how my brain works. When I want to learn something, I build it. Reading about a thing teaches me a little. Building the thing teaches me everything, because a computer refuses to let me stay vague. You cannot half-understand Morse code and still ship a working trainer for it. The build forces the understanding.

None of these started as a resume line or a business plan. They started as a small itch, and the fastest way I know to scratch an itch is to write code until it is gone.

## The part most people skip

Here's the part that actually sets me apart from the usual side-project story.

Most side projects die at the prototype. There is a weekend where the thing technically works once, on your machine, if you hold it right, and then it gets abandoned because the exciting part is over. For me that weekend is halftime, not the finish line.

The UCF checker could have been a throwaway cron job held together with tape. Instead it handled real SSO, preprocessed its screenshots so the OCR was genuinely reliable, and ran unattended for weeks without me babysitting it. The crossword generator is not a proof of concept. It has a timer, hints, sharing, printing, and a dark mode. The wishlist app is an installable PWA. The code-systems trainer has multiple study modes and real spaced repetition, not a single hardcoded deck.

I push these all the way to production on purpose, and the reason's simple: the itch was real, so the fix should be real too. A prototype solves the problem once. A finished thing solves it every time, for me and for anyone else who has the same annoyance. And the honest truth is that the last twenty percent is where the actual engineering lives. The edge cases, the reliability, the thing that keeps working when you are not watching it. That stretch is the difference between "I made a thing" and "I shipped a thing," and it is the part I actually want to get good at.

## One habit, repeated

I have written before about my push to finish every project I have ever started. This is the other half of that story. Not just that I finish them, but why they exist in the first place. They are not random. Every one of them began as something I wanted, or something I wanted to understand.

If you scroll through my GitHub it can look scattered. A business tax tool sits next to a collaborative whiteboard, next to ASCII art generators, next to a backgammon game, next to a Pokemon card tracker, next to a compiler I wrote from scratch. It looks like someone who can't pick a lane.

It's actually just one habit, repeated for years. I hit a small friction, or a gap in what I know, and instead of tolerating the friction or just reading about the gap, I build my way through it. Then I keep building until it is real.

That instinct started with a script that texted me about college. I still have not stopped.
