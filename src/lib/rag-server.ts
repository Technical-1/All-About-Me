/**
 * Server-side RAG (Retrieval-Augmented Generation) utilities
 *
 * Node.js-compatible version for Astro API routes.
 * Provides semantic search over pre-computed embeddings to find
 * relevant context for the AI chat assistant.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ============================================================================
// Interfaces
// ============================================================================

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

// ============================================================================
// Module-level caches
// ============================================================================

let embeddingsCache: EmbeddingsData | null = null;
// Type for the embedder pipeline function
type EmbedderPipeline = (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>;
let embedderPromise: Promise<EmbedderPipeline> | null = null;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Compute cosine similarity between two vectors
 * Returns 0 if either vector has zero magnitude (prevents NaN/Infinity)
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

  // Guard against zero-magnitude vectors to prevent division by zero
  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Load embeddings from static JSON file (server-side using fs)
 */
export async function loadEmbeddings(): Promise<EmbeddingsData> {
  if (embeddingsCache) return embeddingsCache;

  const embeddingsPath = join(process.cwd(), 'public/data/rag/embeddings.json');
  const fileContent = await readFile(embeddingsPath, 'utf-8');
  embeddingsCache = JSON.parse(fileContent);

  return embeddingsCache!;
}

/**
 * Get or create the embedder pipeline (cached for reuse)
 */
async function getEmbedder(): Promise<EmbedderPipeline> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as Promise<EmbedderPipeline>;
    })();
  }
  return embedderPromise;
}

/**
 * Embed a query using Xenova transformers
 */
export async function embedQuery(query: string): Promise<number[]> {
  const embedder = await getEmbedder();

  const result = await embedder(query, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(result.data) as number[];
}

/**
 * Search for relevant chunks given a query
 *
 * Server-side version with adjusted defaults:
 * - topK = 8 (more results for richer context)
 * - minScore = 0.20 (lowered to catch more semantic matches)
 * - Hybrid approach: combines semantic search with keyword matching
 */
export async function searchContext(
  query: string,
  options: {
    topK?: number;
    projectFilter?: string;
    minScore?: number;
  } = {}
): Promise<SearchResult[]> {
  const { topK = 8, projectFilter, minScore = 0.20 } = options;

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

  // Sort by score descending
  const sorted = scored.sort((a, b) => b.score - a.score);

  // Extract keywords from query for hybrid matching
  const queryLower = query.toLowerCase();
  const keywords = queryLower
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['the', 'and', 'for', 'what', 'how', 'does', 'has', 'about', 'tell', 'jacob'].includes(w));

  // Keyword boost: chunks containing exact query keywords get a score boost
  const boosted = sorted.map(r => {
    const contentLower = (r.chunk.content + ' ' + r.chunk.section).toLowerCase();
    let keywordBoost = 0;

    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        // Stronger boost for longer/rarer keywords (likely proper nouns or project names)
        keywordBoost += keyword.length > 4 ? 0.15 : 0.08;
      }
    }

    return {
      ...r,
      score: Math.min(r.score + keywordBoost, 1.0), // Cap at 1.0
      originalScore: r.score,
    };
  });

  // Re-sort with boosted scores
  boosted.sort((a, b) => b.score - a.score);

  // Filter by minimum score
  const filtered = boosted.filter(r => r.score >= minScore).slice(0, topK);

  // Fallback: if nothing passes threshold but we have some results, take top 5
  if (filtered.length === 0 && boosted.length > 0) {
    return boosted.slice(0, 5);
  }

  return filtered;
}

/**
 * Format search results as context string for the LLM
 *
 * Formats context as natural background knowledge - no labels, headers, or
 * citations that the model might parrot back in its response.
 */
export function formatContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  // Just the content, no labels or metadata that could be quoted
  const content = results
    .map(r => r.chunk.content)
    .join('\n\n');

  return `\n\n---\nBackground information about Jacob:\n\n${content}\n---`;
}
