/**
 * Markdown chunking utilities for RAG (Retrieval-Augmented Generation)
 *
 * Splits markdown content into semantic chunks suitable for embedding generation.
 * Preserves code blocks as atomic units and respects markdown heading structure.
 */

export interface Chunk {
  id: string;           // "ahsr-architecture-overview"
  project: string;      // "AHSR"
  file: string;         // "architecture.md"
  section: string;      // "System Overview"
  content: string;      // The text (200-500 tokens)
}

/**
 * Estimate token count using a simple heuristic.
 * Uses chars/4 as approximation (conservative estimate for English text).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate a URL-friendly slug from text.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')           // Replace spaces with dashes
    .replace(/-+/g, '-')            // Collapse multiple dashes
    .replace(/^-|-$/g, '');         // Trim leading/trailing dashes
}

/**
 * Generate a unique chunk ID.
 * Format: "{project-slug}-{section-slug}" with counter for duplicates.
 */
function generateChunkId(
  project: string,
  section: string,
  idCounts: Map<string, number>
): string {
  const baseId = `${slugify(project)}-${slugify(section)}`;
  const count = idCounts.get(baseId) || 0;
  idCounts.set(baseId, count + 1);

  return count === 0 ? baseId : `${baseId}-${count + 1}`;
}

/**
 * Split content into paragraphs while preserving code blocks as atomic units.
 * Returns an array of paragraph strings.
 */
function splitIntoParagraphs(content: string): string[] {
  const paragraphs: string[] = [];
  const lines = content.split('\n');

  let currentParagraph: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Check for code block markers
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        currentParagraph.push(line);
        paragraphs.push(currentParagraph.join('\n'));
        currentParagraph = [];
        inCodeBlock = false;
      } else {
        // Start of code block - flush current paragraph first
        if (currentParagraph.length > 0) {
          const text = currentParagraph.join('\n').trim();
          if (text) paragraphs.push(text);
          currentParagraph = [];
        }
        currentParagraph.push(line);
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      // Inside code block - keep accumulating
      currentParagraph.push(line);
    } else if (line.trim() === '') {
      // Empty line outside code block - paragraph break
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join('\n').trim();
        if (text) paragraphs.push(text);
        currentParagraph = [];
      }
    } else {
      // Regular text line
      currentParagraph.push(line);
    }
  }

  // Flush remaining content
  if (currentParagraph.length > 0) {
    const text = currentParagraph.join('\n').trim();
    if (text) paragraphs.push(text);
  }

  return paragraphs;
}

/**
 * Split a section's content into chunks of ~200-500 tokens.
 * Splits at paragraph boundaries, keeping code blocks atomic.
 */
function splitSectionContent(
  content: string,
  project: string,
  file: string,
  section: string,
  idCounts: Map<string, number>
): Chunk[] {
  const MAX_TOKENS = 500;
  const paragraphs = splitIntoParagraphs(content);
  const chunks: Chunk[] = [];

  let currentContent: string[] = [];
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // If a single paragraph (e.g., code block) exceeds max, it gets its own chunk
    if (paragraphTokens > MAX_TOKENS) {
      // Flush current accumulated content first
      if (currentContent.length > 0) {
        chunks.push({
          id: generateChunkId(project, section, idCounts),
          project,
          file,
          section,
          content: currentContent.join('\n\n')
        });
        currentContent = [];
        currentTokens = 0;
      }
      // Add oversized paragraph as its own chunk
      chunks.push({
        id: generateChunkId(project, section, idCounts),
        project,
        file,
        section,
        content: paragraph
      });
      continue;
    }

    // If adding this paragraph would exceed max, flush first
    if (currentTokens + paragraphTokens > MAX_TOKENS && currentContent.length > 0) {
      chunks.push({
        id: generateChunkId(project, section, idCounts),
        project,
        file,
        section,
        content: currentContent.join('\n\n')
      });
      currentContent = [];
      currentTokens = 0;
    }

    // Add paragraph to current chunk
    currentContent.push(paragraph);
    currentTokens += paragraphTokens;
  }

  // Flush remaining content
  if (currentContent.length > 0) {
    chunks.push({
      id: generateChunkId(project, section, idCounts),
      project,
      file,
      section,
      content: currentContent.join('\n\n')
    });
  }

  return chunks;
}

interface Section {
  heading: string;
  content: string;
}

/**
 * Parse markdown into sections based on headings (## and ###).
 * Content before the first heading goes into a "Introduction" section.
 */
function parseMarkdownSections(content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split('\n');

  let currentHeading = 'Introduction';
  let currentContent: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code blocks to avoid treating # inside code as headings
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentContent.push(line);
      continue;
    }

    // Check for heading outside code blocks
    const headingMatch = !inCodeBlock && line.match(/^#{2,3}\s+(.+)$/);

    if (headingMatch) {
      // Save previous section if it has content
      const sectionContent = currentContent.join('\n').trim();
      if (sectionContent) {
        sections.push({
          heading: currentHeading,
          content: sectionContent
        });
      }

      // Start new section
      currentHeading = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save final section
  const sectionContent = currentContent.join('\n').trim();
  if (sectionContent) {
    sections.push({
      heading: currentHeading,
      content: sectionContent
    });
  }

  return sections;
}

/**
 * Chunk markdown content into semantic pieces suitable for RAG embeddings.
 *
 * @param content - The markdown content to chunk
 * @param project - The project name (e.g., "AHSR")
 * @param file - The file name (e.g., "architecture.md")
 * @returns Array of chunks, each targeting 200-500 tokens
 */
export function chunkMarkdown(content: string, project: string, file: string): Chunk[] {
  const sections = parseMarkdownSections(content);
  const idCounts = new Map<string, number>();
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const sectionChunks = splitSectionContent(
      section.content,
      project,
      file,
      section.heading,
      idCounts
    );
    chunks.push(...sectionChunks);
  }

  return chunks;
}
