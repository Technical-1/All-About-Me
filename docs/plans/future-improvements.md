# Future Improvements

Ideas and enhancements to implement after the initial portfolio launch.

---

## AI Chat: Hybrid RAG System (v2)

**Current approach (v1):** Curated summaries injected as system prompt
**Future approach (v2):** Hybrid system with retrieval for deeper code knowledge

### Why Upgrade?

The curated summaries handle 80% of questions well:
- "What's your most complex project?"
- "Tell me about your AI experience"
- "How does the whiteboard sync work?"

But they can't answer hyper-specific code questions:
- "Show me how you implemented the undo manager"
- "What's the exact API for the CRDT merge function?"
- "How do you handle WebSocket reconnection?"

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HYBRID CONTEXT                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: Base Context (always injected)                │   │
│  │  - Project summaries (~200-300 words each)              │   │
│  │  - Resume/skills/experience                             │   │
│  │  - ~2-3K tokens                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: Page Context (injected based on current page) │   │
│  │  - If on /projects/whiteboard → full README + key files │   │
│  │  - If on /blog/crdt-post → related code snippets        │   │
│  │  - ~1-2K additional tokens                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: Retrieved Context (per-question)              │   │
│  │  - Vector search across embedded code chunks            │   │
│  │  - Top 3-5 most relevant chunks                         │   │
│  │  - ~1-2K additional tokens                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technical Implementation

#### Vector Database: LanceDB (Browser)

LanceDB can run in-browser via WASM, making it perfect for this use case.

```typescript
// lib/rag.ts
import { connect } from "@anthropic-ai/lancedb-wasm";

interface CodeChunk {
  id: string;
  project: string;
  file: string;
  content: string;
  embedding: number[];
}

// Pre-compute embeddings at build time
// Store as static JSON, load into LanceDB on page load
```

#### What to Embed

For each project, embed:

1. **README.md** — Full content, chunked by section
2. **Key source files** — Core logic files, not config/boilerplate
3. **Architecture docs** — If any exist
4. **Comments/docstrings** — Extracted separately for searchability

Example chunking for Private-Collab-Whiteboard:
```
chunks/
├── whiteboard-readme-intro.txt
├── whiteboard-readme-features.txt
├── whiteboard-readme-tech-stack.txt
├── whiteboard-crdt-sync-logic.txt      # from src/sync.js
├── whiteboard-canvas-renderer.txt      # from src/canvas.js
├── whiteboard-encryption-utils.txt     # from src/crypto.js
└── ...
```

#### Embedding Model Options

Since we're already using WebLLM, we need a browser-compatible embedding model:

1. **Transformers.js** — Run small embedding models in browser
   - `Xenova/all-MiniLM-L6-v2` (~23MB)
   - Good quality, reasonable size

2. **Pre-computed at build time** — Embed during `npm run build`
   - Use OpenAI/Anthropic embeddings API
   - Store as static JSON
   - No runtime embedding cost
   - **Recommended approach**

#### Build-Time Embedding Pipeline

```typescript
// scripts/generate-embeddings.ts
import { readdir, readFile } from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';

async function embedProjects() {
  const projects = ['whiteboard', 'btc-explorer', 'git-archiver', ...];

  for (const project of projects) {
    const chunks = await chunkProject(project);
    const embeddings = await embedChunks(chunks);
    await writeJSON(`src/data/embeddings/${project}.json`, embeddings);
  }
}

// Run during build: adds embeddings to static bundle
```

#### Runtime Flow

```typescript
// lib/rag.ts
async function getRelevantContext(question: string, currentProject?: string) {
  // 1. Embed the question (small model in browser OR pre-computed common questions)
  const questionEmbedding = await embedQuestion(question);

  // 2. Search vector DB
  const results = await vectorDB
    .search(questionEmbedding)
    .filter(currentProject ? `project = '${currentProject}'` : undefined)
    .limit(5)
    .execute();

  // 3. Return concatenated context
  return results.map(r => r.content).join('\n\n---\n\n');
}
```

### Pre-Generated FAQ (Layer 2.5)

For common questions, pre-generate high-quality answers:

```typescript
const FAQ = {
  "how does the crdt sync work": `
    The whiteboard uses Y.js, a CRDT (Conflict-free Replicated Data Type)
    library. Here's how it works:

    1. Each shape/stroke is stored as a Y.js shared type
    2. Operations are tracked with vector clocks for ordering
    3. When users reconnect, Y.js automatically merges...
    [detailed pre-written answer]
  `,
  // ... more common questions
};

// Check FAQ before hitting LLM
function handleQuestion(q: string) {
  const faqMatch = findFAQMatch(q);
  if (faqMatch) return faqMatch;
  return askLLM(q);
}
```

### Estimated Effort

| Task | Effort |
|------|--------|
| Set up LanceDB WASM | 2-3 hours |
| Build chunking pipeline | 3-4 hours |
| Build-time embedding script | 2-3 hours |
| Runtime retrieval logic | 2-3 hours |
| Testing & tuning | 3-4 hours |
| **Total** | **~15 hours** |

### Success Metrics

- Can answer "show me the code for X" questions
- Retrieval latency < 100ms
- No increase in initial page load time (lazy load embeddings)
- Context stays within model limits

---

## Other Future Improvements

### Blog Enhancements
- [ ] RSS feed
- [ ] Open Graph image auto-generation
- [ ] Reading progress indicator
- [ ] Heading anchor links with copy
- [ ] Full-text search across posts
- [ ] Newsletter signup

### Performance
- [ ] View Transitions API for navigation
- [ ] Image optimization pipeline
- [ ] Service worker for offline support
- [ ] Prefetch on link hover

### Analytics & Monitoring
- [ ] Vercel Analytics integration
- [ ] Chat usage tracking (what questions are asked?)
- [ ] Error monitoring for WebLLM failures

### Content
- [ ] Auto-generate project screenshots during build
- [ ] Pull GitHub stars/forks counts live
- [ ] Show "last updated" for projects from git

---

## Priority Order

1. **Launch with v1** — Curated summaries, get feedback
2. **Write "How I Built Local LLM" post** — Documents the feature
3. **Monitor chat usage** — See what questions people actually ask
4. **Implement RAG if needed** — Only if users hit limits of v1
5. **Blog enhancements** — After you have a few posts
