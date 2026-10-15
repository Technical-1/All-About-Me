# Project Q&A

## Overview

A serverless pipeline that takes encrypted document deliveries, decrypts and OCRs them, runs automated analysis with a large language model, and returns structured results to an upstream system. The interesting engineering angle is that it's built as a chain of independently-triggered, independently-scaling Azure Functions stages connected only through blob storage — and it includes a second workflow that re-checks new inputs against earlier results to report an updated status.

## Problem Solved

Processing large volumes of submitted documents by hand is slow and inconsistent. This system automates the mechanical parts — decrypting deliveries, pulling text out of mixed digital/scanned PDFs, and producing a normalized, structured result per document — so that the work downstream is consistent and machine-readable.

## Key Features

### Decoupled, blob-triggered pipeline
Decrypt, OCR, analysis, and batching each run as their own function triggered by new blobs in storage. Stages scale and retry independently, and every intermediate artifact is inspectable.

### Resilient text extraction
PyMuPDF handles documents with an embedded text layer; an optional OCRmyPDF/Tesseract fallback handles image-only pages. The fallback is feature-flagged so the pipeline still deploys where the OCR binary isn't available.

### Rate-limit-aware LLM integration
Every Azure OpenAI call is wrapped in a bounded retry loop that detects rate-limit conditions and backs off, so large batches complete without manual reruns.

### Re-evaluation
A separate workflow ingests new inputs plus a manifest of earlier results and reports, per item, whether the new material changes the result.

## Technical Highlights

### Storage as pipeline boundaries
Rather than orchestrating stages in-process, each boundary is a blob-storage location and each stage subscribes to the previous one's output. This gives independent scaling and retry per stage and makes the whole flow debuggable by inspecting intermediate blobs.

### Graceful OCR degradation
The OCR stage attempts to use OCRmyPDF and falls back to PyMuPDF-only extraction when it (or Tesseract) is unavailable, and supports an explicit switch to disable OCR entirely. This keeps a heavyweight native dependency from being a hard requirement for deployment.

### Bounded retry with rate-limit detection
The LLM integration implements attempt-limited retries with backoff and special-cases rate-limit responses, turning a common transient failure into a non-event for batch runs.

### Consolidation of fragmented repositories
The codebase had drifted into multiple repositories, including standalone earlier versions of stages that a later combined build absorbed. I consolidated them into one stage-organized monorepo, quarantining superseded code and clearly marking the live build so the lineage is obvious instead of misleading.

## Engineering Decisions

### Event-driven stages vs. one synchronous service
- **Constraint**: Deliveries arrive in bursts; decrypt, OCR, and LLM steps have wildly different latencies and failure modes.
- **Options**: One long-running request that does everything, vs. discrete blob-triggered stages.
- **Choice**: Discrete stages connected by blob storage.
- **Why**: Independent scaling/retry, no shared timeout, and inspectable intermediate state — at the cost of more moving parts, which is the right trade for reliability here.

### Keeping the LLM inside the Azure boundary
- **Constraint**: Inputs may be sensitive.
- **Options**: A third-party LLM API vs. Azure OpenAI.
- **Choice**: Azure OpenAI.
- **Why**: Keeps data within the same cloud/governance boundary as the rest of the pipeline rather than sending it to an external vendor.

### Archive rather than delete superseded code
- **Constraint**: Several repositories were earlier iterations of the same stages.
- **Options**: Delete the old versions, or keep them.
- **Choice**: Retain them (not deployed) instead of deleting.
- **Why**: They keep reference value for how the system evolved, while being clearly separated from the live, deployable code.

## Frequently Asked Questions

### How are the pipeline stages connected?
Through Azure Blob Storage. Each stage writes its output to a storage location that is the trigger source for the next stage, so there's no direct stage-to-stage coupling.

### Why are there both a combined build and standalone stages?
The combined build contains decrypt + OCR + analysis + batching together and is the current version; the standalone versions of those stages are kept for reference. For any stage you deploy the combined app *or* the standalone version, not both against the same storage.

### What happens to documents that are scanned images instead of digital PDFs?
PyMuPDF extracts text directly when there's an embedded text layer; for image-only pages the optional OCRmyPDF/Tesseract fallback runs, provided OCR is available and not disabled.

### How does it handle LLM rate limits?
LLM calls go through a retry wrapper that detects rate-limit responses and backs off before retrying, up to a bounded number of attempts.

### How is configuration handled?
Entirely through environment variables / Azure Application Settings — storage connection, the LLM key, the decryption password, and integration credentials. No secrets are stored in the repository.

### Can a stage be deployed and scaled on its own?
Yes. Each live stage is a self-contained Azure Functions app published and scaled independently.
