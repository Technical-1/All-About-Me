# Tech Stack

## Overview

A full-stack web application featuring a real-time multiplayer backgammon game with AI opponents, 3D graphics, and persistent storage.

## Frontend

### Framework

- **Next.js 14.2.35** - React framework with App Router
  - I chose Next.js for its excellent developer experience and built-in optimizations
  - App Router provides file-based routing and React Server Components support
  - Built-in image optimization and code splitting

### UI Library

- **React 18** - Component-based UI
  - Concurrent features enable smooth animations
  - Hooks for clean state management

### Language

- **TypeScript 5** - Type safety throughout
  - Catches game logic errors at compile time
  - Self-documenting types for game state

### Graphics

- **Three.js 0.182.0** - 3D rendering
  - Powers the hero background animation on the home page
  - Used for potential future enhancements
- **HTML5 Canvas API** - 2D board rendering
  - Direct pixel manipulation for game board
  - Smooth piece movement animations
- **CSS 3D Transforms** - Dice animations
  - Hardware-accelerated 3D dice rotations
  - Simpler than Three.js for basic 3D effects

### Styling

- **Custom CSS** - Hand-crafted utility classes
  - No CSS framework dependency
  - Dark theme with gold/copper accents
  - Responsive design with mobile-first approach

## Backend

### Real-Time Server

- **PartyKit 0.0.115** - WebSocket infrastructure
  - Built on Cloudflare Workers and Durable Objects
  - Handles game rooms, matchmaking, and state synchronization
  - Automatic reconnection handling
  - Deployed to edge for low latency

### WebSocket Client

- **PartySocket 1.1.10** - React WebSocket hook
  - Automatic reconnection with exponential backoff
  - Type-safe message passing

## Database / Storage

### Client-Side Persistence

- **localStorage** - Game state and statistics
  - Up to 5 saved games per browser
  - Win/loss statistics tracking
  - Player preferences (name, settings)

### Server-Side Persistence

- **PartyKit Durable Storage** - Room state
  - Persists game state across disconnections
  - 5-minute timeout for abandoned rooms
  - Chat history (last 100 messages)

## Infrastructure and Deployment

### Frontend Hosting

- **Vercel** - Next.js deployment
  - Automatic deployments from Git
  - Edge network for fast global access
  - Preview deployments for PRs

### Backend Hosting

- **PartyKit Cloud** - WebSocket servers
  - Cloudflare Workers runtime
  - Global edge deployment
  - Durable Objects for state

### Build Tools

- **npm** - Package management
- **ESLint 8** - Code linting with Next.js config
- **Sharp 0.34.5** - Image processing for build

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 14.2.35 | React framework |
| react | ^18 | UI library |
| react-dom | ^18 | React DOM renderer |
| three | ^0.182.0 | 3D graphics library |
| @types/three | ^0.182.0 | TypeScript types for Three.js |
| partykit | ^0.0.115 | WebSocket server framework |
| partysocket | ^1.1.10 | WebSocket client with React hooks |
| typescript | ^5 | Type checking |
| eslint | ^8 | Linting |
| eslint-config-next | 14.2.35 | Next.js ESLint rules |
| sharp | ^0.34.5 | Image optimization |

## Why These Choices

### Next.js over Create React App

I chose Next.js because:
- App Router simplifies routing without external dependencies
- Server-side rendering improves initial load
- Built-in optimizations reduce configuration

### PartyKit over Socket.io/Firebase

I selected PartyKit because:
- Simpler API than raw WebSockets
- Edge deployment means lower latency
- Durable Objects handle state persistence automatically
- No database to manage for game rooms

### Canvas over DOM/SVG

I used Canvas for the board because:
- Better performance for animations
- Pixel-perfect control over rendering
- Simpler coordinate calculations for click detection

### Custom CSS over Tailwind/Styled Components

I wrote custom CSS because:
- Complete control over design tokens
- No external dependency
- Smaller bundle size for a single project
