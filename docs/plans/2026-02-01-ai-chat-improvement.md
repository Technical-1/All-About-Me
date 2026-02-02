# AI Chat Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create two chat versions (Local + Cloud) with expanded RAG that includes all site content, not just projects.

**Architecture:**
- Expand embedding generation to include page content (bio, experience, skills, blog posts)
- Create new API route for Claude-powered chat
- Add toggle UI to switch between Local (WebLLM) and Cloud (Claude API) modes
- Share the same expanded RAG system between both modes

**Tech Stack:** Astro API routes, Claude claude-3-5-haiku, existing WebLLM setup, Xenova transformers for embeddings

---

## Task 1: Create Personal Content Data Files

**Files:**
- Create: `public/data/personal/bio.md`
- Create: `public/data/personal/experience.md`
- Create: `public/data/personal/skills.md`
- Create: `public/data/personal/contact.md`

**Why:** The embedding generator currently only reads from `public/data/portfolio/*/`. We need structured markdown files for personal content that can be chunked and embedded just like project docs.

**Step 1: Create the personal data directory**

```bash
mkdir -p public/data/personal
```

**Step 2: Create bio.md with extracted content from index.astro**

```markdown
# About Jacob Kanfer

## Background

In the Fall of 2024, Jacob graduated from the University of Florida with a Bachelor of Science in Computer Engineering. He repaired his first phone when he was 12 and built his first computer when he was 13, leading him to a future in technology. Shortly after, he started teaching himself how to code and hasn't looked back since.

## Current Role

Since August 2025, Jacob has been working at Deloitte as an Engineering Solutions Analyst in their Government & Public Services practice, within the AI & Data offering portfolio. Based in Arlington, VA, he specializes in designing and deploying AI-powered solutions and intelligent agents that solve complex challenges for public sector clients.

## Education

- **Degree:** Bachelor of Science in Computer Engineering
- **University:** University of Florida
- **Graduation:** Fall 2024

## Early Experience

During his time at UF, Jacob gained hands-on consulting experience as a Data Science Intern at World Wide Technology, working on ML/AI initiatives to drive business decisions. He also held multiple leadership positions in student government and campus organizations, managing budgets exceeding $23 million and leading teams of 150+ members.

## Interests and Focus Areas

Jacob is focused on AI and building intelligent systems at the intersection of AI and engineering. He is also interested in cybersecurity and building intelligent agents.
```

**Step 3: Create experience.md with work history**

```markdown
# Jacob Kanfer's Experience

## Professional Experience

### Engineering Solutions Analyst - Deloitte
**Location:** Arlington, VA | **Period:** August 2025 - Present

- Design and implement AI-powered solutions and intelligent agents for public sector clients
- Develop enterprise automation solutions that enhance operational efficiency and drive innovation
- Collaborate with cross-functional teams to deliver cutting-edge engineering solutions
- **Technologies:** AI, Intelligent Agents, ServiceNow, Azure, AWS, Python

### Management Consulting Data Science Intern - World Wide Technology
**Location:** Remote (Gainesville, FL) | **Period:** May 2024 - August 2024

- Developed a clustering framework to integrate with existing ML models, boosting overall accuracy
- Designed Snowflake tables and procedures to streamline data processing workflows
- Created dynamic PowerBI dashboards that translated complex data into actionable insights
- **Technologies:** Machine Learning, XGBoost, Snowflake, PowerBI, Python

### Store Manager / Lead Technician - Campus Phone Repairs
**Location:** Gainesville, FL | **Period:** January 2022 - November 2023

- Managed daily operations and led a team of four technicians, improving service efficiency by 25%
- Established monthly KPIs and performance metrics to drive revenue growth and customer satisfaction
- Provided technical diagnostics and repairs for iOS, macOS, Android, and Windows devices

## Featured Project

### AHSR (Autonomous Hospital Stretcher Robot) - Senior Design Project
**Period:** January 2023 - December 2024 | **Location:** University of Florida

- Integrated RGB-Depth camera controls with OpenCV, using a pretrained lower-body detection model for safety override
- Implemented frontier-based exploration and SLAM with a custom Lidar mapping script for autonomous navigation
- Built waypoint navigation and logging tools enabling dynamic waypoint creation and trip replay
- Developed a modular PyQt5 user interface integrating with ROS2 topics wirelessly for robot control
- **Technologies:** Python, ROS2, OpenCV, PyQt5, SLAM, Robotics, Lidar

## Leadership Experience

### Chief of Staff to the Student Body President - UF Student Government
**Period:** July 2023 - May 2024

- Regulated and approved allocations and purchases of $23 million annual SG budget
- Organized and oversaw 15 agencies that plan events and projects to enhance the student experience
- Led executive team on legislative trip to Washington D.C., meeting with members of Congress
- Built initiative tracker to monitor progress of all executive branch initiatives

### Vice Chair, Budget & Appropriations Committee - UF Student Senate
**Period:** March 2022 - March 2023

- Managed budget approval process for $22+ million distributed to 100+ student organizations
- Developed Python automation tool to streamline bill creation by auto-generating line item totals
- Evaluated and amended budget proposals to ensure compliance with funding codes

### College of Engineering Senator - UF Student Senate
**Period:** January 2022 - March 2023

- Represented all students in the Herbert Wertheim College of Engineering
- Authored legislation including traffic safety improvements and student recognition resolutions

### Executive Vice President - Beta Theta Pi
**Period:** December 2022 - May 2023

- Re-elected based on exceptional performance; facilitated executive actions with team of 15
- Served as president's liaison for an organization of 180 members
- Oversaw executive board and annual budgets exceeding $120,000

## Awards and Recognition

### Florida Blue Key
**Spring 2023 Tapping Class**
Inducted into the oldest and most prestigious leadership honorary in the state of Florida.

### John Michael Stratton Award
**Outstanding Student Senator**
Recognizes exemplary service and leadership within the UF Student Senate.
```

