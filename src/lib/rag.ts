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

// Type for the embedder pipeline function
type EmbedderPipeline = (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>;
let embedderPromise: Promise<EmbedderPipeline> | null = null;

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
 * Embed a query using Xenova transformers (browser)
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
 * Uses hybrid search: combines semantic similarity with keyword boosting
 * to improve accuracy for specific project names and technical terms.
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

  // Score all chunks with semantic similarity
  const scored: SearchResult[] = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by score descending
  const sorted = scored.sort((a, b) => b.score - a.score);

  // Extract keywords from query for hybrid matching
  const queryLower = query.toLowerCase();
  const stopwords = ['the', 'and', 'for', 'what', 'how', 'does', 'has', 'about', 'tell', 'jacob', 'can', 'you', 'with', 'this', 'that', 'are', 'was', 'been'];
  const keywords = queryLower
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !stopwords.includes(w));

  // Keyword boost: chunks containing exact query keywords get a score boost
  const boosted = sorted.map(r => {
    const contentLower = (r.chunk.content + ' ' + r.chunk.section + ' ' + r.chunk.project).toLowerCase();
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
 * Formats as simple background info without labels that could be quoted back.
 */
export function formatContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  // Simple format - just the content, no labels
  const content = results
    .map(r => r.chunk.content)
    .join('\n\n');

  return `\n\nBackground information:\n${content}`;
}
