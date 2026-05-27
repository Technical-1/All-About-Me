# Project Q&A Knowledge Base

## Overview

MyVote Project V1 was a nonpartisan voter education website I built from scratch for the 2020 U.S. Presidential Election. The platform helped voters understand presidential candidates and key policy issues by presenting information in an accessible, balanced format with pro/con perspectives on each issue.

## Key Features

- **Candidate Profiles**: Comprehensive profiles of 10 presidential candidates with photos, backgrounds, and detailed policy positions
- **Policy Breakdowns**: Four major gun safety policy topics with descriptions, pro/con arguments, and cited sources
- **Stance Comparisons**: Visual comparison system showing each candidate's position on specific policies using thumbs up/down indicators
- **Interactive Survey**: "Share Your Voice" feature letting users express their own policy views

## Technical Highlights

### CSS Sprite Implementation
I used the New York Times' candidate tracker image sprite to display all candidate photos efficiently. By using `background-position` offsets on a single image, I could show any candidate's photo without making separate HTTP requests for each image. This technique significantly improved page load times.

### Progressive Disclosure UI
The policies page contains extensive research, but I implemented "Read more" buttons to hide detailed content by default. This made the page scannable while still providing depth for users who wanted it. Each expandable section toggles its own state independently.

### Modal-Style Stance Popups
Rather than navigating users away from their reading position, I created popup overlays that appear inline with each policy section. Users can quickly check where candidates stand on an issue and then close the popup to continue reading.

## Development Story

- **Timeline**: This was the initial version built while the founders were starting the organization
- **Hardest Part**: Organizing the vast amount of policy research into a user-friendly format. The founders provided detailed research documents that I had to structure into scannable, accessible web content while maintaining accuracy and balance.
- **Lessons Learned**: If I were to rebuild this today, I would use a templating system or framework to reduce HTML repetition. Each candidate profile and policy section follows the same structure, and a component-based approach would have made updates much easier.
- **Future Plans**: The original codebase was eventually replaced when the organization partnered with an independent contractor. I stayed on for a year afterward working with their team on the new version.

## Frequently Asked Questions

### How does the candidate search work?
The dropdown navigation includes a search input that filters the candidate list in real-time. As users type, the JavaScript `filterFunction()` iterates through all anchor tags in the dropdown and hides any that don't match the search text (case-insensitive).

### Why did you choose vanilla JavaScript over a framework?
At the time, I wanted to build everything from scratch to understand the fundamentals. The site's interactivity was simple enough that a framework would have been overkill. The toggle functions and DOM manipulation were straightforward to implement with plain JavaScript.

### How does the candidate photo sprite work?
The NYT maintains a single PNG image containing headshots of many political figures. By setting this as a CSS `background-image` and adjusting `background-position` to specific percentage values, I can display just the portion of the sprite containing each candidate's photo. This is more efficient than loading separate images.

### How were the policy pros and cons researched?
All policy research and candidate information was provided by the MyVote Project founders (David McAdams, Gita Stulberg, and Sari Kaufman). I was responsible for the technical implementation and design, not the content research. Each pro/con argument includes source citations linking to the original research.

### What was the most challenging part?
Structuring the HTML for the policies page was challenging because each policy section needed: a description with expandable content, a table of pro/con arguments (each with their own expandable content), and a popup overlay showing candidate stances. Managing all the unique IDs for the toggle functions required careful organization.

### What would you improve?
1. **Responsive design**: The site works on mobile but isn't optimized for it
2. **Accessibility**: Missing ARIA labels, keyboard navigation, and screen reader support
3. **Code organization**: Would use CSS classes instead of ID selectors, and template the repeating structures
4. **Build process**: Would add minification and image optimization
5. **Form handling**: The "Share Your Voice" survey doesn't actually submit anywhere - would need backend integration