**Step 4: Create skills.md with technical skills**

```markdown
# Jacob Kanfer's Technical Skills

## Programming Languages

Jacob is proficient in a wide range of programming languages:

- **Python** - Primary language for AI/ML, automation, and data science work
- **JavaScript/TypeScript** - Full-stack web development, React, Node.js
- **Rust** - Systems programming, performance-critical applications
- **Go** - Backend services, CLI tools
- **Java** - Enterprise applications, Android development
- **C++** - Systems programming, performance optimization
- **C** - Embedded systems, low-level programming
- **Swift** - iOS development
- **SQL** - Database design and queries
- **HTML/CSS** - Web development fundamentals

## Frameworks & Tools

### Frontend
- **React** - Component-based UI development
- **Vue** - Progressive JavaScript framework
- **Angular** - Enterprise frontend framework
- **Astro** - Static site generation (this portfolio is built with Astro)
- **Tailwind CSS** - Utility-first CSS framework

### Backend & Infrastructure
- **Firebase** - Backend-as-a-service, real-time databases
- **Electron** - Cross-platform desktop applications
- **Docker** - Containerization

### Testing & Automation
- **Puppeteer** - Browser automation
- **Playwright** - End-to-end testing
- **Web Scraping** - Data extraction and automation

### Machine Learning
- **TensorFlow** - Deep learning framework
- **XGBoost** - Gradient boosting for ML models

## Cloud Platforms & Services

- **AWS** - Amazon Web Services (Certified Cloud Practitioner)
- **Azure** - Microsoft cloud platform
- **Snowflake** - Cloud data warehousing
- **Databricks** - Unified analytics platform
- **ServiceNow** - Enterprise workflow automation
- **PowerBI** - Business intelligence and visualization
- **Git/GitHub** - Version control and collaboration

## AI & Specialties

Jacob's current focus areas include:

- **AI Agents** - Building autonomous AI systems that can reason and take actions
- **Multi-Agent Workflows** - Coordinating multiple AI agents to solve complex problems
- **Document Intelligence** - Extracting insights from unstructured documents
- **Machine Learning** - Supervised and unsupervised learning, model training
- **Prompt Engineering** - Designing effective prompts for LLMs
- **Automation** - Streamlining workflows and processes

## Certifications

- **AWS Certified Cloud Practitioner** - Foundational cloud computing certification
- **Engineering Innovation** - Professional development certification
- **Engineering Leadership** - Leadership in technical environments
- **Engineering Project Management** - Managing engineering projects effectively
```

**Step 5: Create contact.md**

