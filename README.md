# Jacob Kanfer’s Personal Website

A polished personal website showcasing my projects, experience, and resume, built with HTML, CSS, and JavaScript.  
[**View Live**](https://jacobkanfer.com)

## Table of Contents
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Acknowledgments](#acknowledgments)

---

## Features
1. **Dynamic “About Me”**: Showcases personal background, degree info, and new career position.  
2. **Projects Section**: Dynamically pulls GitHub repo data, displays language badges and last updated times.  
3. **Experience Timeline**: Lays out professional and leadership roles with a responsive timeline.  
4. **AOS (Animate on Scroll)**: Smooth fade-in/up animations on each section.  
5. **Dark Mode Toggle**: Uses `localStorage` to remember the user’s preference.  
6. **Responsive Design**: Mobile-friendly layout, flexbox/grid usage.  
7. **Cached GitHub Data**: Minimizes API calls, reducing rate-limit issues.  

---

## Technologies Used
- **HTML5 & CSS3**: Core structure and styling.  
- **JavaScript**: Dynamic GitHub fetch, local storage caching, dark mode, etc.  
- **AOS**: Scroll animations ([AOS library](https://michalsnik.github.io/aos/)).  
- **Typed.js**: Animated text effect in the hero ([Typed.js](https://github.com/mattboldt/typed.js/)).  
- **GitHub API**: Fetches repository data, languages, and last-updated info.  
- **GitHub Pages**: Free static site hosting.  

---

## Private Repo Sync (Nightly)
- A GitHub Action (`.github/workflows/sync-private-repos.yml`) runs nightly and on manual dispatch to refresh `data/private_repos.json` with private repo metadata and language breakdowns.
- It uses a Personal Access Token stored in a repo secret named `GH_PRIVATE_TOKEN`.
  - Recommended scopes: **repo** (for fine-grained, select contents: read, metadata: read, commit statuses optional).
- The site automatically merges this JSON with live public repo data in `main.js`; no additional configuration is required once the secret is set.

---

## Acknowledgments
- **AOS** ([link](https://michalsnik.github.io/aos/)): Animate on Scroll library.  
- **Typed.js** ([link](https://github.com/mattboldt/typed.js/)): Hero typing effect.  
- **SebKay’s Card Style**: ([link](https://sebkay.com)): Inspired the project card layout.  
- **GitHub REST API**: Powers the repo data for languages, last updated timestamps.  
