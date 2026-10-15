# Project Q&A Knowledge Base

## Overview

Private Collab Whiteboard is a real-time collaborative whiteboard that needs no account, no backend and no database. Everyone in a room draws on a shared infinite canvas, and each browser holds the whole board as a Y.js CRDT document persisted in IndexedDB. Edits pass between browsers through a 35-line PartyKit relay that forwards bytes without reading them. The interesting part is access control without a server: in a password-protected room every frame is AES-256-GCM-encrypted, and every edit is signed with an ECDSA key that viewer links simply don't contain. View-only therefore holds even against a viewer who rewrites the client, and the owner can revoke old links by rotating the room to a new key epoch.

## Problem Solved

Most collaborative whiteboards keep your boards on their servers and enforce permissions there, so the provider can read everything and "view-only" means whatever its backend decides. I wanted a whiteboard where the server is untrusted by construction: it can't read the content, and it doesn't need to be asked who may edit. That meant moving both confidentiality and authorization into the browser, with cryptography doing what a permissions table normally does.

## Target Users

- **Small teams sketching something sensitive** — architecture diagrams, incident timelines or plans they don't want stored by a third party
- **Presenters and teachers** — share a viewer link and present with the laser pointer, knowing the audience can't alter the board
- **Anyone who wants a quick shared canvas** — open the site, create a room, send the link; no sign-up

## Key Features

- **Real-time collaboration**: CRDT sync with live cursors, live previews of shapes as they are drawn, and a presence list
- **Drawing tools**: pencil and highlighter; line, arrow, rectangle, circle, ellipse, diamond and triangle with solid/dashed/dotted strokes, fills and arrowhead options; text; multi-line sticky notes that wrap and scroll; connectors that stay bound to the shapes they link; a fading laser pointer; shape and brush erasers
- **Editing**: Shift multi-select, move, restyle, reorder, lock, copy/paste/duplicate, and undo/redo that only touches your own changes
- **Infinite canvas**: Space-drag or two-finger pan, cursor-centered wheel zoom and pinch zoom from 10% to 500%, and fit-all
- **Several boards per room**: create, rename, clear and delete tabs, with renames synced to everyone
- **Export**: frame the board in a pan/zoom dialog, then save a 2× PNG or a single-page PDF
- **End-to-end encryption**: add a password to any room; the key comes from PBKDF2 (600,000 iterations, random per-room salt) and existing drawings carry over
- **Owner, editor and viewer links**: the role is defined by which private keys the link carries
- **Revocation**: the owner changes the password to move the room to a new epoch, and old links stop producing accepted edits
- **Offline-first**: boards load from IndexedDB and edits made offline merge on reconnect
- **My Boards**: a local history of rooms with role badges, encryption status, last visit and visit count

## Technical Highlights

### A signed sync layer that makes view-only cryptographic
Encryption hides content from the relay, but every participant who has the password can decrypt, so a client-side `readOnly` flag stops nobody. I replaced Y.js's stock document-sync protocol with a small layer of my own (`js/signed-doc-sync.js`, `js/protocol.js`). Editors sign each update over `epoch ‖ update` with the epoch's ECDSA P-256 key; every receiving peer checks the epoch, the owner-signed certificate, and the signature before calling `Y.applyUpdate`, and drops the frame silently on any failure. Viewers are never given a signing key, so their updates fail verification everywhere and never enter anyone's document. The certificate is verified once at start and must pin exactly the editor key in use, or the peer applies nothing. Y.js still does all conflict resolution; only the framing is mine.

### Revocation with no server: an owner root of trust and key epochs
The hard problem without a server is revocation: there is no authority to ask whether a link is still valid. `js/room-cert.js` builds a two-level hierarchy. A per-room owner key signs a certificate binding the current editor public key to an epoch number, and peers trust only an editor key that a valid certificate vouches for. Only the owner link carries the owner private key, and the app never offers it for sharing. Rotation (`rotateCapability` in `room-manager.js`, `rotateRoom` in `yjs-setup.js`) mints epoch N+1 with a new editor key and password, then broadcasts an owner-signed `{type: 'rotate', room, from, to}` notice. Peers that verify it mark their epoch superseded and stop applying, broadcasting or relaying its state, so holders of old links can't produce edits anyone accepts.

### Treating the shared document as hostile input
In a peer-to-peer app the dangerous input isn't a form field, it's the CRDT. Shape fields, names and presence state arrive from other browsers, and several of them reach `innerHTML` (the shape-settings header, cursor labels, the user list). I defend at two layers. Allow-lists in `js/utils.js` and `js/shape-schema.js` accept only what the app itself produces: `safeColor` takes hex only, `safeToolName` maps anything outside 13 known tools to the literal `shape`, `safeNumber` rejects non-finite input, and one shared `escapeHtml` handles text. Behind them, the `vercel.json` CSP is `script-src 'self'` with no `unsafe-inline`, so a missed sink still can't execute script. The same boundary covers denial of service: `clampPoints` caps a stroke at 5,000 points, `safeStrokeWidth` clamps line width to 0–200, and remote laser trails are cut to 300 points, so one malicious peer can't stall every other client's render loop.

