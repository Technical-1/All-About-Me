# Project Q&A Knowledge Base

## Overview

AI Resume Optimizer is a privacy-first career development platform that runs entirely in the browser. It uses WebLLM for local AI inference and implements RAG (Retrieval-Augmented Generation) with local vector embeddings to improve results over time. The app solves the problem of resume optimization tools that require uploading sensitive career data to third-party servers — here, your data never leaves your device.

## Key Features

- **8 Career Modes**: Resume Review, Job Optimization, Industry Creation, Complete Overhaul, LinkedIn Optimization, Cover Letter Studio, Interview Preparation, and Skill Gap Analysis — each a self-contained feature module with mode-specific AI prompts
- **Local AI Inference**: 7 LLM models (Qwen 0.5B to 7B, Llama 3B, Mistral 7B, Phi 3.5) running via WebGPU in the browser with no server calls
- **RAG-Powered Learning**: Documents are chunked into overlapping 500-char segments, embedded as 384-dimensional vectors, and stored in IndexedDB for semantic similarity search that enhances future analyses
- **Micro-Prompt Architecture**: Instead of sending entire resumes to small local models, content is split into ~400-char section chunks with focused prompts (score, feedback, keyword extraction) that complete in 3-5 seconds each
- **Deterministic Fallback**: Full analysis available without AI — keyword matching against 10 industry keyword maps, section scoring, and ATS score calculation
- **PWA with Offline Support**: Installable as a desktop/mobile app with service worker caching

## Technical Highlights

### Running LLMs in the Browser
I used MLC AI's WebLLM library to run quantized LLMs directly in the browser via WebGPU. The biggest challenge was managing model loading — models range from 350MB to 4GB and need to be cached in IndexedDB to avoid re-downloading. I implemented a progress tracking system with loading phases (downloading, initializing, ready) and cache detection. WebLLM also had to be excluded from Vite's dependency optimization because the pre-bundling process breaks it.

### Building a Local RAG System
The RAG implementation uses HuggingFace's Transformers.js to generate embeddings locally. Documents are split into 500-character chunks with 100-character overlap to maintain context at chunk boundaries. The vector index lives in IndexedDB alongside the documents. When a new resume is analyzed, the system performs cosine similarity search against all stored chunks, and results above 0.6 similarity are injected as context into the AI prompts. I implemented retry logic with exponential backoff for model loading since HuggingFace CDN can be unreliable.

### Micro-Prompt Architecture for Small Models
Small local models (0.5B-7B parameters) handle short, single-purpose prompts far more reliably than a single large prompt covering the whole resume. The orchestrator in `src/services/promptOrchestrator.ts` splits the resume by detected section headers into ~400-char chunks and runs three narrow prompts per section: score (0-100), one-line feedback, and keyword extraction. The result is 3-5 second responses per chunk instead of 45-60 seconds for a full-resume prompt, with output that stays on task. Structured sections (Skills, Certifications, Education, Contact) are routed through a passthrough path because small models tend to hallucinate items or mangle formatting in those areas; only Experience, Summary, Projects, and Awards are passed to the LLM for rewriting.

### Cross-Store State Architecture
I chose Zustand over Redux for state management because the store-per-domain pattern maps naturally to this app's architecture: AI model lifecycle, app settings, user profile, and learning data are genuinely independent concerns. The interesting design decision was selective persistence — only settings go to localStorage, while session data (resume content, job descriptions) is deliberately ephemeral for privacy. Stores communicate via `getState()` for synchronous cross-store reads, which keeps them decoupled without needing a global event bus.

## Engineering Decisions

### Browser-only inference vs. server-side API
- **Constraint**: Resume content is sensitive personal data; the differentiator is "your data never leaves your device"
- **Options**: Hosted LLM API (OpenAI, Anthropic), self-hosted inference server, on-device via WebGPU
- **Choice**: WebLLM running quantized models on WebGPU, with a deterministic keyword/scoring fallback for unsupported browsers
- **Why**: Eliminates the network boundary entirely, removes recurring API costs, and lets the app run offline after the first model download. The trade-off is a 350MB-4GB one-time download and no Safari support.

