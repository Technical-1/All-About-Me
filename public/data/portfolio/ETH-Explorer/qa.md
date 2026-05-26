# Project Q&A

## Overview

ETH Explorer is an Ethereum block explorer and educational platform that pairs live mainnet data with interactive 3D visualizations and curated content covering topics from EVM internals to Layer 2 scaling. The interesting technical angle is the multi-source data layer: every read path has 2–5 fallback providers and a localStorage cache, so the UI keeps rendering meaningful data even when the primary provider is down or rate-limited.

## Problem Solved

Etherscan and other production block explorers are powerful but information-dense, and they don't teach the concepts behind what they're showing. I wanted a single site that newcomers could open and immediately *see* Ethereum doing things — pending transactions flowing, gas prices moving, blocks landing — while also having proper explanations one click away.

## Target Users

- **Crypto-curious newcomers** — want to understand what Ethereum actually does without reading a whitepaper first
- **Developers learning the EVM** — get a feel for live transaction patterns and L2 landscape before diving into Solidity
- **Anyone evaluating staking or DeFi** — interactive APY calculator, TVL data, and treasury balances in one place

## Key Features

### Live transaction feed
Pending transactions stream in via the Alchemy `alchemy_pendingTransactions` WebSocket subscription. Each tx is classified (Transfer / Swap / Mint / Contract / Stake) and routed into a 3D particle system that physically represents activity. Falls back to simulated traffic when no API key is configured.

### Gas tracker with five-source cascade
Real-time gas pricing tries Alchemy first, then Owlracle, Blocknative, Etherscan, and finally beaconcha.in before reverting to a cached value. Updates every 15 seconds.

### NFT floor prices for 15 collections
Calls Alchemy's `getFloorPrice` for a curated list (BAYC, Punks, Azuki, etc.) with 15-minute localStorage caching to avoid burning the free-tier rate limit on idle traffic.

### Treasury balances for 30+ entities
Tracks ETH holdings for exchanges, DAOs, foundations, ETFs, and even publicly known seized-asset wallets. Balances refresh on a 15-minute interval and persist across sessions.