```markdown
# Contact Jacob Kanfer

## How to Reach Jacob

Jacob is available for professional inquiries, collaboration opportunities, and networking.

### Email
**jacobkanfer8@gmail.com**
For professional inquiries, project discussions, or collaboration opportunities.

### LinkedIn
**linkedin.com/in/jacob-kanfer**
Connect for professional networking and career updates.

### GitHub
**github.com/Technical-1**
View open source projects and contributions.

## Response Time

Jacob typically responds to messages within 24-48 hours.

## What Jacob is Open To

- Discussing AI and intelligent agent development
- Collaborating on interesting technical projects
- Professional networking and mentorship
- Speaking about his experience in AI, consulting, or student leadership
```

**Step 6: Commit**

```bash
git add public/data/personal/
git commit -m "feat: add personal content data files for expanded RAG"
```

---

## Task 2: Update Embedding Generator to Include Personal Content

**Files:**
- Modify: `scripts/generate-embeddings.ts`

**Why:** The current generator only processes `public/data/portfolio/*/`. We need to also process `public/data/personal/*.md` and tag them appropriately.

**Step 1: Read the current generator**

Review `scripts/generate-embeddings.ts` to understand the current flow.

**Step 2: Add function to get personal content files**

Add after `getPortfolioFiles` function:

```typescript
/**
 * Get all markdown files from the personal content directory
 */
async function getPersonalFiles(
  personalDir: string
): Promise<{ project: string; file: string; path: string }[]> {
  const files: { project: string; file: string; path: string }[] = [];

  if (!(await directoryExists(personalDir))) {
    console.log(`Personal directory does not exist: ${personalDir}`);
    return files;
  }

  const entries = await readdir(personalDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

    files.push({
      project: 'Jacob Kanfer',  // Use consistent project name for personal content
      file: entry.name,
      path: join(personalDir, entry.name),
    });
  }

  return files;
}
```

**Step 3: Update main() to include personal files**

Modify the main function to also process personal files:

```typescript
async function main() {
  const cwd = process.cwd();
  const portfolioDir = join(cwd, 'public/data/portfolio');
  const personalDir = join(cwd, 'public/data/personal');
  const outputDir = join(cwd, 'public/data/rag');
  const outputPath = join(outputDir, 'embeddings.json');

  console.log('Starting embedding generation...');
  console.log(`Model: ${MODEL_NAME}`);
  console.log(`Portfolio directory: ${portfolioDir}`);
  console.log(`Personal directory: ${personalDir}`);

  // Get all files to process
  const portfolioFiles = await getPortfolioFiles(portfolioDir);
  const personalFiles = await getPersonalFiles(personalDir);
  const allFiles = [...portfolioFiles, ...personalFiles];

  if (allFiles.length === 0) {
    console.log('No files found. Generating empty output.');
    // ... rest of empty output handling
  }

  console.log(`Found ${portfolioFiles.length} portfolio file(s) and ${personalFiles.length} personal file(s) to process.`);

  // ... rest of processing (unchanged)
```

**Step 4: Run embedding generation to verify**

```bash
npm run generate-embeddings
```

Expected output should show personal files being processed.

**Step 5: Commit**

```bash
git add scripts/generate-embeddings.ts
git commit -m "feat: expand embedding generator to include personal content"
```

---

## Task 3: Add Blog Posts to Embedding Generation

**Files:**
- Modify: `scripts/generate-embeddings.ts`

**Why:** Blog posts contain valuable content about Jacob's thought process, technical approaches, and personal insights that should be searchable.

**Step 1: Add function to get blog files**

```typescript
/**
 * Get all markdown files from the blog content directory
 */
async function getBlogFiles(
  blogDir: string
): Promise<{ project: string; file: string; path: string }[]> {
  const files: { project: string; file: string; path: string }[] = [];

  if (!(await directoryExists(blogDir))) {
    console.log(`Blog directory does not exist: ${blogDir}`);
    return files;
  }

  const entries = await readdir(blogDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

    files.push({
      project: 'Blog',  // Tag as Blog for categorization
      file: entry.name,
      path: join(blogDir, entry.name),
    });
  }

  return files;
}
```

**Step 2: Update main() to include blog files**

```typescript
const blogDir = join(cwd, 'src/content/blog');

// Get all files to process
const portfolioFiles = await getPortfolioFiles(portfolioDir);
const personalFiles = await getPersonalFiles(personalDir);
const blogFiles = await getBlogFiles(blogDir);
const allFiles = [...portfolioFiles, ...personalFiles, ...blogFiles];

console.log(`Found ${portfolioFiles.length} portfolio, ${personalFiles.length} personal, and ${blogFiles.length} blog file(s).`);
```

