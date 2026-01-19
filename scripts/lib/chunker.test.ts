/**
 * Tests for chunker.ts using Node's built-in test runner
 *
 * Run with: npx tsx --test scripts/lib/chunker.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { chunkMarkdown, estimateTokens, type Chunk } from './chunker.js';

describe('estimateTokens', () => {
  it('estimates tokens as chars/4', () => {
    assert.strictEqual(estimateTokens('test'), 1);  // 4/4 = 1
    assert.strictEqual(estimateTokens('hello world'), 3);  // 11/4 = 2.75 -> 3
    assert.strictEqual(estimateTokens(''), 0);  // 0/4 = 0
  });

  it('rounds up for partial tokens', () => {
    assert.strictEqual(estimateTokens('ab'), 1);  // 2/4 = 0.5 -> 1
    assert.strictEqual(estimateTokens('abc'), 1);  // 3/4 = 0.75 -> 1
  });
});

describe('chunkMarkdown', () => {
  describe('basic section parsing', () => {
    it('splits content by ## headings', () => {
      const content = `## Section One
This is content for section one.

## Section Two
This is content for section two.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].section, 'Section One');
      assert.strictEqual(chunks[1].section, 'Section Two');
    });

    it('splits content by ### headings', () => {
      const content = `### Subsection A
Content A.

### Subsection B
Content B.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].section, 'Subsection A');
      assert.strictEqual(chunks[1].section, 'Subsection B');
    });

    it('handles content before first heading as Introduction', () => {
      const content = `Some intro text here.

## First Section
Section content.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].section, 'Introduction');
      assert.strictEqual(chunks[0].content, 'Some intro text here.');
      assert.strictEqual(chunks[1].section, 'First Section');
    });

    it('handles document with only intro content (no headings)', () => {
      const content = `Just some content without any headings.
Multiple lines of text.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].section, 'Introduction');
    });
  });

  describe('chunk ID generation', () => {
    it('generates slug-based IDs', () => {
      const content = `## System Overview
Some content.`;

      const chunks = chunkMarkdown(content, 'AHSR', 'architecture.md');

      assert.strictEqual(chunks[0].id, 'ahsr-system-overview');
    });

    it('handles special characters in project and section names', () => {
      const content = `## Data Flow & Processing!
Some content.`;

      const chunks = chunkMarkdown(content, 'My-Project_123', 'test.md');

      assert.strictEqual(chunks[0].id, 'my-project123-data-flow-processing');
    });

    it('appends counter for duplicate headings', () => {
      const content = `## Overview
First overview content.

## Details
Some details.

## Overview
Second overview content.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      const overviewChunks = chunks.filter(c => c.section === 'Overview');
      assert.strictEqual(overviewChunks.length, 2);
      assert.strictEqual(overviewChunks[0].id, 'testproject-overview');
      assert.strictEqual(overviewChunks[1].id, 'testproject-overview-2');
    });
  });

  describe('chunk metadata', () => {
    it('includes correct project and file in each chunk', () => {
      const content = `## Test Section
Some content.`;

      const chunks = chunkMarkdown(content, 'MyProject', 'docs.md');

      assert.strictEqual(chunks[0].project, 'MyProject');
      assert.strictEqual(chunks[0].file, 'docs.md');
    });
  });

  describe('code block handling', () => {
    it('preserves code blocks as atomic units', () => {
      const content = `## Code Example

Here is some code:

\`\`\`typescript
function hello() {
  console.log("Hello");
}
\`\`\`

And some text after.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      // Should have chunks, and code block should be intact in one of them
      const contentWithCode = chunks.find(c => c.content.includes('```typescript'));
      assert.ok(contentWithCode, 'Should have a chunk with the code block');
      assert.ok(
        contentWithCode.content.includes('function hello()'),
        'Code block should be intact'
      );
      assert.ok(
        contentWithCode.content.includes('console.log'),
        'Code block should preserve all lines'
      );
    });

    it('does not treat # inside code blocks as headings', () => {
      const content = `## Main Section

\`\`\`bash
# This is a bash comment
## Not a heading
echo "test"
\`\`\`

More content.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      // Should only have one section (Main Section)
      const sections = new Set(chunks.map(c => c.section));
      assert.strictEqual(sections.size, 1);
      assert.ok(sections.has('Main Section'));
    });
  });

  describe('overflow handling (section > 500 tokens)', () => {
    it('splits large sections at paragraph boundaries', () => {
      // Create content that exceeds 500 tokens (2000+ chars)
      const longParagraph1 = 'First paragraph. '.repeat(100);  // ~1700 chars
      const longParagraph2 = 'Second paragraph. '.repeat(100); // ~1800 chars

      const content = `## Large Section

${longParagraph1}

${longParagraph2}`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      // Should split into multiple chunks
      assert.ok(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);

      // All chunks should belong to the same section
      for (const chunk of chunks) {
        assert.strictEqual(chunk.section, 'Large Section');
      }
    });

    it('keeps large code blocks atomic even if over 500 tokens', () => {
      // Create a code block that exceeds 500 tokens
      const longCode = 'const line = "some code here";'.repeat(80);

      const content = `## Code Section

\`\`\`typescript
${longCode}
\`\`\``;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      // Find the chunk with the code block
      const codeChunk = chunks.find(c => c.content.includes('```typescript'));
      assert.ok(codeChunk, 'Should have a code chunk');
      assert.ok(
        codeChunk.content.includes(longCode.substring(0, 100)),
        'Code should be kept intact'
      );
    });
  });

  describe('underflow handling (section < 200 tokens)', () => {
    it('keeps small sections as-is', () => {
      const content = `## Small Section
A short paragraph.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].content, 'A short paragraph.');
    });
  });

  describe('edge cases', () => {
    it('handles empty content', () => {
      const chunks = chunkMarkdown('', 'TestProject', 'test.md');
      assert.strictEqual(chunks.length, 0);
    });

    it('handles content with only whitespace', () => {
      const chunks = chunkMarkdown('   \n\n   ', 'TestProject', 'test.md');
      assert.strictEqual(chunks.length, 0);
    });

    it('handles heading with no content', () => {
      const content = `## Empty Section

## Another Section
With content.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      // Empty section should not produce a chunk
      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].section, 'Another Section');
    });

    it('handles nested code blocks correctly', () => {
      const content = `## Nested Code

Text before.

\`\`\`markdown
Some markdown with:
\\\`\\\`\\\`javascript
nested code
\\\`\\\`\\\`
\`\`\`

Text after.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      // Should parse without errors
      assert.ok(chunks.length >= 1);
    });

    it('handles multiple consecutive headings', () => {
      const content = `## First
## Second
## Third
Content here.`;

      const chunks = chunkMarkdown(content, 'TestProject', 'test.md');

      // Only the last heading (Third) should have content
      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].section, 'Third');
    });
  });

  describe('real-world scenarios', () => {
    it('handles typical architecture.md content', () => {
      const content = `## System Overview

The AHSR system provides a hybrid RAG architecture for portfolio websites.

Key components:
- Document chunking pipeline
- Vector embeddings store
- Local LLM inference

## Technical Stack

- **Frontend**: Astro + React
- **Embeddings**: transformers.js
- **Inference**: WebLLM

\`\`\`typescript
// Example embedding call
const embedding = await model.embed(chunk);
\`\`\`

## Data Flow

1. User asks a question
2. Question is embedded
3. Similar chunks are retrieved
4. Context is assembled
5. LLM generates response`;

      const chunks = chunkMarkdown(content, 'AHSR', 'architecture.md');

      assert.strictEqual(chunks.length, 3);
      assert.strictEqual(chunks[0].id, 'ahsr-system-overview');
      assert.strictEqual(chunks[1].id, 'ahsr-technical-stack');
      assert.strictEqual(chunks[2].id, 'ahsr-data-flow');

      // Verify code block is in Technical Stack chunk
      assert.ok(chunks[1].content.includes('```typescript'));
    });
  });
});
