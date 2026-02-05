# BTC Explorer - Technology Stack

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | Core UI framework |
| React Router DOM | 6.20.0 | Client-side routing with nested routes |
| Vite | 5.0.0 | Build tool and dev server |
| Tailwind CSS | 3.3.6 | Utility-first styling |

### Why React 18

I chose React 18 for several reasons:

- **Concurrent rendering** enables smooth UI updates even during heavy computations like 3D rendering
- **Suspense** works perfectly with lazy-loaded components, improving initial load time
- **Automatic batching** reduces unnecessary re-renders when multiple state updates occur
- The ecosystem has excellent support for real-time data visualization

### Why Vite

Vite provides:

- Near-instant hot module replacement during development
- Optimized production builds with automatic code splitting
- Native ES modules support
- Simple configuration compared to webpack

### Why Tailwind CSS

- Rapid prototyping with utility classes
- Custom design system (Bitcoin orange palette, void/dark theme)
- Purges unused CSS in production for minimal bundle size
- Easy responsive design with mobile-first breakpoints

## 3D Visualization

| Technology | Version | Purpose |
|------------|---------|---------|
| Three.js | 0.160.0 | WebGL 3D graphics engine |
| React Three Fiber | 8.15.0 | React renderer for Three.js |
| React Three Drei | 9.88.0 | Useful helpers and abstractions |

### Why Three.js with React Three Fiber

I wanted to create an immersive visualization of Bitcoin transactions and the blockchain network. Three.js is the most mature WebGL library, and React Three Fiber lets me write 3D scenes using familiar React patterns:

- Declarative component-based 3D scenes
- Automatic disposal and memory management
- Easy integration with React state and hooks
- The `Drei` library provides pre-built components like `OrbitControls`, `Float`, and texture loaders

**3D Features I Built:**
- Animated spinning Bitcoin logo with texture mapping
- Particle system representing network transactions
- Blockchain node network visualization with connections
- Real-time transaction flow visualization

## Data Management

| Technology | Version | Purpose |
|------------|---------|---------|
| TanStack Query | 5.90.12 | Server state management and caching |
| Custom Hooks | - | WebSocket connections, data transformation |

### Why TanStack Query

Managing real-time data from multiple APIs requires robust caching and synchronization. TanStack Query provides:

- Automatic background refetching with configurable intervals
- Deduplication of identical requests
- Optimistic updates and stale-while-revalidate pattern
- Built-in loading and error states
- Window focus refetching (I disable this for better UX)

### Custom Data Hooks

I built several custom hooks in `useBlockchain.js`:

- `useBlockchainWebSocket()` - WebSocket connection to Blockchain.info for live transactions
- `useMempoolData()` - Polling mempool.space API for network stats
- `useBitcoinPrice()` - Multi-source price fetching (CoinGecko primary, Coinbase fallback)
- `useMstrPrice()` - MSTR stock price via Vercel serverless function (Yahoo Finance → Stooq fallback chain)

## Animation & UI

| Technology | Version | Purpose |
|------------|---------|---------|
| Framer Motion | 10.16.0 | Animation library |
| Lucide React | 0.294.0 | Icon library |
| Recharts | 2.10.0 | Charting library |

### Why Framer Motion

For smooth UI animations, Framer Motion offers:

- Simple declarative API with `initial`, `animate`, `exit` props
- Layout animations for list reordering (transaction stream)
- AnimatePresence for enter/exit animations
- Spring physics for natural-feeling motion

### Why Recharts

For the Power Law chart and Treasury visualizations, I needed a React-native charting solution:

- Composable component-based API
- Built-in responsive container
- Good support for logarithmic scales (essential for Bitcoin price charts)
- Custom styling that matches my dark theme

## Infrastructure & Deployment

| Technology | Purpose |
|------------|---------|
| Vercel | Frontend hosting with edge network + serverless functions |
| Vercel Serverless Functions | MSTR stock price API proxy (`/api/mstr`) |
| Cloudflare Workers | API proxy functions for treasury and price data |
| GitHub | Source control |

### Why Vercel