**Step 3: Run and verify**

```bash
npm run generate-embeddings
```

**Step 4: Commit**

```bash
git add scripts/generate-embeddings.ts
git commit -m "feat: add blog posts to RAG embeddings"
```

---

## Task 4: Create Environment Variable for Anthropic API Key

**Files:**
- Create: `.env.example`
- Modify: `.gitignore` (if needed)

**Why:** The Cloud chat will need an Anthropic API key. We need a secure way to configure this.

**Step 1: Create .env.example**

```bash
# Anthropic API key for Cloud chat mode
ANTHROPIC_API_KEY=your_api_key_here
```

**Step 2: Ensure .env is in .gitignore**

Check `.gitignore` contains:
```
.env
.env.local
```

**Step 3: Create local .env file (not committed)**

```bash
echo "ANTHROPIC_API_KEY=your_actual_key" > .env
```

**Step 4: Commit example file**

```bash
git add .env.example .gitignore
git commit -m "feat: add environment variable setup for Anthropic API"
```

---

## Task 5: Create Cloud Chat API Route

**Files:**
- Create: `src/pages/api/chat.ts`

**Why:** Astro API routes let us call Claude securely server-side, keeping the API key hidden from the browser.

**Step 1: Create the API route**

```typescript
import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { searchContext, formatContext } from '../../lib/rag-server';

const SYSTEM_PROMPT = `You are an AI assistant for Jacob Kanfer's portfolio website. Help visitors learn about Jacob's background, skills, projects, and experience.

## RESPONSE GUIDELINES

### When Documentation Is Provided:
- Base answers on the provided excerpts
- Quote specific details: technologies, features, architectural decisions, experiences
- Cite which source the information comes from (project name, blog post, etc.)
- Be specific and detailed when documentation supports it

### When No Documentation Is Retrieved:
- Acknowledge you don't have detailed info on that topic
- Suggest alternatives: "You can find Jacob's resume on the Resume page" or "The Projects page has live demos"
- Offer to answer a related question

### General Behavior:
- Be conversational but informative (2-4 paragraphs typical, more if needed for complex topics)
- Use third person: "Jacob built...", "His approach was..."
- Never invent facts not in the documentation
- For personal questions unrelated to professional topics, politely redirect

## TOPICS YOU CAN DISCUSS
- Jacob's projects: architecture, tech stack, features, design decisions
- Technical skills: languages, frameworks, tools, cloud platforms
- Education: University of Florida, Computer Engineering (2024)
- Work: Deloitte (Engineering Solutions Analyst), WWT internship, previous roles
- Leadership: Student Government, organizations, awards
- Blog posts: Technical insights, project retrospectives
- Certifications: AWS Cloud Practitioner, Engineering certificates`;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = import.meta.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the last user message for RAG search
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    let ragContext = '';

    if (lastUserMessage) {
      try {
        const results = await searchContext(lastUserMessage.content);
        ragContext = formatContext(results);
      } catch (e) {
        console.warn('RAG search failed:', e);
      }
    }

    const systemPromptWithContext = SYSTEM_PROMPT + ragContext;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemPromptWithContext,
      messages: messages.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Sorry, I could not generate a response.';

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

**Step 2: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

**Step 3: Commit**

```bash
git add src/pages/api/chat.ts package.json package-lock.json
git commit -m "feat: add Cloud chat API route with Claude integration"
```

---

## Task 6: Create Server-Side RAG Module

**Files:**
- Create: `src/lib/rag-server.ts`

**Why:** The existing `rag.ts` uses browser APIs (`fetch` from origin, `@xenova/transformers` in browser). For the API route, we need a Node.js-compatible version that reads the embeddings file directly.

**Step 1: Create server-side RAG module**

```typescript
/**
 * Server-side RAG utilities for API routes
 *
 * Reads embeddings from the file system instead of fetching via HTTP.
 * Uses a simpler embedding approach for server-side query matching.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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
 * Load embeddings from file system
 */
