# Technology Stack

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.0.0 | UI framework with concurrent features |
| React Router | 7.0.0 | Client-side routing with lazy loading |
| Vite | 5.0.0 | Build tool and development server |
| TailwindCSS | 3.4.0 | Utility-first CSS framework |
| Framer Motion | 11.18.2 | Declarative animations and transitions |

### Why I Chose These

**React 19**: I wanted to use the latest stable React for access to improved concurrent rendering and the new use hook patterns. The project benefits from automatic batching and transition features for smooth 3D animations.

**React Router 7**: The latest React Router provides excellent TypeScript support and lazy route loading out of the box. I use lazy() imports for every page to minimize initial bundle size.

**Vite 5**: Vite's ESM-based dev server provides near-instant hot module replacement during development. The build process produces optimized chunks with tree-shaking. I chose this over Create React App for the significant speed improvements.

**TailwindCSS 3.4**: Utility classes make styling consistent and fast. I extended the default theme with custom Ethereum-branded colors (eth-purple, eth-violet, eth-cyan, eth-mint) and void-series dark backgrounds.

## 3D Graphics

| Technology | Version | Purpose |
|------------|---------|---------|
| Three.js | 0.175.0 | WebGL 3D rendering engine |
| @react-three/fiber | 9.5.0 | React renderer for Three.js |
| @react-three/drei | 10.7.7 | Useful helpers (Float, Sparkles, etc.) |

### Why I Chose These

**Three.js**: The most mature and well-documented WebGL library. I needed custom geometry for the Ethereum diamond logo, particle systems for transaction visualization, and animated ring meshes for the staking scene.

**React Three Fiber**: Bridges React's declarative model with Three.js's imperative API. I can manage 3D scene state with hooks and compose scenes from reusable components.

**Drei**: Provides ready-made abstractions like Float (automatic bob animation), Sparkles (particle effects), and OrbitControls. This saved significant development time for common 3D patterns.

## Data Management

| Technology | Version | Purpose |
|------------|---------|---------|
| TanStack React Query | 5.90.12 | Server state management and caching |
| Zustand | 5.0.10 | Lightweight client state (configured, minimal use) |

### Why I Chose These

**TanStack Query**: Handles all API fetching with automatic caching, background refetching, and error handling. I configured different stale times per data type (15 seconds for gas prices, 60 seconds for ETH price, 15 minutes for treasury balances).

**Zustand**: Included as a lightweight option if cross-component state becomes necessary. The current architecture handles most state through React Query and local component state.

## Shared Utilities

| Module | Purpose |
|--------|---------|
| `src/lib/utils.js` | Caching (localStorage), fetch with timeout, number/price/ETH formatting, address truncation, debounce, mobile detection |
| `src/lib/ethereumData.js` | Curated static content: timeline events, DeFi protocols, L2 solutions, wallet info, treasury data, NFT info |

## UI Components

| Technology | Version | Purpose |
|------------|---------|---------|
| Lucide React | 0.475.0 | Modern icon library |
| Recharts | 2.10.0 | React charting library |

### Why I Chose These

**Lucide React**: Feather-style icons with excellent tree-shaking. I import only the specific icons needed (Activity, Wallet, Coins, etc.) to minimize bundle size.

**Recharts**: Built on D3 with React components. I use it for price charts and staking calculators. It integrates naturally with React's declarative model.

## External APIs

| API | Purpose | Rate Limits |
|-----|---------|-------------|
| Alchemy | WebSocket transactions, blocks, NFT floor prices, treasury balances | 300 req/sec (free tier) |
| CoinGecko | ETH price, market cap, 24h volume | 10-30 calls/min |
| Coinbase | Fallback price data | Generous free tier |
| beaconcha.in | Network statistics, validator data | Generous free tier |
| Owlracle | Gas price estimates | Free tier available |
| Blocknative | Alternative gas estimates | Free tier available |
| Etherscan | Fallback gas oracle | Rate limited without key |

### API Strategy

I implemented a cascading fallback system:

1. **Primary source** (e.g., CoinGecko for prices)
2. **Secondary source** (e.g., Coinbase for prices)
3. **localStorage cache** (stale data is better than no data)
4. **Static fallback** (reasonable default values)

This ensures the UI always has data to display, even during API outages.

## Infrastructure & Deployment

| Service | Purpose |
|---------|---------|
| Vercel | Hosting and automatic deployments |
| Git/GitHub | Version control |

### Deployment Configuration

- **Automatic deployments**: Every push to main triggers a production build
- **Environment variables**: `VITE_ALCHEMY_API_KEY` configured in Vercel dashboard
- **Build output**: Static files served from Vercel's edge network

## Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | 9.39.0 | Code linting and style enforcement |
| PostCSS | 8.4.32 | CSS processing for Tailwind |
| Autoprefixer | 10.4.16 | Vendor prefixing |

### Dev Dependencies for Type Safety

- `@types/react` 19.0.0
- `@types/react-dom` 19.0.0
- `eslint-plugin-react-hooks` 5.2.0
- `eslint-plugin-jsx-a11y` 6.10.0

## Design System

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| eth-purple | #627EEA | Primary brand color |
| eth-violet | #7B61FF | Accent highlights |
| eth-cyan | #00D4FF | Success states, links |
| eth-mint | #00FFA3 | Positive indicators |
| void-900 | #0a0a0f | Deep background |
| void-700 | #151520 | Card backgrounds |

### Typography

| Family | Usage |
|--------|-------|
| Space Grotesk | Display headings |
| JetBrains Mono | Numbers, addresses, code |
| Inter | Body text |

## SEO & Social Previews

- **Open Graph meta tags**: Title, description, image (`eth-icon.png`) for rich link previews
- **Twitter Card meta tags**: Large summary card with image for Twitter/X sharing
- **Theme color**: `#627EEA` (eth-purple) for browser chrome coloring
- **Assets**: `eth-icon.png` for social previews, `og-image.svg` for Open Graph, `jk-logo.svg` for author branding in footer

## Limitations I Acknowledge

- **No backend**: This is a purely frontend application. All data comes from third-party APIs or is simulated.
- **API rate limits**: Free tier APIs have usage caps. Heavy traffic could hit rate limits.
- **WebSocket reliability**: Alchemy WebSocket can disconnect; the app falls back to simulated data.
- **3D performance**: Complex scenes may struggle on older mobile devices.
- **No user authentication**: No accounts, wallets, or persistent user data.