### Micro-prompts vs. single full-resume prompt
- **Constraint**: Small local models (0.5B-7B) degrade sharply on long context and produce inconsistent, often hallucinated output when asked to evaluate a whole resume at once
- **Options**: One large prompt with the full resume; per-section micro-prompts; multi-turn conversational refinement
- **Choice**: Per-section micro-prompts (score, feedback, keywords) on ~400-char chunks
- **Why**: Brings each response under 5 seconds and keeps outputs grounded in the chunk in front of the model. The orchestrator aggregates section results into the overall analysis.

### Passthrough sections for structured content
- **Constraint**: AI rewrites of Skills, Certifications, Education, and Contact sections introduced incorrect skills, fabricated certifications, and mangled dates
- **Options**: Tune prompts harder, switch to a larger model, or skip AI for these sections
- **Choice**: Route structured sections through a passthrough path; only Experience, Summary, Projects, and Awards go through LLM rewriting
- **Why**: AI adds no value in sections that are essentially lists of facts; preserving them verbatim protects data integrity.

### Custom IndexedDB vector store vs. external vector DB
- **Constraint**: The RAG layer needs to run entirely client-side; no server is available to host a vector database
- **Options**: WebAssembly SQLite + vector extension, in-memory vectors, custom IndexedDB store
- **Choice**: Float32Array vectors stored in IndexedDB via Dexie, with brute-force cosine similarity
- **Why**: Expected per-user volume is hundreds (not millions) of chunks, so a linear scan is fast enough and avoids pulling in a heavier dependency.

## Frequently Asked Questions

### How does the AI run without a server?
WebLLM uses WebGPU (a browser API for GPU-accelerated computation) to run quantized LLM models directly in the browser. Models are downloaded once from a CDN and cached in IndexedDB for future use. All inference happens on the user's GPU — no data ever leaves the device.

### How does the RAG system work without a vector database?
I built a custom vector search layer on top of IndexedDB using Dexie.js. Documents are split into overlapping chunks, embedded using Transformers.js (which also runs locally), and stored as Float32Arrays in IndexedDB. Search is a brute-force cosine similarity scan — it's fast enough for the expected data volume (hundreds, not millions, of documents per user).

### Why micro-prompts instead of sending the full resume?
Small local models (0.5B-7B parameters) degrade significantly with long context. By splitting resumes into ~400-char section chunks and running focused prompts (score, feedback, keywords), I get 3-5 second responses with higher quality output than a single 3000+ char prompt that takes 45-60 seconds and often produces confused results.

### Why are some resume sections returned unchanged?
Through testing, I found that AI rewrites of Skills, Certifications, Education, and Header/Contact sections consistently introduced errors — hallucinated skills, mangled dates, invented certifications. These "passthrough sections" are returned unchanged while Experience, Summary, Projects, and Awards sections benefit from AI enhancement.

### How does the learning system improve over time?
When an analysis scores above 60, the prompt and response are recorded. The learning service extracts keyword patterns, structure patterns (markdown headers), and tone patterns (formal/casual indicators). Future prompts for the same mode are automatically enhanced with top-performing patterns, ranked by frequency multiplied by average user rating.

### What happens when the AI model isn't loaded?
The app degrades gracefully to deterministic analysis: keyword matching against 10 industry-specific keyword maps, section scoring based on content structure, and ATS score calculation from keyword density and formatting. Users get useful results without AI, just not the AI-enhanced feedback and rewriting capabilities.

### How is user privacy actually enforced?
Beyond the "no server" architecture, the app enforces Content Security Policy headers via a custom Vite plugin, restricting external connections to model CDNs only. Session data (resume content, job descriptions) is never persisted — it exists only in memory during the browser session. Users can toggle learning features off, export all data, or delete everything with one click. There are no cookies, no analytics, and no tracking.