export async function loadEmbeddings(): Promise<EmbeddingsData> {
  if (embeddingsCache) return embeddingsCache;

  const embeddingsPath = join(process.cwd(), 'public/data/rag/embeddings.json');
  const content = await readFile(embeddingsPath, 'utf-8');
  embeddingsCache = JSON.parse(content);
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
 */
export async function searchContext(
  query: string,
  options: {
    topK?: number;
    projectFilter?: string;
    minScore?: number;
  } = {}
): Promise<SearchResult[]> {
  const { topK = 6, projectFilter, minScore = 0.35 } = options;

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

  // Fallback: if nothing passes threshold but we have some results, take top 3
  if (filtered.length === 0 && sorted.length > 0 && sorted[0].score >= 0.25) {
    return sorted.slice(0, 3);
  }

  return filtered;
}

/**
 * Format search results as context string for the LLM
 */
export function formatContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '\n\n[No relevant documentation found. Answer based on general knowledge about Jacob or suggest they explore specific pages.]';
  }

  // Group by project/source
  const byProject = new Map<string, SearchResult[]>();
  for (const r of results) {
    const existing = byProject.get(r.chunk.project) || [];
    existing.push(r);
    byProject.set(r.chunk.project, existing);
  }

  const sections: string[] = [];
  for (const [project, chunks] of byProject) {
    const chunkTexts = chunks.map(r => {
      const relevance = r.score >= 0.55 ? 'HIGH' : r.score >= 0.40 ? 'MEDIUM' : 'LOW';
      return `[${r.chunk.section}] (relevance: ${relevance})\n${r.chunk.content}`;
    });
    sections.push(`### ${project}\n${chunkTexts.join('\n\n')}`);
  }

  return `\n\n## Retrieved Documentation\n\n${sections.join('\n\n---\n\n')}\n\n[Base your answer on the above documentation. Cite sources when possible.]`;
}
```

**Step 2: Commit**

```bash
git add src/lib/rag-server.ts
git commit -m "feat: add server-side RAG module for API routes"
```

---

## Task 7: Update ChatInterface with Toggle and Cloud Mode

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx`

**Why:** Add toggle switch to choose between Local (WebLLM) and Cloud (Claude API) modes.

**Step 1: Add mode state and toggle UI**

Add at the top of the component:

```typescript
type ChatMode = 'local' | 'cloud';

// Inside component:
const [mode, setMode] = useState<ChatMode>('cloud'); // Default to cloud for better UX
```

**Step 2: Add toggle switch in the UI**

Add after the terminal header, before messages:

```tsx
{/* Mode Toggle */}
<div className="px-4 py-2 border-b border-border flex items-center justify-between">
  <div className="flex items-center gap-2 text-sm">
    <span className={mode === 'local' ? 'text-cyan' : 'text-muted'}>Local</span>
    <button
      onClick={() => setMode(mode === 'local' ? 'cloud' : 'local')}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        mode === 'cloud' ? 'bg-cyan' : 'bg-gray-600'
      }`}
      aria-label={`Switch to ${mode === 'local' ? 'cloud' : 'local'} mode`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          mode === 'cloud' ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
    <span className={mode === 'cloud' ? 'text-cyan' : 'text-muted'}>Cloud</span>
  </div>
  <span className="text-xs text-muted">
    {mode === 'local' ? 'Runs in browser (WebGPU)' : 'Powered by Claude'}
  </span>
</div>
```

**Step 3: Add cloud message handler**

```typescript
const sendCloudMessage = async (userMessage: string) => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage }
        ]
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get response');
    }

    const data = await response.json();
    return data.message;
  } catch (err: any) {
    console.error('Cloud chat error:', err);
    throw err;
  }
};
```

**Step 4: Update handleSubmit to use the appropriate handler**

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim() || isLoading) return;

  // For local mode, require engine
  if (mode === 'local' && !engine) return;

  const userMessage = input.trim();
  setInput('');
  setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
  setIsLoading(true);

  try {
    let assistantMessage: string;

    if (mode === 'cloud') {
      assistantMessage = await sendCloudMessage(userMessage);
    } else {
      // Existing local WebLLM logic
      let ragContext = '';
      try {
        const results = await searchContext(userMessage);
        ragContext = formatContext(results);
      } catch (ragError) {
        console.warn('RAG search failed:', ragError);
      }

      const systemPromptWithContext = SYSTEM_PROMPT + ragContext;

      const response = await engine!.chat.completions.create({
        messages: [
          { role: 'system', content: systemPromptWithContext },
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: userMessage }
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      assistantMessage = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    }

    setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
  } catch (err) {
    console.error('Chat error:', err);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Sorry, something went wrong. Please try again.'
    }]);
  } finally {
    setIsLoading(false);
  }
};
```

