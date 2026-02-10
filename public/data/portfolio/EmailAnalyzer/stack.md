# Technology Stack

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI framework with concurrent rendering |
| TypeScript | 5.9 | Type safety and developer experience |
| Vite | 7.2 | Build tool and dev server |
| Tailwind CSS | 4.1 | Utility-first styling |
| React Router | 7.10 | Client-side routing |

### Why React 19

I chose React 19 for its concurrent rendering capabilities, which are essential when processing large email archives. The improved automatic batching helps maintain UI responsiveness during heavy data operations.

### Why TypeScript

Given the complexity of email parsing and the multiple data types involved (emails, accounts, purchases, subscriptions, etc.), TypeScript provides invaluable compile-time safety. It catches type mismatches early and makes refactoring much safer.

### Why Vite

Vite's instant hot module replacement makes development significantly faster compared to webpack-based setups. The production builds are also well-optimized with tree shaking and code splitting.

## State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| Zustand | 5.0 | Global state management |
| Dexie.js | 4.2 | IndexedDB abstraction |

### Why Zustand over Redux

I chose Zustand because:

- **Less boilerplate**: No action types, reducers, or dispatch calls
- **No Context wrapper**: Components can access state without being wrapped in providers
- **TypeScript integration**: Better out-of-the-box TypeScript support
- **Performance**: Built-in selector system prevents unnecessary re-renders

### Why Dexie.js

Dexie provides a much cleaner API than raw IndexedDB while adding essential features:

- Promise-based API instead of events
- Schema versioning for migrations
- Compound indexes for complex queries
- Bulk operations for performant batch inserts

## Data Visualization

| Technology | Version | Purpose |
|------------|---------|---------|
| Recharts | 3.6 | Charts and graphs |

### Why Recharts

I selected Recharts for the analytics dashboard because:

- Built specifically for React with declarative components
- Responsive charts work well on mobile
- Good performance with moderate datasets
- Supports the chart types I needed (bar, line, area, heatmap)

## Performance Optimization

| Technology | Version | Purpose |
|------------|---------|---------|
| @tanstack/react-virtual | 3.13 | Virtual scrolling |
| JSZip | 3.10 | ZIP file extraction |

### Why TanStack Virtual

For email archives with tens of thousands of messages, rendering all items would freeze the browser. TanStack Virtual:

- Only renders visible items plus overscan buffer
- Maintains smooth 60fps scrolling
- Supports dynamic row heights
- Integrates well with React

## Utilities

| Technology | Version | Purpose |
|------------|---------|---------|
| date-fns | 4.1 | Date formatting and manipulation |
| DOMPurify | 3.3 | HTML sanitization |
| lucide-react | 0.561 | Icon library |
| react-dnd | 16.0 | Drag and drop (email organization) |

### Why DOMPurify

Emails often contain HTML with potentially malicious scripts. DOMPurify sanitizes the HTML before rendering to prevent XSS attacks while preserving safe formatting.

## Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | 4.0 | Unit and integration testing |
| @testing-library/react | 16.3 | React component testing |
| fake-indexeddb | 6.2 | IndexedDB mocking |
| jsdom | 27.3 | DOM environment for tests |

### Why Vitest over Jest

Vitest integrates seamlessly with Vite and shares its configuration. It's also faster for projects already using Vite and has better ESM support.

## Infrastructure & Deployment

| Service | Purpose |
|---------|---------|
| Vercel | Hosting and deployment |
| GitHub | Version control |

### Why Vercel

Vercel provides:

- Zero-configuration deployments for Vite projects
- Global CDN for fast asset delivery
- Automatic preview deployments for PRs
- Free tier suitable for static sites

## Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| ESLint | 9.39 | Code linting |
| typescript-eslint | 8.46 | TypeScript-specific linting |

## Key Dependencies Explained

### JSZip (3.10)

Essential for parsing OLM files (which are ZIP archives containing XML) and Gmail Takeout exports. Processes archives entirely in-browser without server upload.

### react-dnd (16.0)

Enables drag-and-drop email organization between folders. I chose this over HTML5 drag-and-drop for better cross-browser consistency and more flexible drop targets.

### lucide-react (0.561)

Provides the icon set for the UI. I chose Lucide over Font Awesome or Material Icons because:

- Consistent, modern design
- Tree-shakeable (only used icons are bundled)
- React-native components (not just icon fonts)

## Web Workers

| Technology | Purpose |
|------------|---------|
| Parser Worker | Background thread for parsing large email archives without blocking the UI |

### Why Web Workers

Parsing email archives with tens of thousands of messages can take significant time. Running this in the main thread would freeze the browser. The parser Web Worker (`workers/parserWorker.ts`) handles file reading and parsing in a background thread, communicating progress and results back via message passing.

## Bundle Considerations

The production bundle is optimized through:

- Code splitting by route (React Router lazy loading)
- Tree shaking of unused code
- Minification and compression
- Dynamic imports for heavy components
- Web Worker for offloading heavy parsing

The initial bundle focuses on the import/upload experience, with analytics and settings pages loaded on demand.
