# Project Q&A Knowledge Base

## Overview

Private Collab Whiteboard is a real-time collaborative drawing app that prioritizes privacy. It lets multiple users draw on a shared canvas simultaneously, with all data synced peer-to-peer through CRDTs and optionally encrypted end-to-end. No account required — just create a room and share the link. All drawing data lives in the browser (IndexedDB), and the server is a minimal message relay that never sees plaintext content.

## Key Features

- **Real-time Collaboration**: CRDT-based sync via Y.js with live cursor tracking, live drawing previews, and user presence indicators
- **Drawing Tools**: Freehand pencil, lines, rectangles, circles, text tool, shape eraser, and brush eraser with configurable stroke widths and fill colors
- **Infinite Canvas**: Pan (Space+drag), zoom (scroll wheel or buttons), and fit-to-content with a virtual coordinate system
- **End-to-End Encryption**: Optional password protection using AES-256-GCM with PBKDF2 key derivation (100K iterations)
- **Select & Manipulate**: Select, move, resize shapes; multi-select with Shift+click; copy/paste/duplicate; lock shapes
- **Undo/Redo**: CRDT-aware undo that only affects your own changes, never other users'
- **Multiple Boards**: Organize content across separate boards within a single room
- **Read-Only Mode**: Share view-only links with a signed permission token
- **Offline Support**: Full offline drawing with automatic sync when reconnected via IndexedDB persistence
- **Board History**: "My Boards" page tracks all rooms you've visited with role badges and access counts

## Technical Highlights

### Custom Y.js Sync Provider with E2E Encryption
I built a custom WebSocket sync provider (`sync-provider.js`) that wraps Y.js's sync and awareness protocols with optional AES-256-GCM encryption. Every message — including cursor positions and drawing previews — is encrypted before leaving the browser. The PartyKit server is a 35-line relay that broadcasts binary blobs it can't read. The key derivation uses PBKDF2 with the room ID as salt, so the same password produces different keys in different rooms.

### CRDT-Aware Undo/Redo
The undo system uses Y.js's built-in UndoManager, which only tracks local changes. This means pressing Ctrl+Z never undoes another user's work — a subtle but critical UX detail for collaborative editing. Changes within 500ms are grouped into a single undo step to match user intent (e.g., a quick series of shape moves becomes one undo).

### Infinite Canvas with World/Screen Coordinate Transform
The drawing system maintains a virtual world coordinate system separate from screen pixels. All shapes are stored in world coordinates, and a viewport transform (pan + zoom) converts between the two. This enables smooth zooming centered on the cursor position, fit-to-content, and consistent shape sizes regardless of zoom level. Touch/pinch-to-zoom is also supported for mobile.

### Access Token System with Tamper Detection
Share links encode both the password and permission level (edit/view) into a signed token in the URL hash. The token includes a simple signature (`base64(password + role + salt)`) that prevents casual tampering — changing "view" to "edit" in the URL invalidates the signature. Legacy plain-password URLs are still supported for backward compatibility.

## Development Story

- **Hardest Part**: Getting the sync timing right. The default board ("default" Y.Array) was being created before IndexedDB finished loading, causing duplicate boards. I solved this by awaiting both IndexedDB sync and a network sync timeout before creating the default board.
- **Lessons Learned**: WebRTC (the original transport) has serious NAT traversal issues. Switching to PartyKit's WebSocket relay made connections far more reliable while keeping the same privacy model — the server is still just a relay.
- **Future Plans**: Shape grouping, image/file embedding, presentation mode with slide-by-slide boards, and mobile-optimized touch gestures.

## Frequently Asked Questions

### How does the real-time sync work without a database?
Y.js uses CRDTs (Conflict-free Replicated Data Types) — a mathematical model where every edit has a globally unique ID and timestamp. When two users make concurrent edits, the CRDT merge algorithm guarantees both arrive at the same final state without any server-side conflict resolution. The Y.Doc is persisted to IndexedDB for offline access and synced over WebSockets through a simple broadcast relay.

### Why vanilla JavaScript instead of React/Vue/Svelte?
The core of this app is an HTML5 Canvas — all drawing happens via imperative Canvas API calls, not DOM manipulation. A reactive framework would add overhead without benefit for the canvas rendering. The small amount of DOM UI (toolbars, modals, side panel) is simple enough to manage with direct DOM APIs, and it keeps the bundle small.

### How does the encryption actually protect my data?
When you set a room password, the app derives an AES-256-GCM key using PBKDF2 (100,000 iterations with the room ID as salt). Every Y.js sync message is encrypted with a random 12-byte IV before being sent over the WebSocket. The PartyKit server only ever sees encrypted binary blobs — it can't read shape data, text, cursor positions, or even user names. Only clients with the correct password can decrypt.

### What happens if two users edit the same shape simultaneously?
Y.js handles this at the CRDT level. Each shape is a JSON object in a Y.Array. If two users modify the same shape property (e.g., both move a rectangle), Y.js's last-writer-wins semantics apply per field. If they modify different properties (one resizes, one recolors), both changes are preserved. The system is designed so conflicts are rare and resolution is invisible.

### How does undo work in a collaborative environment?
The undo system uses Y.js's UndoManager, which tracks which changes were made by the local user. When you press Ctrl+Z, it only reverts your own recent action — it never touches other users' changes. This prevents the common collaborative editing frustration where one user's undo erases another user's work.

### How does the read-only mode work?
When sharing a room link, you can generate a "view-only" link. This encodes a signed permission token in the URL hash (`{password, role: "view", signature}`). The client checks this token on load and sets read-only mode, which disables all mutation operations in JavaScript (not just CSS hiding). The signature prevents casual URL tampering from "view" to "edit".

### Can I use this offline?
Yes. All drawing data is persisted to IndexedDB via y-indexeddb. If you lose your connection, you can keep drawing normally. When you reconnect, Y.js automatically merges your offline changes with any changes made by other users while you were away. The CRDT model guarantees this merge is conflict-free.

### Why PartyKit instead of a custom WebSocket server?
PartyKit provides a Cloudflare Workers-based WebSocket runtime with built-in room isolation, auto-scaling, and global edge deployment. The server code is just 35 lines — accept connections and broadcast messages. PartyKit handles all the infrastructure complexity (SSL, connection management, scaling) so I can focus on the client-side logic.

### What's the "Board History" feature?
The boards page (`boards.html`) shows all rooms you've previously visited, stored in localStorage. Each entry tracks your role (owner/collaborator/viewer), whether the room is encrypted, when you last accessed it, and how many times. This makes it easy to return to a room without bookmarking the URL.

### How is the canvas performance with many shapes?
The drawing engine redraws the entire canvas on every frame using `requestAnimationFrame`. For typical whiteboard usage (dozens to low hundreds of shapes), this is fast enough. The infinite canvas viewport culling ensures only visible shapes are rendered. For very large boards, performance could be improved with spatial indexing or canvas layers, but this hasn't been necessary in practice.