### Interactive staking calculator
APY math for daily / monthly / yearly rewards with compound-interest mode and a comparison row across solo staking, Lido stETH, and Rocket Pool rETH (real APRs pulled from each provider's API).

### History timeline
80+ curated events from the 2013 whitepaper through the 2025 Pectra upgrade, rendered as a navigable timeline rather than a wall of text.

## Technical Highlights

### Refs-driven 3D updates to avoid React re-renders
The transaction-flow scene receives new transactions at ~1–5 Hz. Letting that trigger React reconciliation on every tx would jank the Three.js canvas. Instead, transactions are pushed into a `useRef` array that the scene reads inside `useFrame()` — particles spawn on the next animation frame without React ever knowing about it. See `src/components/ThreeScenes.jsx` (`TransactionFlowScene`).

### Cascading fallback fetch utility
`src/lib/utils.js` exposes `fetchWithTimeout()` plus `getCached()`/`setCached()` helpers with configurable TTLs. Every data hook composes them into a deterministic chain — primary API → secondary API → localStorage → static default — so a hook can guarantee it returns *something* every render without leaking try/catch into the calling component.

### Lazy-loaded routes with Suspense boundaries
All 12 pages in `src/pages/` are wrapped in `React.lazy()` with a shared `SceneLoader` fallback. Initial load is ~200KB gzipped; Three.js, Recharts, and Framer Motion only ship when the user navigates to a page that needs them.

### Demo mode without an API key
The Alchemy hooks check for `VITE_ALCHEMY_API_KEY` and, if absent, switch every data source to a realistic simulator (Poisson-distributed pending transactions, plausible gas-price drift, etc.). The whole UI works on a clone-and-`npm run dev` with no signup.

## Engineering Decisions

### No backend
- **Constraint**: Educational content with no user accounts, no auth, no per-user state to persist server-side.
- **Options**: Node/Express proxy to hide API keys, serverless functions on Vercel, or pure-frontend with public APIs.
- **Choice**: Pure frontend, deployed as static files to Vercel.
- **Why**: All required data is available from CORS-open public APIs. Adding a backend would buy nothing except a place to hide the Alchemy key — and the key is rate-limited per origin anyway, so exposing it via `VITE_*` is acceptable.

### Multi-source fallback over a single "best" provider
- **Constraint**: Free-tier APIs (CoinGecko, beaconcha.in, Etherscan) rate-limit aggressively and occasionally 5xx. The UI must never show "—" on the homepage.
- **Options**: Pay for a higher-tier single provider, or chain multiple free providers as fallbacks.
- **Choice**: Cascade across 2–5 providers per data type with a localStorage cache as the final safety net.
- **Why**: Keeps the project free to run and surfaces a useful side effect — the cache means a returning user sees plausible data immediately, before any network call resolves.

### Zustand stores configured but unused
- **Constraint**: Most state is either server-fetched (React Query handles it) or component-local. Cross-component state needs are minimal.
- **Options**: Adopt Redux/Zustand upfront, or stick to local state and React Query.
- **Choice**: Defined Zustand stores in `src/store/useStore.js` with persistence middleware, but didn't wire them into components.
- **Why**: Wanted the scaffolding ready if a future feature (saved watchlists, preferred fiat currency) needs persisted client state, without paying the indirection cost today.

### React Three Fiber over raw Three.js
- **Constraint**: Multiple 3D scenes share components and need to react to data hooks.
- **Options**: Hand-rolled Three.js with manual lifecycle management, or React Three Fiber.
- **Choice**: R3F with `@react-three/drei` helpers (Float, Sparkles, OrbitControls).
- **Why**: Lets scenes consume React hooks (`useFrame`, custom data hooks) and compose like normal components. The performance overhead vs. raw Three.js is negligible at this scene complexity.

## Frequently Asked Questions

### How does the live transaction feed actually work?
The app opens a WebSocket to `wss://eth-mainnet.g.alchemy.com/v2/{key}` and subscribes to `alchemy_pendingTransactions`. Each incoming tx is decoded (value, to, gas) and classified by a heuristic on the `to` address and input data — ERC-20 transfers, Uniswap routers, NFT mints, and staking deposits each have known method signatures. The classified tx is pushed into both the on-screen list and the 3D scene's transaction ref.

### Why does the gas tracker hit five different APIs?
No single free gas oracle is reliable. Alchemy's `eth_gasPrice` is fast but lags during fee spikes; Owlracle aggregates from several sources but rate-limits anonymous users; Blocknative and Etherscan require keys for sustained use. By falling through in priority order, the tracker stays current without locking the project to any one provider.

### How accurate are the treasury balances?
For entities with public on-chain addresses (Lido DAO, ETF custody wallets, the Ethereum Foundation), balances are queried live from Alchemy and are accurate to the latest block. For entities with publicly known but unverifiable wallet sets (exchange cold storage, government seizures), the list of addresses is curated from blockchain-analytics sources and balances are still live — but the *completeness* of the address set is approximate and marked as such in the UI.

### Why React 19 specifically?
The 3D scenes benefit from automatic batching during rapid state updates — multiple particle spawns in the same animation frame collapse into one render pass. React 19's transition primitives also keep the page-switch animation smooth while the next page's data hooks initialize.

### What happens on a device without WebGL?
Every `<Canvas>` is wrapped in `SceneErrorBoundary`. When Three.js throws (no WebGL context, blocked GPU, etc.), the boundary catches it and renders a static fallback panel. The data hooks and non-3D UI keep working.

### Can I fork this for another chain?
The data layer is chain-specific (Alchemy endpoints, beaconcha.in for validators, Lido/Rocket Pool for staking APRs) but the visualization layer, navigation structure, and shared utilities in `src/lib/utils.js` are chain-agnostic. Swapping in BSC, Solana, or an L2 means replacing the contents of `src/hooks/useBlockchain.js` and the static reference data in `src/lib/ethereumData.js`.

### Why is the Alchemy key exposed via `VITE_ALCHEMY_API_KEY`?
Vite's `VITE_*` prefix ships variables to the browser bundle by design — there is no backend to keep secrets on. Alchemy keys are origin-rate-limited and can be locked to specific allowed domains in the Alchemy dashboard, so a leaked key from `eth-explorer-brown.vercel.app` is only usable from that origin.

### How big is the bundle and why?
~800KB gzipped total, ~200KB on initial load thanks to per-route code splitting. Three.js plus `@react-three/fiber` and `drei` account for most of it; Recharts is the next biggest chunk. The trade-off is conscious — the 3D visualization is the project's distinguishing feature.
