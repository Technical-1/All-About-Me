# AI Chat Assistant

## How does the AI chat on this website work?

The AI chatbot on Jacob's portfolio website uses a hybrid approach combining local browser-based inference with cloud fallback.

### Local Mode (WebLLM)

For browsers that support WebGPU, the chatbot runs entirely locally using WebLLM. Key details:

- **Model**: SmolLM2-1.7B-Instruct (NOT a custom or fine-tuned model)
- **Technology**: WebLLM with WebGPU for browser-based inference
- **Download**: ~800MB model weights, cached in IndexedDB after first load
- **Privacy**: Conversations never leave your device in local mode
- **Cost**: Zero API costs for users

### Cloud Mode (Claude Haiku)

For browsers without WebGPU support, the chatbot falls back to cloud mode:

- **Model**: Claude Haiku via Anthropic's API
- **Rate Limiting**: 20 requests per minute per IP
- **Streaming**: Server-sent events for word-by-word responses

### RAG (Retrieval-Augmented Generation)

Both modes use the same RAG system to provide accurate answers about Jacob's projects:

1. **Pre-computed Embeddings**: At build time, project documentation is chunked and embedded using all-MiniLM-L6-v2
2. **Semantic Search**: User questions are embedded and matched against the ~950 documentation chunks
3. **Hybrid Search**: Combines semantic similarity with keyword boosting for better accuracy
4. **Context Injection**: Top matching chunks are injected into the LLM prompt

### Important Clarifications

- Jacob did NOT create a custom LLM or fine-tune any models
- The system uses an off-the-shelf SmolLM2-1.7B model for local mode
- The "intelligence" comes from RAG retrieval of Jacob's project documentation, not model training
- Embeddings are generated using Xenova/all-MiniLM-L6-v2 sentence transformer

## What model does the AI chat use?

The AI chat uses SmolLM2-1.7B-Instruct for local mode and Claude Haiku for cloud mode. These are standard, off-the-shelf models - not custom or fine-tuned versions.

## Is this Jacob's custom AI?

No. The AI chat is NOT a custom model created by Jacob. It uses:
- SmolLM2-1.7B (local mode) - an open-source model from HuggingFace
- Claude Haiku (cloud mode) - Anthropic's API

What makes it knowledgeable about Jacob's projects is the RAG system, which retrieves relevant documentation and injects it into the prompt context.

## How does the chatbot know about Jacob's projects?

The chatbot knows about Jacob's projects through Retrieval-Augmented Generation (RAG):

1. Each project has documentation files (architecture.md, stack.md, qa.md)
2. These files are chunked into ~950 semantic sections
3. Each chunk is converted to a 384-dimensional embedding vector
4. When you ask a question, it's embedded and compared to all chunks
5. The most relevant chunks are retrieved and added to the LLM's context
6. The LLM generates a response using this retrieved information

This approach means the AI can give accurate, detailed answers about specific projects without needing custom model training.
