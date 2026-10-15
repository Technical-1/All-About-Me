# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | 5.9 | Type safety with strict mode + additional checks |
| UI Framework | React | 19 | Component-based UI with lazy loading |
| Build Tool | Vite | 7 | Fast dev server + production bundling with manual chunk splitting |
| Runtime | Browser only | WebGPU | No server — all processing client-side |

## Frontend

- **Framework**: React 19 with JSX
- **State Management**: Zustand 5 + Immer (4 stores with selective persistence)
- **Routing**: React Router v7 with two-way URL sync and lazy-loaded mode components
- **Styling**: Plain CSS with mode-specific stylesheets
- **Icons**: Lucide React
- **Markdown**: react-markdown for rendering AI output

## AI & Machine Learning

- **LLM Inference**: @mlc-ai/web-llm (runs Qwen, Llama, Mistral, Phi models via WebGPU)
- **Embeddings**: @huggingface/transformers (MiniLM, GTE, BGE models for RAG)
- **Vector Search**: Custom cosine similarity implementation on IndexedDB
- **Prompt Strategy**: Micro-prompt architecture with ~400-char section chunks

## Data Layer

- **Database**: Dexie.js 4 (IndexedDB wrapper) with 7 tables
- **Persistence**: Selective localStorage for settings via Zustand persist middleware
- **File Parsing**: PDF.js (PDF), Mammoth.js (DOCX), native (TXT)
- **Export**: docx library (DOCX generation), html2pdf.js (PDF export)
- **Security**: DOMPurify for HTML sanitization

## Infrastructure

- **Hosting**: Vercel (static deployment)
- **CI/CD**: GitHub Actions (6-job pipeline: quality, security, test, performance, build, deploy)
- **PWA**: Service worker with cache-first strategy, installable on desktop/mobile

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 with React, JSX-a11y, Prettier plugins
- **Formatting**: Prettier (no semicolons, single quotes, 100 char width)
- **Testing**: Vitest 4 + React Testing Library (25 test files, 80% coverage thresholds)
- **Pre-commit**: Husky + lint-staged (auto-fix + format on commit)
- **Bundle Analysis**: rollup-plugin-visualizer (dist/stats.html)
- **Minification**: Terser (strips console.log and debugger in production)
- **Security Audit**: audit-ci (moderate+ vulnerabilities fail CI)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@mlc-ai/web-llm` | Browser LLM inference via WebGPU (Qwen, Llama, Mistral, Phi) |
| `@huggingface/transformers` | Local embedding models for RAG vector search |
| `dexie` | IndexedDB wrapper for 7-table local database |
| `zustand` + `immer` | State management with immutable updates and selective persistence |
| `pdfjs-dist` | PDF text extraction |
| `mammoth` | DOCX-to-text conversion |
| `docx` | DOCX document generation for export |
| `html2pdf.js` | PDF export from HTML content |
| `dompurify` | HTML sanitization (XSS prevention) |
| `diff-match-patch` | Change tracking for document edit comparison |
| `react-markdown` | Rendering AI-generated markdown output |
| `lucide-react` | Icon library used throughout the UI |
