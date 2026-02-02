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
 */
export async function searchContext(
  query: string,
  options: {
    topK?: number;
    projectFilter?: string;
    minScore?: number;
  } = {}
): Promise<SearchResult[]> {
  const { topK = 4, projectFilter, minScore = 0.40 } = options;

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

  // Filter by minimum score
  const filtered = sorted.filter(r => r.score >= minScore).slice(0, topK);

  // Fallback: if nothing passes threshold but we have some results, take top 2 with lower threshold
  if (filtered.length === 0 && sorted.length > 0 && sorted[0].score >= 0.30) {
    return sorted.slice(0, 2);
  }

  return filtered;
}

/**
 * Format search results as context string for the LLM
 */
export function formatContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '\n\n## Retrieved Documentation\n\nNo relevant documentation found. Say "I don\'t have that specific information about Jacob."';
  }

  // For small LLMs, simpler formatting works better
  const sections: string[] = [];
  for (const r of results) {
    // Include only the content, keep it simple
    sections.push(`FACT: ${r.chunk.content}`);
  }

  return `\n\n## Retrieved Documentation\n\nUSE THESE FACTS TO ANSWER (do not make up information):\n\n${sections.join('\n\n')}\n\nIMPORTANT: Your answer MUST come from the facts above. Do not invent or guess.`;
}