- Zero-config deployment for Vite/React apps
- Global edge network for fast loading worldwide
- Automatic HTTPS and CDN caching
- **Serverless Functions** for same-origin API proxying (eliminates CORS issues)
- CDN-level response caching for serverless functions (`s-maxage`, `stale-while-revalidate`)
- Easy environment variable management
- Free tier sufficient for this project

### Why Cloudflare Workers

I built lightweight proxy workers to solve several problems:

1. **CORS restrictions** - BitcoinTreasuries.net and CoinGecko APIs block browser requests
2. **Rate limiting** - Aggregate requests to stay under API limits
3. **Fallback handling** - Try multiple data sources automatically
4. **Response caching** - Cache responses at the edge

**Workers I deployed:**
- `treasuries-proxy` - Proxies BitcoinTreasuries.net and aggregates data
- `treasuries-proxy-coingecko` - Handles CoinGecko API with caching

### Why Vercel Serverless Functions (for MSTR)

Yahoo Finance began returning `429 Too Many Requests` for requests without a proper `User-Agent` header, and Stooq lacks CORS headers entirely. Instead of relying solely on external Cloudflare Workers, I added a Vercel serverless function at `/api/mstr` that:

1. **Runs server-side** - Can set `User-Agent` headers that browsers can't for cross-origin requests
2. **Is same-origin** - No CORS preflight needed, the browser treats it like any other page resource
3. **Has CDN caching** - Vercel caches responses for 60s with 120s stale-while-revalidate
4. **Has built-in fallback** - Tries Yahoo Finance first, falls back to Stooq

## External Data Sources

| API | Data Provided | Rate Limits |
|-----|---------------|-------------|
| Mempool.space | Block height, fees, mempool stats, difficulty | Generous public API |
| Blockchain.info WebSocket | Live unconfirmed transactions, new blocks | Real-time stream |
| CoinGecko | Bitcoin price, 24h change | 10-30 calls/minute |
| Coinbase | Spot price (fallback) | Public API |
| Yahoo Finance | MSTR stock price (via `/api/mstr` serverless function) | Rate limited; requires User-Agent |
| Stooq | MSTR price (fallback via `/api/mstr`) | No CORS; server-side only |
| BitcoinTreasuries.net | Corporate, ETF, and government holdings (100+ entities) | Via proxy, 6h cache |

## Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | 9.39.1 | Code linting and quality |
| PostCSS | 8.4.32 | CSS processing |
| Autoprefixer | 10.4.16 | CSS vendor prefixes |
| TypeScript (types) | 5.5.2 | Type definitions for workers |

### Code Quality

I configured ESLint with:
- `eslint-plugin-react-hooks` for proper dependency arrays
- `eslint-plugin-jsx-a11y` for accessibility compliance
- `eslint-plugin-react-refresh` for hot reload compatibility
- `eslint-plugin-react` for React best practices
- `globals` for environment-specific global definitions

## Bundle Size Considerations

To keep the application fast, I implemented several optimizations:

1. **Lazy loading** - All page components load on-demand
2. **Code splitting** - Vite automatically splits by route
3. **Tree shaking** - Unused code eliminated in production
4. **CSS purging** - Tailwind removes unused classes

The Three.js bundle is significant (~500KB), but I only load it on pages that need 3D visualization. The core app bundle stays under 150KB gzipped.

## Key Dependencies Summary

**Production Dependencies:**
```json
{
  "@react-three/drei": "^9.88.0",
  "@react-three/fiber": "^8.15.0",
  "@tanstack/react-query": "^5.90.12",
  "framer-motion": "^10.16.0",
  "lucide-react": "^0.294.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "recharts": "^2.10.0",
  "three": "^0.160.0"
}
```

**Dev Dependencies:**
```json
{
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@vitejs/plugin-react": "^4.2.0",
  "autoprefixer": "^10.4.16",
  "eslint": "^9.39.1",
  "eslint-plugin-jsx-a11y": "^6.10.2",
  "eslint-plugin-react": "^7.37.5",
  "eslint-plugin-react-hooks": "^7.0.1",
  "eslint-plugin-react-refresh": "^0.4.24",
  "globals": "^16.5.0",
  "postcss": "^8.4.32",
  "tailwindcss": "^3.3.6",
  "vite": "^5.0.0"
}
```
