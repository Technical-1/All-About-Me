# AI RAG Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Test and verify the full AI pipeline: trigger GitHub workflow to fetch `.portfolio/` docs from repos, generate embeddings, and integrate RAG into the ChatInterface.

**Architecture:** The system pulls `.portfolio/{architecture,stack,qa}.md` files from private repos via GitHub Actions, stores them in `public/data/portfolio/`, generates vector embeddings at build time using Xenova Transformers, and serves them to the browser-based WebLLM chat for context-aware responses.

**Tech Stack:** GitHub Actions, Node.js fetch script, Xenova/transformers (MiniLM embeddings), @mlc-ai/web-llm (Llama 3.2), cosine similarity search

---

## Current State Analysis

| Component | Status | Notes |
|-----------|--------|-------|
| Sync Workflow | ✅ Exists | Fetches `.portfolio/` files from private repos |
| Featured Repos | 6 total | AHSR, Git-Archiver-Web, Blackjack-Trainer, BTC-Explorer, Differential-Growth, Private-Collab-Whiteboard |
| Repos with `.portfolio/` | 3 of 6 | BTC-Explorer, Git-Archiver-Web, Differential-Growth |
| Repos missing `.portfolio/` | 3 of 6 | AHSR, Blackjack-Trainer, Private-Collab-Whiteboard |
| Embedding Script | ✅ Exists | `scripts/generate-embeddings.ts` |
| Embeddings File | Empty | `public/data/rag/embeddings.json` has 0 chunks |
| ChatInterface | ✅ Works | Hardcoded system prompt, no RAG |

---

## Task 1: Trigger GitHub Workflow and Verify Portfolio Fetch

**Files:**
- Verify: `.github/workflows/sync-private-repos.yml`
- Verify: `scripts/fetch_private_repos.js`
- Check: `public/data/portfolio/`

**Step 1: Trigger the sync workflow via gh CLI**

```bash
gh workflow run "Sync Private Repos" -R Technical-1/All-About-Me
```

**Step 2: Monitor workflow progress**

```bash
gh run list --workflow="Sync Private Repos" -R Technical-1/All-About-Me --limit 3
```

Wait for status to show "completed".

**Step 3: Pull the changes after workflow completes**

```bash
git pull origin main
```

**Step 4: Verify portfolio files were fetched**

```bash
ls -la public/data/portfolio/
```

Expected: Directories for `BTC-Explorer`, `Git-Archiver-Web`, `Differential-Growth` each containing `architecture.md`, `stack.md`, `qa.md`.

**Step 5: Check content of a fetched file**

```bash
head -50 public/data/portfolio/BTC-Explorer/qa.md
```

Expected: Markdown content with project Q&A.

---

## Task 2: Run Embedding Generation Script

**Files:**
- Execute: `scripts/generate-embeddings.ts`
- Output: `public/data/rag/embeddings.json`

**Step 1: Run the embedding generation**

```bash
npm run generate-embeddings
```

Expected output:
```
Starting embedding generation...
Model: Xenova/all-MiniLM-L6-v2
Portfolio directory: .../public/data/portfolio
Found N markdown file(s) to process.
Loading embedding model...
Processing BTC-Explorer/architecture.md...
  Generated X chunk(s)
  Embeddings generated successfully
...
Embedding generation complete!
Total chunks: ~20-50
Output written to: .../public/data/rag/embeddings.json
```

**Step 2: Verify embeddings were generated**

```bash
cat public/data/rag/embeddings.json | jq '.chunks | length'
```

Expected: Number > 0 (likely 20-50 chunks).

**Step 3: Inspect a sample chunk**

```bash
cat public/data/rag/embeddings.json | jq '.chunks[0]'
```

Expected: Object with `id`, `project`, `file`, `section`, `content`, and `embedding` (384-dim array).

---

## Task 3: Create RAG Retrieval Utility

**Files:**
- Create: `src/lib/rag.ts`
- Test: (manual testing via chat)

**Step 1: Create the RAG library**

