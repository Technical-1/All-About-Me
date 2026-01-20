# BTC Explorer - Project Q&A

## Project Overview

BTC Explorer is a comprehensive Bitcoin blockchain explorer and educational platform that I built to visualize Bitcoin's activity in real-time. The application streams live transactions from the mempool, displays network statistics, tracks corporate Bitcoin holdings, and provides educational content about Bitcoin technology. I designed it for Bitcoin enthusiasts, investors, and anyone curious about how the Bitcoin network operates, whether they are technical or non-technical users.

**Live Demo:** [btcexplorer.io](https://btcexplorer.io)

## Key Features

### Real-Time Transaction Stream
The Live page connects via WebSocket to stream unconfirmed transactions directly from the Bitcoin network. Users can watch transactions flow in real-time, see BTC values, transaction sizes, and input/output counts. I implemented pause/resume controls and automatic reconnection for a smooth experience.

### 3D Blockchain Visualizations
Using Three.js and React Three Fiber, I created immersive 3D visualizations including an animated Bitcoin logo, a particle system representing network activity, and a blockchain node network. Users can toggle between a list view and 3D transaction flow visualization.

### Power Law Price Model
I implemented the Bitcoin power law model with 95.65% R-squared accuracy. Users can explore projected prices, calculate potential returns on investments, and view price milestones. The logarithmic chart shows the model trajectory from 2010 to 2040.

### Corporate Treasury Tracker
This feature tracks 50+ entities holding Bitcoin including public companies (Strategy, Tesla), ETFs (IBIT, FBTC, GBTC), governments (US, El Salvador), and private entities. I pull data from BitcoinTreasuries.net via a Cloudflare Worker proxy and display it with interactive charts and filters.

### Network Statistics Dashboard
The navigation bar and Live page display real-time network metrics: current block height, BTC price, mempool size, fee estimates, hashrate, and difficulty adjustment progress.

### Educational Content
I curated 70+ historical Bitcoin events from the 2008 whitepaper to the 2024 halving. The Learn section explains Bitcoin technology including PoW, SHA-256, SegWit, Taproot, and Lightning Network.

### Wallet Guide
A comprehensive comparison of hardware wallets (Ledger, Trezor, Coldcard) and software wallets (Sparrow, BlueWallet, Phoenix) with features, pros/cons, and direct links.

## Technical Highlights

### Challenge: Real-Time Data Without a Backend
I needed to display live blockchain data without maintaining server infrastructure. My solution was to connect directly to public APIs and WebSockets from the browser, with Cloudflare Workers handling CORS-restricted APIs. This keeps hosting costs at zero while providing real-time functionality.

### Challenge: Multiple Unreliable Data Sources
Bitcoin data comes from various APIs with different reliability and rate limits. I built a multi-source fallback system: CoinGecko primary with Coinbase backup for prices, Yahoo Finance primary with Stooq backup for MSTR stock, and aggressive client-side caching to handle API outages gracefully.

### Challenge: Performance with 3D Graphics
Three.js is heavy and could slow initial page load. I implemented code splitting so 3D components only load when users navigate to views that need them. The lazy loading keeps the critical path fast while still offering rich visualizations.

### Challenge: Keeping Data Fresh
I used TanStack Query with visibility-based refetching. Data refreshes automatically when the tab is visible but pauses when hidden, saving bandwidth and API calls. LocalStorage caching with TTL ensures users see recent data even on return visits.

### Innovative Approach: WebSocket with Fallback
The live transaction stream uses WebSockets for real-time data, but I implemented a REST API fallback for recent blocks if the WebSocket connection fails or takes too long to receive blocks. This hybrid approach ensures users always see meaningful data.

## Frequently Asked Questions

### 1. Why did you build this instead of using existing blockchain explorers?

Most blockchain explorers focus on transaction lookup and block details. I wanted to create an experience that helps people understand Bitcoin at a visceral level - watching transactions flow in real-time, visualizing the network in 3D, and seeing how the price follows mathematical patterns. It is as much an educational tool as a utility.

### 2. How accurate is the live transaction data?

The transactions are streamed directly from Blockchain.info's public WebSocket API. They represent actual unconfirmed transactions entering the mempool in real-time. Block confirmations and network stats come from Mempool.space, which runs production-grade Bitcoin infrastructure.

### 3. Is the Power Law model financial advice?

No. I clearly state throughout the application that this is for educational purposes only. The power law model is a statistical observation that has held for 15+ years, but past performance does not guarantee future results. Users should do their own research before making investment decisions.

### 4. How do you handle API rate limits?

I implemented several strategies: TanStack Query deduplicates requests and caches responses, LocalStorage persists data across sessions with TTL validation, Cloudflare Workers cache responses at the edge, and I use multiple fallback sources when primary APIs fail or rate limit.

### 5. Why Three.js instead of WebGL directly or another library?

Three.js has the best balance of power and developer experience. React Three Fiber lets me write 3D scenes using familiar React patterns, making the code maintainable. The Drei library provides production-ready helpers. Direct WebGL would have taken much longer for similar results.

### 6. What would you add if you had more time?

I would add historical price chart overlays with the power law model, a personal portfolio tracker with alerts, deeper Lightning Network analytics, and possibly a mobile app using React Native with shared components. I would also add full offline support with service workers.

### 7. How do you ensure accessibility?

I implemented keyboard navigation throughout, proper focus states for all interactive elements, skip-to-content links, ARIA labels on icon buttons, and sufficient color contrast. The ESLint jsx-a11y plugin catches accessibility issues during development.

### 8. Why Vercel and Cloudflare instead of a traditional backend?

Cost and simplicity. Vercel's free tier handles the static site hosting perfectly, and Cloudflare Workers' free tier is sufficient for my API proxy needs. This serverless architecture means I pay nothing to run the application and have no servers to maintain.

### 9. How current is the corporate treasury data?

The treasury data comes from BitcoinTreasuries.net, which aggregates information from SEC filings, company announcements, and blockchain analysis. My proxy caches this data for 6 hours to reduce load on their servers. For real-time critical decisions, users should verify with primary sources.

### 10. What was the hardest part of building this?

Managing the complexity of multiple real-time data sources with different update frequencies, reliability, and formats while keeping the UI responsive and the code maintainable. Getting the caching strategy right took several iterations to balance freshness with reliability.