**Step 5: Update initial state for cloud mode**

Cloud mode doesn't need WebLLM engine initialization, so update the initial view:

```typescript
// For cloud mode, show ready state immediately
if (mode === 'cloud' && messages.length === 0) {
  setMessages([{
    role: 'assistant',
    content: "Hi! I'm Jacob's AI assistant powered by Claude. Feel free to ask me about his background, projects, skills, or experience!"
  }]);
}
```

**Step 6: Commit**

```bash
git add src/components/chat/ChatInterface.tsx
git commit -m "feat: add Local/Cloud toggle to chat interface"
```

---

## Task 8: Update RAG Parameters for Better Retrieval

**Files:**
- Modify: `src/lib/rag.ts` (client-side)
- Modify: `src/lib/rag-server.ts` (server-side)

**Why:** With more content types (personal, blog, projects), we should retrieve more chunks and adjust thresholds.

**Step 1: Update client-side rag.ts**

Change defaults in `searchContext`:

```typescript
const { topK = 6, projectFilter, minScore = 0.35 } = options;
```

And update fallback threshold:

```typescript
if (filtered.length === 0 && sorted.length > 0 && sorted[0].score >= 0.25) {
  return sorted.slice(0, 3);
}
```

**Step 2: Verify server-side rag-server.ts has matching parameters**

Should already have `topK = 6` and `minScore = 0.35` from Task 6.

**Step 3: Commit**

```bash
git add src/lib/rag.ts src/lib/rag-server.ts
git commit -m "feat: tune RAG parameters for expanded content"
```

---

## Task 9: Regenerate Embeddings with All Content

**Files:**
- Regenerate: `public/data/rag/embeddings.json`

**Why:** We need to run the updated embedding generator to include all the new content.

**Step 1: Run embedding generation**

```bash
npm run generate-embeddings
```

**Step 2: Verify output includes new content**

Check the console output shows:
- Portfolio files (existing ~54 files)
- Personal files (4 new files: bio.md, experience.md, skills.md, contact.md)
- Blog files (2 blog posts)

**Step 3: Commit updated embeddings**

```bash
git add public/data/rag/embeddings.json
git commit -m "feat: regenerate embeddings with personal content and blog posts"
```

---

## Task 10: Test Both Chat Modes

**Files:** None (testing task)

**Why:** Verify both Local and Cloud modes work correctly with the expanded RAG.

**Step 1: Start development server**

```bash
npm run dev
```

**Step 2: Test Cloud mode**

Go to `/chat`, ensure toggle is on "Cloud" mode.

Test queries:
- "Tell me about Jacob" - Should retrieve bio content
- "What are Jacob's skills?" - Should retrieve skills content
- "What is Jacob's work experience?" - Should retrieve experience content
- "How does BTC Explorer work?" - Should retrieve project content

**Step 3: Test Local mode**

Switch toggle to "Local" mode. Wait for model to load.

Test the same queries and compare response quality.

**Step 4: Document any issues**

If issues found, create follow-up tasks.

---

## Task 11: Final Commit and Summary

**Files:** None (wrap-up task)

**Step 1: Review all changes**

```bash
git log --oneline -10
git diff HEAD~10 --stat
```

**Step 2: Create summary commit if needed**

If there are any uncommitted changes:

```bash
git add -A
git commit -m "chore: finalize AI chat improvements"
```

---

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| RAG Content | 18 projects only | Projects + Personal bio + Experience + Skills + Contact + Blog posts |
| Chat Modes | Local only (WebLLM) | Local + Cloud (Claude API) toggle |
| Embeddings | ~887 chunks | ~950+ chunks (estimate) |
| API | None | `/api/chat` endpoint with Claude |
| UI | Single mode | Toggle switch with mode indicator |

## Files Created/Modified

**Created:**
- `public/data/personal/bio.md`
- `public/data/personal/experience.md`
- `public/data/personal/skills.md`
- `public/data/personal/contact.md`
- `src/pages/api/chat.ts`
- `src/lib/rag-server.ts`
- `.env.example`

**Modified:**
- `scripts/generate-embeddings.ts`
- `src/components/chat/ChatInterface.tsx`
- `src/lib/rag.ts`
- `public/data/rag/embeddings.json`