```typescript
// src/lib/rag.ts
/**
 * RAG (Retrieval-Augmented Generation) utilities
 *
 * Provides semantic search over pre-computed embeddings to find
 * relevant context for the AI chat assistant.
 */

interface EmbeddedChunk {
  id: string;
  project: string;
  file: string;
  section: string;
  content: string;
  embedding: number[];
}

interface EmbeddingsData {
  model: string;
  dimensions: number;
  generatedAt: string;
  chunks: EmbeddedChunk[];
}

interface SearchResult {
  chunk: EmbeddedChunk;
  score: number;
}

let embeddingsCache: EmbeddingsData | null = null;

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Load embeddings from static JSON file
 */
export async function loadEmbeddings(): Promise<EmbeddingsData> {
  if (embeddingsCache) return embeddingsCache;

  const response = await fetch('/data/rag/embeddings.json');
  if (!response.ok) {
    throw new Error(`Failed to load embeddings: ${response.status}`);
  }

  embeddingsCache = await response.json();
  return embeddingsCache!;
}

/**
 * Embed a query using Xenova transformers (browser)
 */
export async function embedQuery(query: string): Promise<number[]> {
  const { pipeline } = await import('@xenova/transformers');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const result = await embedder(query, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(result.data) as number[];
}

/**
 * Search for relevant chunks given a query
 */
export async function searchContext(
  query: string,
  options: {
    topK?: number;
    projectFilter?: string;
    minScore?: number;
  } = {}
): Promise<SearchResult[]> {
  const { topK = 5, projectFilter, minScore = 0.3 } = options;

  const [embeddings, queryEmbedding] = await Promise.all([
    loadEmbeddings(),
    embedQuery(query),
  ]);

  let chunks = embeddings.chunks;

  // Filter by project if specified
  if (projectFilter) {
    chunks = chunks.filter(c => c.project === projectFilter);
  }

  // Score all chunks
  const scored: SearchResult[] = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by score descending and filter by minimum score
  return scored
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Format search results as context string for the LLM
 */
export function formatContext(results: SearchResult[]): string {
  if (results.length === 0) return '';

  const formatted = results.map(r => {
    return `[${r.chunk.project} - ${r.chunk.section}]\n${r.chunk.content}`;
  });

  return `\n\n---\nRelevant context from my projects:\n\n${formatted.join('\n\n---\n\n')}`;
}
```

**Step 2: Verify file was created**

```bash
cat src/lib/rag.ts | head -20
```

---

## Task 4: Integrate RAG into ChatInterface

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx:68-96` (handleSubmit function)

**Step 1: Add RAG imports at top of file**

Add after line 2:

```typescript
import { searchContext, formatContext } from '../../lib/rag';
```

**Step 2: Modify handleSubmit to include RAG context**

Replace the handleSubmit function (lines 68-96) with:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim() || !engine || isLoading) return;

  const userMessage = input.trim();
  setInput('');
  setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
  setIsLoading(true);

  try {
    // Search for relevant context
    let ragContext = '';
    try {
      const results = await searchContext(userMessage, { topK: 3 });
      ragContext = formatContext(results);
    } catch (ragError) {
      console.warn('RAG search failed, continuing without context:', ragError);
    }

    const systemPromptWithContext = SYSTEM_PROMPT + ragContext;

    const response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPromptWithContext },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: userMessage }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
  } catch (err) {
    console.error('Chat error:', err);
    setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
  } finally {
    setIsLoading(false);
  }
};
```

---

## Task 5: Test the Full Pipeline Locally

**Files:**
- Test: Local dev server

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Open browser and navigate to chat**

Open `http://localhost:4321/chat`

**Step 3: Initialize the AI model**

Click "Start Chat" and wait for WebLLM to load.

**Step 4: Test with a general question**

Ask: "What projects have you built?"

Expected: General response using base system prompt.

**Step 5: Test with a specific question that should trigger RAG**

Ask: "How does BTC Explorer fetch Bitcoin data?"

Expected: Response that includes specific details from the BTC-Explorer qa.md or architecture.md, showing RAG is working.

**Step 6: Check browser console for RAG activity**

Open DevTools → Console. Look for any RAG-related logs or errors.

---

## Task 6: Commit and Push Changes

**Files:**
- Commit: `src/lib/rag.ts`, `src/components/chat/ChatInterface.tsx`, `public/data/rag/embeddings.json`

**Step 1: Check git status**

```bash
git status
```

**Step 2: Stage RAG-related changes**

```bash
git add src/lib/rag.ts src/components/chat/ChatInterface.tsx public/data/rag/embeddings.json
```

**Step 3: Commit with descriptive message**

```bash
git commit -m "feat: integrate RAG context retrieval into AI chat

- Add src/lib/rag.ts with cosine similarity search
- Embed queries at runtime using Xenova transformers
- Search pre-computed embeddings for relevant context
- Inject top 3 matching chunks into system prompt
- Graceful fallback if RAG search fails"
```

**Step 4: Push to GitHub**

```bash
git push origin main
```

---

## Task 7: Document Missing Portfolio Files (Optional Follow-up)

**Files:**
- Reference: `docs/prompts/project-documentation-generator.md`

**Note:** 3 repos still need `.portfolio/` files:
- AHSR
- Blackjack-Trainer
- Private-Collab-Whiteboard

These can be generated later by running the documentation generator prompt in each repo. For now, the RAG system will work with the 3 repos that have portfolio docs.

---

## Success Criteria

- [ ] GitHub workflow runs successfully and fetches portfolio files
- [ ] `public/data/portfolio/` contains directories with markdown files
- [ ] Embedding generation produces >0 chunks in embeddings.json
- [ ] ChatInterface loads without errors
- [ ] Questions about documented projects return context-aware answers
- [ ] General questions still work (graceful RAG fallback)
