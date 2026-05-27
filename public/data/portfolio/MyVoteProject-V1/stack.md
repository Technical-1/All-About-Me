# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | HTML5 | - | Page structure and content |
| Language | CSS3 | - | Styling and layout |
| Language | JavaScript | ES5 | Interactive functionality |

## Frontend

- **Framework**: None (vanilla HTML/CSS/JS)
- **State Management**: DOM manipulation
- **Styling**: Custom CSS with inline styles where needed
- **Build Tool**: None (static files served directly)

## Infrastructure

- **Hosting**: GitHub Pages
- **CI/CD**: None (manual deployment via git push)
- **Domain**: Previously myvoteproject.com (CNAME removed)

## Development Tools

- **Package Manager**: None required
- **Linting**: None configured
- **Formatting**: Manual
- **Testing**: Manual browser testing

## CSS Techniques Used

| Technique | Purpose |
|-----------|---------|
| CSS Sprites | Single image containing all candidate photos, positioned via `background-position` |
| Flexbox | Layout for candidate grid and footer alignment |
| Fixed positioning | Floating "Share Your Voice" button and "Back to Top" button |
| Absolute positioning | Modal popups for candidate stances |
| Media queries | Not implemented (limited responsive design) |

## JavaScript Patterns

| Pattern | Purpose |
|---------|---------|
| Toggle functions | Show/hide dropdowns, modals, and expandable sections |
| DOM manipulation | `getElementById`, `classList.toggle`, style property changes |
| Event handlers | `onclick` attributes for button interactions |
| Form handling | Basic form with `onsubmit` return false to prevent page reload |

## External Resources

| Resource | Purpose |
|----------|---------|
| NYT Candidate Tracker Sprite | Candidate headshot images |
| Emojipedia CDN | Thumbs up/down emoji images |
| DuckDuckGo Image Proxy | Magnifying glass icon |
| EnjoyCSS Background | Decorative button background |

## Browser Compatibility

The site uses standard HTML5, CSS3, and ES5 JavaScript, making it compatible with:
- Chrome, Firefox, Safari, Edge (modern versions)
- Internet Explorer 11 (partial support)
- Mobile browsers (functional but not optimized)
