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
let embedderPromise: Promise<any> | null = null;

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
 * Get or create the embedder pipeline (cached for reuse)
 */
async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
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