### Connectors that follow shapes without a "connector moved" message
A connector between two boxes must follow them as either one moves, on every client. I store a connector as `{fromId, toId, fromAnchor, toAnchor}`: the ids of its shapes, plus the compass side of each (`n`/`e`/`s`/`w`), chosen at creation by `nearestAnchors` in `js/connector-geometry.js`. The endpoint coordinates are never stored. Each redraw resolves the anchors against the shapes' current bounding boxes, using an id→shape `Map` (`buildShapeIndex`) built once per pass so each lookup is O(1). When a peer moves a box, only the box's own object changes, and every connector on it re-routes when that update lands. Deleting a shape also removes connectors left dangling, in the same transaction, so a single undo restores both (`tests/undo-cascade.test.js`). Connectors can't bind to other connectors, which rules out recursive resolution.

### Pure modules so a canvas app can be unit-tested
Canvas apps tend to bury arithmetic inside event handlers, where only a real browser can test it. I pulled the non-trivial logic into DOM-free modules that take and return plain values: `draw-geometry.js` (hit-testing, polygon vertices, arrowheads, degenerate-shape detection), `connector-geometry.js`, `text-wrap.js` (word wrap with hard breaks, sticky-note scroll extent), `laser-trail.js` and `keyboard-intent.js`, alongside the crypto, protocol and link modules. Vitest runs the 26 test files in its Node environment with no DOM. Signed sync is tested end to end with in-memory transports, including forged viewer updates, wrong-epoch replays, and rotation notices not signed by the owner.

## Engineering Decisions

### Transport: a WebSocket relay over peer-to-peer WebRTC
- **Constraint**: Sync had to work on corporate firewalls, mobile carriers and double-NAT home routers, with the server outside the trust boundary.
- **Options**: A `y-webrtc` mesh, a self-hosted Y.js WebSocket server, or a broadcast relay on PartyKit.
- **Choice**: The PartyKit relay (`party/index.ts`), with every payload encrypted in the browser.
- **Why**: WebRTC needs STUN/TURN and still fails on restrictive networks; a WebSocket reaches anywhere HTTPS does. A standard Y.js server applies and stores updates, so it needs plaintext. A relay that only forwards bytes doesn't, and keeps the privacy model of a peer-to-peer design.

### Creating the default board lazily
- **Constraint**: If every client ran `boards.set('default', new Y.Array())` on load, two people joining together created competing `default` entries in the `boards` Y.Map. The CRDT picks one winner by client id, which can orphan the array that actually holds the drawings: the bytes sync, but the content never renders.
- **Options**: Wait out a sync timeout before creating it, let only the owner create it, or create it on the first write.
- **Choice**: `yjs-setup.js` never creates it; `addDrawing` in `drawing.js` creates the array on the first shape, and the board tab bar shows the default tab ("Main") even before it exists.
- **Why**: A joiner receives the existing array in a snapshot and never races to create a rival. That fixes a seeding problem without inventing roles or timing heuristics.

### Capabilities in the URL fragment
- **Constraint**: View-only had to survive a hostile viewer who has the password and will edit the URL or patch the JavaScript, with no accounts and no server-side check.
- **Options**: A client-side flag, a signed role string (nothing checks it when an edit arrives), server-issued tokens, or links where the missing key is the enforcement.
- **Choice**: The link fragment carries the keys for its role: viewer links only public keys, editor links add the editor private key, owner links add the owner private key (`room-manager.js`). Every update's signature is checked before it is applied.
- **Why**: There is nothing to flip. A viewer can't conjure a key by editing a URL, fragments never reach a server, and trust is rooted in the owner key rather than a shared secret. The decoder accepts only the v3 format, because honoring a weaker old one would be a downgrade path.

### Whole-object shapes over per-field CRDT maps
- **Constraint**: A board holds many small shapes of a dozen kinds that must be rendered, sanitized, copied, exported and undone.
- **Options**: A nested `Y.Map` per shape for field-level merges, or one plain JSON object per shape in a `Y.Array`.
- **Choice**: Plain objects; an edit deletes and re-inserts the shape at its index in one transaction.
- **Why**: Every consumer works on simple values and each edit is one undo step. I accepted the cost: there's no field-level merge, so simultaneous edits to the same shape keep both versions rather than combining them.

## Frequently Asked Questions

### How does real-time sync work without a database?
Each browser keeps the full board as a Y.js document and persists it to IndexedDB. A local change produces a binary Y.js update, which is wrapped in an `{epoch, update, sig}` envelope, encrypted if the room has a password, and sent to the relay, which forwards it to everyone else in the room. Because Y.js is a CRDT, peers converge to the same state whatever order updates arrive in. A peer that joins late asks for a snapshot and gets the full state from whoever is online.

