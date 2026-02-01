/**
 * Generate embeddings for portfolio documentation
 *
 * Reads markdown files from public/data/portfolio/*, chunks them,
 * and generates embeddings using MiniLM for RAG retrieval.
 *
 * Usage: npx tsx scripts/generate-embeddings.ts
 */

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from '@xenova/transformers';
import { chunkMarkdown, type Chunk } from './lib/chunker.js';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSIONS = 384;

interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

interface EmbeddingsOutput {
  model: string;
  dimensions: number;
  generatedAt: string;
  chunks: EmbeddedChunk[];
}

/**
 * Check if a directory exists and is readable
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all markdown files from the portfolio directory
 */
async function getPortfolioFiles(
  portfolioDir: string
): Promise<{ project: string; file: string; path: string }[]> {
  const files: { project: string; file: string; path: string }[] = [];

  if (!(await directoryExists(portfolioDir))) {
    console.log(`Portfolio directory does not exist: ${portfolioDir}`);
    return files;
  }

  const projects = await readdir(portfolioDir, { withFileTypes: true });

  for (const project of projects) {
    if (!project.isDirectory()) continue;

    const projectPath = join(portfolioDir, project.name);
    const projectFiles = await readdir(projectPath, { withFileTypes: true });

    for (const file of projectFiles) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;

      files.push({
        project: project.name,
        file: file.name,
        path: join(projectPath, file.name),
      });
    }
  }

  return files;
}

/**
 * Get all markdown files from the personal directory
 */
async function getPersonalFiles(
  personalDir: string
): Promise<{ project: string; file: string; path: string }[]> {
  const files: { project: string; file: string; path: string }[] = [];

  if (!(await directoryExists(personalDir))) {
    console.log(`Personal directory does not exist: ${personalDir}`);
    return files;
  }

  const personalFiles = await readdir(personalDir, { withFileTypes: true });

  for (const file of personalFiles) {
    if (!file.isFile() || !file.name.endsWith('.md')) continue;

    files.push({
      project: 'Jacob Kanfer',
      file: file.name,
      path: join(personalDir, file.name),
    });
  }

  return files;
}

/**
 * Get all markdown files from the blog directory
 */
async function getBlogFiles(
  blogDir: string
): Promise<{ project: string; file: string; path: string }[]> {
  const files: { project: string; file: string; path: string }[] = [];

  if (!(await directoryExists(blogDir))) {
    console.log(`Blog directory does not exist: ${blogDir}`);
    return files;
  }

  const blogFiles = await readdir(blogDir, { withFileTypes: true });

  for (const file of blogFiles) {
    if (!file.isFile() || !file.name.endsWith('.md')) continue;

    files.push({
      project: 'Blog',
      file: file.name,
      path: join(blogDir, file.name),
    });
  }

  return files;
}

/**
 * Generate embeddings for text chunks
 */
async function generateEmbeddings(
  chunks: Chunk[],
  embedder: Awaited<ReturnType<typeof pipeline>>
): Promise<EmbeddedChunk[]> {
  const embeddedChunks: EmbeddedChunk[] = [];

  for (const chunk of chunks) {
    const result = await embedder(chunk.content, {
      pooling: 'mean',
      normalize: true,
    });
    const embedding = Array.from(result.data) as number[];

    embeddedChunks.push({
      ...chunk,
      embedding,
    });
  }

  return embeddedChunks;
}

async function main() {
  const cwd = process.cwd();
  const portfolioDir = join(cwd, 'public/data/portfolio');
  const personalDir = join(cwd, 'public/data/personal');
  const blogDir = join(cwd, 'src/content/blog');
  const outputDir = join(cwd, 'public/data/rag');
  const outputPath = join(outputDir, 'embeddings.json');

  console.log('Starting embedding generation...');
  console.log(`Model: ${MODEL_NAME}`);
  console.log(`Portfolio directory: ${portfolioDir}`);
  console.log(`Personal directory: ${personalDir}`);
  console.log(`Blog directory: ${blogDir}`);

  // Get all files from each source
  const portfolioFiles = await getPortfolioFiles(portfolioDir);
  const personalFiles = await getPersonalFiles(personalDir);
  const blogFiles = await getBlogFiles(blogDir);

  // Combine all files
  const allFiles = [...portfolioFiles, ...personalFiles, ...blogFiles];

  if (allFiles.length === 0) {
    console.log('No files found. Generating empty output.');

    const output: EmbeddingsOutput = {
      model: MODEL_NAME,
      dimensions: EMBEDDING_DIMENSIONS,
      generatedAt: new Date().toISOString(),
      chunks: [],
    };

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, JSON.stringify(output, null, 2));
    console.log(`Empty embeddings written to: ${outputPath}`);
    return;
  }

  console.log(`Found ${portfolioFiles.length} portfolio file(s)`);
  console.log(`Found ${personalFiles.length} personal file(s)`);
  console.log(`Found ${blogFiles.length} blog file(s)`);
  console.log(`Total: ${allFiles.length} markdown file(s) to process.`);

  // Load the embedding model
  console.log('Loading embedding model...');
  const embedder = await pipeline('feature-extraction', MODEL_NAME);

  // Process each file
  const allChunks: EmbeddedChunk[] = [];

  for (const { project, file, path } of allFiles) {
    console.log(`Processing ${project}/${file}...`);

    try {
      const content = await readFile(path, 'utf-8');
      const chunks = chunkMarkdown(content, project, file);

      if (chunks.length === 0) {
        console.log(`  No chunks generated (file may be empty)`);
        continue;
      }

      console.log(`  Generated ${chunks.length} chunk(s)`);
      const embeddedChunks = await generateEmbeddings(chunks, embedder);
      allChunks.push(...embeddedChunks);
      console.log(`  Embeddings generated successfully`);
    } catch (error) {
      console.error(`  Error processing ${project}/${file}:`, error);
      // Continue processing other files
    }
  }

  // Write output
  const output: EmbeddingsOutput = {
    model: MODEL_NAME,
    dimensions: EMBEDDING_DIMENSIONS,
    generatedAt: new Date().toISOString(),
    chunks: allChunks,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2));

  console.log(`\nEmbedding generation complete!`);
  console.log(`Total chunks: ${allChunks.length}`);
  console.log(`Output written to: ${outputPath}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
