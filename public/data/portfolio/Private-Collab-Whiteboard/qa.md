# Project Q&A Knowledge Base

## Overview

Private Collab Whiteboard is a real-time collaborative drawing app that prioritizes privacy. It lets multiple users draw on a shared canvas simultaneously, with all data synced peer-to-peer through CRDTs and optionally encrypted end-to-end. No account required — just create a room and share a link. The interesting part is access control: encrypted rooms use capability links (owner / editor / viewer) whose permissions are enforced by ECDSA signatures verified between peers, so view-only actually means view-only even though there's no server to ask. All drawing data lives in the browser (IndexedDB), and the relay is a minimal broadcast server that never sees plaintext.

## Key Features

- **Real-time Collaboration**: CRDT-based sync via Y.js with live cursor tracking, live drawing previews, and user presence indicators
- **Drawing Tools**: Freehand pencil, lines, rectangles, circles, text tool, shape eraser, and brush eraser with configurable stroke widths and fill colors
- **Infinite Canvas**: Pan (Space+drag), zoom (scroll wheel or buttons), and fit-to-content with a virtual coordinate system
- **End-to-End Encryption**: Optional password protection using AES-256-GCM with PBKDF2 key derivation (100K iterations)
- **Capability-Based Roles**: Encrypted rooms issue owner / editor / viewer links; the role is carried (and enforced) by which signing keys the link contains, not a flag the client can flip
- **Cryptographic View-Only**: Viewers hold no signing key, so peers reject any edit they try to make — view-only survives a hostile viewer editing the URL or the JS
- **Owner-Controlled Rotation**: Only the owner can rotate the room to a new epoch (via change-password), instantly invalidating older links
- **Select & Manipulate**: Select, move, resize shapes; multi-select with Shift+click; copy/paste/duplicate; lock shapes
- **Undo/Redo**: CRDT-aware undo that only affects your own changes, never other users'
- **Multiple Boards**: Organize content across separate boards within a single room
- **Offline Support**: Full offline drawing with automatic sync when reconnected via IndexedDB persistence
- **Board History**: "My Boards" page tracks all rooms you've visited with role badges and access counts

## Technical Highlights

### Signed-Update Sync Layer with Cryptographic View-Only
Encryption hides content from the *server*, but everyone with the room password can still decrypt — so a view-only link that just sets a client flag is bypassed by editing the URL or the JS. I replaced Y.js's stock document-sync protocol with a thin custom layer (`signed-doc-sync.js` + `protocol.js`): editors sign each Y.js update with a per-epoch ECDSA P-256 key over `epoch ‖ update` (epoch-prefixed to block replay), and every peer verifies the signature against the room's certified editor key before applying it. Viewers are simply never handed a signing key, so any update they emit fails verification at every honest peer and never lands in the shared document. Y.js still does all the CRDT conflict resolution; only the transport framing is mine. The underlying transport (`sync-provider.js`) AES-256-GCM-encrypts every frame before it hits the PartyKit relay.

### CRDT-Aware Undo/Redo
The undo system uses Y.js's built-in UndoManager, which only tracks local changes. This means pressing Ctrl+Z never undoes another user's work — a subtle but critical UX detail for collaborative editing. Changes within 500ms are grouped into a single undo step to match user intent (e.g., a quick series of shape moves becomes one undo).

### Infinite Canvas with World/Screen Coordinate Transform
The drawing system maintains a virtual world coordinate system separate from screen pixels. All shapes are stored in world coordinates, and a viewport transform (pan + zoom) converts between the two. This enables smooth zooming centered on the cursor position, fit-to-content, and consistent shape sizes regardless of zoom level. Touch/pinch-to-zoom is also supported for mobile.

### Owner Root-of-Trust and P2P Revocation
The hard problem in a serverless system is revocation: if the editor key is just embedded in links, there's no authority to ask "is this link still allowed?" My answer is a two-tier PKI rooted in a per-room owner ECDSA keypair (`room-cert.js`). The owner key signs an *epoch certificate* binding the current editor public key to an epoch number, and peers only trust an editor key that a valid owner cert vouches for (`signed-doc-sync.js` verifies this once on start and fails closed if the cert doesn't pin the exact editor key it's verifying against). Because only the owner holds the owner private key, only the owner can mint a new epoch. Rotating the room mints epoch N+1 with a fresh editor key and broadcasts an owner-signed rotate notice; peers mark the old epoch superseded and stop applying its updates, so anyone holding an old link can no longer produce edits anyone will accept — real revocation with no central server. The owner link itself is never shared, so editors can draw but can't rotate.

## Engineering Decisions

### Transport: WebSocket relay over peer-to-peer WebRTC
- **Constraint**: Needed reliable real-time sync across arbitrary networks (corporate firewalls, mobile carriers, double-NAT home routers) while keeping the server out of the trust boundary.
- **Options**: `y-webrtc` peer-to-peer mesh, a self-hosted Y.js WebSocket server, or PartyKit's Cloudflare-Workers relay.
- **Choice**: PartyKit relay (`party/index.ts`) with all payloads encrypted client-side.
- **Why**: WebRTC's NAT traversal failed too often in practice. A broadcast relay is simpler and reaches everywhere a WebSocket reaches, and because messages are AES-256-GCM encrypted before they leave the browser, the relay never sees plaintext — the privacy model survives the migration.