### What if nobody else is online when I open a board?
You still see everything you've seen before, because your copy lives in IndexedDB. You can draw offline, and your changes merge when someone else is online. Since the relay stores nothing, a board you've never opened can only load while another participant is connected. That is the cost of having no server-side storage.

### How does the encryption protect my data?
Adding a password derives an AES-256-GCM key with PBKDF2 (600,000 iterations of SHA-256) over a random 16-byte salt minted for that room. The salt and iteration count travel in the invite link so every peer derives the same key, and the count is clamped to 100,000–5,000,000 on decode, so a tampered link can't weaken the derivation or stall your browser on it. Every frame then gets a random 12-byte IV and is encrypted before it reaches the WebSocket: document updates, snapshots, cursors, names and live previews. The only plaintext frame is a one-field `{enc: true}` beacon that tells a visitor without a key the room is encrypted.

### Is the board encrypted on my own device?
No, and this is deliberate. Encryption protects data in transit and from the relay. Locally, IndexedDB holds the decrypted document so the board opens instantly and works offline, and the invite link carries the password and keys in its fragment, so it sits in your browser history like any URL. Treat an invite link like a password.

### How does view-only stop a determined viewer?
It doesn't depend on the viewer's client behaving. A viewer link has only public keys. Every edit in an encrypted room must carry a valid signature from the epoch's editor key, and every peer checks it before applying (`signed-doc-sync.js`). A viewer who forces their client into edit mode broadcasts updates with no valid signature, and every other peer drops them. Hiding the toolbar for viewers is only cosmetic.

### What's the difference between owner, editor and viewer links?
All three are capability links in the URL fragment. A viewer link can decrypt but not sign. An editor link adds the editor private key, so it can draw. An owner link adds the owner private key, so it can also rotate the room. The Invite dialog only offers editor and viewer links; the owner link stays in the creator's address bar.

### How does revoking access work without a server?
Only the owner can do it, by changing the password. That mints epoch N+1 with a new editor key and password and broadcasts an owner-signed rotate notice. Connected peers verify it, mark the old epoch superseded, and are told to ask for a new link; the owner is reloaded into the new epoch. Old links can still open whatever their holder already has cached, but can no longer produce edits that current peers accept, and with a new password they can't decrypt new traffic either.

### What happens if someone tampers with or truncates an invite link?
`parseCapabilityHash` in `room-manager.js` distinguishes three cases. No fragment means an intentionally open room. A valid fragment returns the capability. A fragment that is present but won't decode throws, rather than quietly dropping you into an editable unencrypted room, which would be the dangerous default. A role claimed without its matching key is downgraded, so editing `r: 'owner'` into a viewer link gives you a viewer.

### What happens if two people edit the same shape at once?
Different shapes never conflict. Each shape is a whole JSON object in the board's Y.Array, and moving or restyling one replaces that object. If two people change the same shape at the same instant, Y.js doesn't merge their fields; the merge keeps both replacement versions. In practice two people rarely grab the same shape at once, and I chose this simpler model over a nested map per shape.

### How do connectors stay attached when I move a shape?
A connector stores the ids of its two shapes and which side of each it attaches to, not coordinates. Every redraw resolves those sides against the shapes' current bounding boxes, so when anyone moves a connected shape the connector follows on every screen with no extra message. Deleting a linked shape removes the connector in the same step, and undo brings both back.

### Why vanilla JavaScript instead of React or Svelte?
The core of the app is imperative Canvas drawing, which a virtual DOM doesn't help with. The rest of the UI (toolbar, tabs, popups, modals) is small enough for direct DOM code. No framework also means no inline bootstraps or runtime-generated scripts to accommodate, which keeps the strict `script-src 'self'` CSP simple.

### How does it perform on large boards?
Each change to the board triggers a full redraw of every shape on the current board; there is no viewport culling or layering yet. Within a redraw, connector endpoints are resolved through an id→shape `Map` instead of scanning the board, and untrusted strokes are capped at 5,000 points. Overflowing sticky notes draw only the lines inside their visible area. That is comfortable for typical whiteboard sizes (dozens to a few hundred shapes); viewport culling would be the next step for much larger boards.

### Can I export a board?
Yes. Save opens a dialog that renders the board into its own canvas, so you can pan and zoom to frame the export independently of your on-screen view. It saves a PNG at twice the preview resolution, or a single-page PDF made with jsPDF from the same render.

### Why PartyKit instead of my own WebSocket server?
The relay's only job is fanning out bytes per room. PartyKit gives per-room isolation on Cloudflare's edge, TLS, and a one-command deploy that GitHub Actions runs whenever the server code changes, leaving 35 lines of my own server code. Because the relay holds no keys and no state, swapping hosts means changing `PARTYKIT_HOST` in `js/config.js`.
