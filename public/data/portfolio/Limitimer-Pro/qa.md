# Project Q&A

## Project Overview

**Limitimer** is a minimalist, mobile-friendly countdown timer web application designed for speakers, presenters, and anyone who needs a highly visible time-tracking tool. I built it to solve the problem of needing a simple, distraction-free timer that can be seen from across a room, survives accidental page refreshes, and provides clear visual urgency cues as time runs out. The target users are conference speakers, meeting facilitators, teachers, and anyone conducting time-boxed activities who needs an at-a-glance timer display.

## Key Features

### 1. Large, Readable Display
The timer displays in an extremely large font (400px on desktop, 10rem on mobile) making it visible from significant distances. I prioritized readability over aesthetics because the primary use case is glancing at a screen while presenting.

### 2. Color-Coded Urgency System
The entire page background changes color based on remaining time:
- **Green**: More than 2 minutes remaining - no rush
- **Yellow**: Between 1-2 minutes - start wrapping up
- **Red**: Less than 1 minute - urgent
- **Black**: Time expired

This peripheral-vision-friendly design means users don't need to read numbers to understand time status.

### 3. Refresh-Resistant Persistence
I implemented localStorage persistence using absolute timestamps. If you accidentally refresh the page or close and reopen the browser, the timer automatically resumes from where it should be - not where it was when interrupted.

### 4. Optional Audio Alert
Users can toggle an alarm sound that plays when the timer reaches zero. I included both MP3 and OGG formats for cross-browser compatibility. The checkbox defaults to "enabled" but users can disable it for quiet environments.

### 5. Mobile-Responsive Design
The interface adapts to mobile screens with adjusted font sizes and touch-friendly controls. The large display scales appropriately while remaining readable on smaller screens.

### 6. Stop and Reset Functionality
A dedicated Stop button allows users to cancel an active timer and clear the stored state. This is essential for situations where plans change mid-countdown.

## Technical Highlights

### Challenge 1: Accurate Timing Across Tab Suspension
**Problem**: Browsers throttle JavaScript timers in background tabs, causing countdown drift.

**Solution**: I store the absolute end timestamp rather than decrementing a counter. Each interval tick recalculates from `Date.now()`, ensuring the displayed time is always accurate regardless of how long the tab was inactive.

### Challenge 2: Seamless State Recovery
**Problem**: Users losing their timer to accidental page refreshes during critical moments.

**Solution**: I persist the target timestamp to localStorage immediately when a timer starts. On page load, the `DOMContentLoaded` handler checks for a valid saved timestamp and automatically resumes the countdown if time remains. The experience is seamless - users may not even notice a refresh occurred.

### Challenge 3: Cross-Browser Audio Playback
**Problem**: Audio format support varies across browsers, and autoplay policies can block playback.

**Solution**: I provide both OGG and MP3 sources in the `<audio>` element, letting the browser choose its preferred format. The `play()` call uses `.catch()` to gracefully handle autoplay restrictions without breaking the application.

### Innovative Approach: Full-Screen Visual Feedback
Rather than using a small timer widget, I made the entire viewport communicate timer status. This "ambient display" approach means the timer can be useful even in peripheral vision - a yellow background catching your eye is faster than reading "1:30" from across the room.

## Frequently Asked Questions

### Q1: Why didn't you use React, Vue, or another framework?
I intentionally avoided frameworks for this project. A countdown timer doesn't need component state management, virtual DOM diffing, or JSX compilation. The entire application is under 10KB - any framework would add more bytes than the app itself. Vanilla JavaScript gave me direct control over browser APIs and resulted in instant page loads with zero bundle complexity.

### Q2: How does the timer survive page refreshes?
When you start a timer, I immediately store the target end timestamp (not the remaining time) in localStorage. On page load, I check if there's a valid saved timestamp that's still in the future. If so, I calculate how much time remains and resume the countdown automatically. This absolute-timestamp approach also handles the case where you close and reopen your browser.

### Q3: Why did you choose those specific time thresholds for colors?
I chose 2-minute and 1-minute thresholds based on typical presentation contexts. Two minutes is enough time to reach a natural stopping point. One minute signals urgency without panic. These thresholds work well for 5-30 minute segments common in conferences and meetings. For longer timers, you might want different thresholds, but I optimized for the most common use case.

### Q4: Can I run multiple timers simultaneously?
No, this is intentionally a single-timer application. I considered multi-timer support but decided it would complicate the core use case. The full-screen color feedback only makes sense for one active countdown. If you need multiple timers, you could open multiple browser tabs, though each would have its own display.

### Q5: Does the timer work offline?
Yes, once the page is loaded, no network connection is required. All logic runs client-side, and localStorage persists locally. The only limitation is the initial page load - you need to fetch the HTML, CSS, JS, and audio files once. A future enhancement could add service workers for true PWA offline support.

### Q6: Why is the audio optional?
Several reasons: some environments require silence (recording studios, certain meetings), some users find audio alerts jarring, and browser autoplay policies can block unexpected audio anyway. Making it opt-in (defaulting to enabled) respects user preferences while providing the functionality for those who want it.

### Q7: How accurate is the countdown?
The countdown is accurate to within 1 second of real elapsed time. I use `setInterval` with a 1000ms interval, but importantly, I calculate remaining time from `Date.now()` on each tick rather than simply decrementing. This means even if JavaScript execution is delayed (due to CPU load or tab throttling), the displayed time catches up immediately.

### Q8: Can I customize the colors or time thresholds?
Currently, no - the thresholds are hardcoded. Adding customization would require additional UI for settings and more localStorage values to persist. I prioritized simplicity over configurability. However, the code is open source, so you can fork it and modify the threshold values in `script.js` (lines 26-32 and 98-104) to suit your needs.

### Q9: What happens if I set a very long timer (hours)?
It will work, but the display only shows minutes and seconds. A 2-hour timer would display as "120m 0s" which, while accurate, isn't the most readable format for long durations. I optimized the display for the common case of timers under 60 minutes.

### Q10: Is there a way to pause the timer?
Not currently. I implemented Stop (which cancels the timer) but not Pause (which would freeze and resume). Adding pause would require storing additional state (paused time, pause timestamp) and UI for resume. For the primary presentation-timer use case, pausing is rarely needed - you either run the clock or start over.