### Lazy default-board creation over eager initialization
- **Constraint**: When each client independently ran `boards.set('default', new Y.Array())` on load, two joiners created competing `default` entries in the `boards` Y.Map. The CRDT resolves the conflict by picking a winner by random client ID, which could orphan the array that actually held the drawings — content would sync at the byte level but never render.
- **Options**: Gate creation behind a sync timeout, lock creation to the owner, or never create the board eagerly and let the first *write* create it.
- **Choice**: Don't create `default` at init at all (`yjs-setup.js`); `drawing.js` lazily creates it on the first drawn shape, and the drawing observer re-subscribes if the board array instance changes underneath it.
- **Why**: A joiner receives the editor's existing array via snapshot and never races to create a competing one, so there's no Y.Map conflict to orphan content. It also avoids inventing roles or a timeout heuristic for what is really a "who creates the seed object" problem.

### Multi-page Vite build over an SPA shell
- **Constraint**: Three pages with very different payloads — a marketing landing page, a board-history list, and the heavy whiteboard runtime (Y.js + canvas engine + crypto).
- **Options**: Single-page app with a router and code-splitting, or Vite's MPA mode with one HTML entry per page.
- **Choice**: MPA — `index.html`, `boards.html`, `room.html` each ship their own bundle, with Vercel rewrites mapping `/room/:id` to `room.html`.
- **Why**: The landing page loads in a couple of KB without dragging in Y.js, and there is no shared client-side state worth preserving across navigations. Routing collapses into a static rewrite rule.

### Capabilities in the URL fragment, enforced by signatures
- **Constraint**: View-only had to be tamper-proof against a *hostile* viewer — someone who has the password, can decrypt, and will edit the URL or patch the client JS — without introducing accounts or a server-side auth check (the relay is intentionally dumb).
- **Options**: A client-side `readOnly` flag (bypassable), a weak "signature" over the role string (still bypassable — nothing verifies it at write time), server-issued JWTs (breaks the dumb-relay/P2P model), or capability links where the *absence of a key* is the enforcement.
- **Choice**: Encode the role's keys into the URL fragment — viewer links carry only public keys, editor links add the editor private key, owner links add the owner private key — and have every peer verify each update's signature before applying it (`room-manager.js`, `signed-doc-sync.js`).
- **Why**: There's nothing to "flip." A viewer can't sign edits because they don't have the key, and editing the URL can't conjure one. Fragments never reach the relay, the model stays accountless, and trust is rooted in the owner key rather than a shared secret. (Older link formats are intentionally *not* honored — a hard version break, since a weaker legacy format would be a downgrade path.)

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

### How does view-only mode actually stop a determined viewer?
It doesn't rely on the viewer's client behaving. A viewer link contains only public keys — no editor signing key. Edits in an encrypted room must be signed with the per-epoch editor key and are verified by every peer before being applied (`signed-doc-sync.js`). So even if a viewer edits the URL, opens dev tools, and forces their own client into "edit mode," the updates they broadcast carry no valid signature and every other peer drops them. The UI also hides editing controls for viewers, but that's cosmetic — the real enforcement is the missing key.

### What's the difference between the owner, editor, and viewer links?
All three are capability links carried in the URL fragment. A **viewer** link has public keys only (can read, can't sign). An **editor** link adds the editor private key (can read and draw). An **owner** link adds the owner private key as well (can read, draw, *and* rotate the room). The owner link is never shared by the app — it stays in the creator's address bar — so editors can collaborate but can't lock anyone out or rotate the room.

### How does rotating / revoking access work without a server?
Rotation is owner-only. Changing the password mints a new epoch (epoch N+1) with a fresh editor key, and the owner key signs a new certificate for it. The owner broadcasts an owner-signed rotate notice; current peers verify it against the owner public key, mark the old epoch superseded, and stop applying its updates. The owner is reloaded into the new link to re-share with whoever should keep access. Anyone holding an old link can still decrypt old cached state but can no longer produce edits that peers will accept — the practical effect of revocation, achieved with signatures instead of a central authority.

### Why ECDSA P-256 instead of Ed25519?
Ed25519 is smaller and more modern, but Web Crypto support for it only shipped in very recent browser versions and throws "Unrecognized name" on most installed browsers. ECDSA P-256 has been supported everywhere `crypto.subtle` exists for years. For a tool people open in whatever browser they already have, universal support matters far more than Ed25519's marginal size advantage.

### Is the relay really in the dark, even about who's drawing?
In an encrypted room, yes. Every frame — document updates, snapshots, cursor positions, names, the live drawing preview — is AES-256-GCM-encrypted before it leaves the browser, and the PartyKit relay only ever forwards opaque bytes. The one thing peers do advertise in the clear is an "encrypted room" marker, so a visitor who arrives without a key knows to ask for an invite link rather than silently joining an unreadable room.

### Can I use this offline?
Yes. All drawing data is persisted to IndexedDB via y-indexeddb. If you lose your connection, you can keep drawing normally. When you reconnect, Y.js automatically merges your offline changes with any changes made by other users while you were away. The CRDT model guarantees this merge is conflict-free.

### Why PartyKit instead of a custom WebSocket server?
PartyKit provides a Cloudflare Workers-based WebSocket runtime with built-in room isolation, auto-scaling, and global edge deployment. The server code is just 35 lines — accept connections and broadcast messages. PartyKit handles all the infrastructure complexity (SSL, connection management, scaling) so I can focus on the client-side logic.

### What's the "Board History" feature?
The boards page (`boards.html`) shows all rooms you've previously visited, stored in localStorage. Each entry tracks your role (owner/collaborator/viewer), whether the room is encrypted, when you last accessed it, and how many times. This makes it easy to return to a room without bookmarking the URL.

### How is the canvas performance with many shapes?
The drawing engine redraws the entire canvas on every frame using `requestAnimationFrame`. For typical whiteboard usage (dozens to low hundreds of shapes), this is fast enough. The infinite canvas viewport culling ensures only visible shapes are rendered. For very large boards, performance could be improved with spatial indexing or canvas layers, but this hasn't been necessary in practice.
