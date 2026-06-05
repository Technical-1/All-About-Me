# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | 3.10+ | First-class Azure Functions support and the strongest ecosystem for PDF/OCR/LLM work |
| Compute | Azure Functions | v2 model, host `[4.*, 5.0.0)` | Serverless, event-driven scaling that matches bursty document arrival |
| Storage | Azure Blob Storage | `azure-storage-blob` 12.x | Durable stage-to-stage handoff with native blob triggers |
| LLM | Azure OpenAI | `openai` 1.x | Keeps document data inside the Azure boundary rather than a third-party endpoint |

## Backend

- **Runtime**: Python on Azure Functions (consumption/premium plan compatible)
- **Trigger model**: Blob triggers for pipeline stages, HTTP routes for status/job queries
- **API style**: Event-driven (blob) + a few HTTP endpoints for operational visibility
- **Auth**: Function-level keys for HTTP routes; credentials and connection strings via application settings

## Document Processing

- **Text extraction**: PyMuPDF
- **OCR fallback**: OCRmyPDF + Tesseract (optional, feature-flagged)
- **Imaging**: Pillow
- **Decryption**: `pyzipper`

## Infrastructure

- **Hosting**: Azure Functions
- **State**: Azure Blob Storage as pipeline boundaries
- **Secrets**: Environment variables / Azure Application Settings (no secrets in source)
- **CI/CD**: Azure Functions Core Tools publish, per stage
- **Monitoring**: Azure Functions logging (Application Insights compatible)

## Development Tools

- **Package Manager**: pip (per-stage dependency manifests)
- **Local runtime**: Azure Functions Core Tools v4
- **Testing**: none formal — stages are verified against sample inputs in local storage

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `azure-functions` | Functions runtime bindings and triggers |
| `azure-storage-blob` | Read/write pipeline storage |
| `PyMuPDF` | Primary PDF text extraction |
| `ocrmypdf` / `pytesseract` | OCR fallback for image-only pages |
| `openai` | Azure OpenAI client for analysis and re-evaluation |
| `pyzipper` | Decryption of incoming deliveries |
| `requests` | Upstream integration |
