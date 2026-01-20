# Technology Stack

## Overview

Limitimer is built with vanilla web technologies - no frameworks, no build tools, no package managers. This was an intentional choice to keep the project simple, maintainable, and dependency-free.

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 | - | Document structure and semantics |
| CSS3 | - | Styling, responsive design, media queries |
| JavaScript (ES6+) | - | Application logic, DOM manipulation, timer functionality |

### HTML5

I use semantic HTML5 elements and features including:
- `<form>` with proper `<label>` associations for accessibility
- `<input type="number">` with `min` attribute for validation
- `<audio>` element with multiple source formats for cross-browser compatibility
- Viewport meta tag for mobile responsiveness

### CSS3

Key CSS features I implemented:
- Media queries for responsive design (`@media (max-width: 600px)`)
- Flexible font sizing with `rem` units
- Clean, minimal styling focused on readability

### JavaScript

I used modern JavaScript features while maintaining broad browser compatibility:
- `addEventListener` for event handling
- `localStorage` API for persistence
- `setInterval` / `clearInterval` for timer management
- Promise-based audio playback with `.catch()` for error handling

## Backend

**None** - This is a fully client-side application. All logic runs in the browser.

## Database

| Technology | Purpose |
|------------|---------|
| localStorage | Persisting timer state across page refreshes |

I chose localStorage because:
- No server infrastructure required
- Synchronous API is simple to use
- Sufficient storage for a single timestamp value
- Works offline

## Infrastructure & Deployment

| Component | Technology | Notes |
|-----------|------------|-------|
| Hosting | GitHub Pages | Free, automatic HTTPS, no configuration needed |
| CDN | GitHub's CDN | Included with GitHub Pages |
| CI/CD | None | Static files, no build step required |
| Domain | github.io subdomain | Using default GitHub Pages URL |

### Deployment Process

Deployment is as simple as pushing to the main branch. GitHub Pages automatically serves the static files. There is no build process, no compilation step, no environment variables to configure.

## Key Dependencies

**None** - This project has zero external dependencies.

### Why No Dependencies?

1. **Bundle Size**: The entire application is under 10KB. Any framework would be larger than the app itself.

2. **Maintenance**: No dependencies means no security vulnerabilities to patch, no breaking changes to handle, no `npm audit` warnings.

3. **Learning Value**: Building without frameworks forced me to understand browser APIs directly.

4. **Performance**: No framework overhead means instant page loads and immediate interactivity.

### Assets

| Asset | Source | License |
|-------|--------|---------|
| Alarm Sound | Mixkit | Mixkit Sound Effects Free License |

The alarm sound (`mixkit-classic-alarm-995`) is provided in both `.mp3` and `.ogg` formats for maximum browser compatibility.

## Browser Compatibility

I designed the application to work in all modern browsers:

| Browser | Support |
|---------|---------|
| Chrome | Full |
| Firefox | Full |
| Safari | Full |
| Edge | Full |
| Mobile browsers | Full (responsive design) |

### Compatibility Considerations

- Used `var` declarations for broader compatibility (though modern browsers all support `let`/`const`)
- Provided both OGG and MP3 audio formats
- Used `-webkit` prefixes where necessary via standard CSS
- Tested responsive breakpoints on various device sizes

## Development Environment

No special setup required:
- Any text editor works
- No node_modules to install
- No build commands to run
- Just open `index.html` in a browser

To develop locally:
```bash
# Clone the repository
git clone https://github.com/Technical-1/OpenSource-Limitimer.git

# Open in browser
open index.html
# or
python -m http.server 8000  # then visit localhost:8000
```

## Future Considerations

If I were to expand this project, I might consider:
- **TypeScript**: For better type safety as complexity grows
- **PWA**: Service workers for true offline support and installability
- **Testing**: Jest or similar for unit tests on timer logic

However, for the current scope, vanilla web technologies remain the best choice.
