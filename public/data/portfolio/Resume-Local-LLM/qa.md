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

### Micro-Prompt Engineering for Small Models
Local models (0.5B-7B parameters) produce much better output with focused, constrained prompts than with large context windows. I designed a micro-prompt architecture that splits resumes by detected headers into ~400-char chunks, then runs three focused prompts per section: score (0-100), feedback (one specific improvement), and keyword extraction. This approach yields 3-5 second responses per chunk versus 45-60 seconds for a full resume, with significantly higher output quality. I also learned that certain sections (Skills, Certifications, Education) need to be "passed through" unchanged because small models consistently hallucinate additional skills or mangle structured formatting.

### Cross-Store State Architecture
I chose Zustand over Redux for state management because the store-per-domain pattern maps naturally to this app's architecture: AI model lifecycle, app settings, user profile, and learning data are genuinely independent concerns. The interesting design decision was selective persistence — only settings go to localStorage, while session data (resume content, job descriptions) is deliberately ephemeral for privacy. Stores communicate via `getState()` for synchronous cross-store reads, which keeps them decoupled without needing a global event bus.

## Development Story

- **Hardest Part**: Getting AI output quality consistent with small local models. The micro-prompt architecture and passthrough section patterns emerged from extensive testing where full-resume prompts produced unreliable results. Anti-hallucination rules (never invent metrics, never add skills not in original) had to be embedded directly into every prompt template.
- **Lessons Learned**: WebGPU browser support is still limited — Safari doesn't support it at all, and Firefox requires a flag. The app needed a complete deterministic fallback path for users without WebGPU. Also learned that IndexedDB has quirks with large blob storage that required careful error handling and database recreation on corruption.
- **Future Plans**: Add more career modes, improve the learning system with more sophisticated pattern matching, and expand browser support as WebGPU adoption grows.

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
