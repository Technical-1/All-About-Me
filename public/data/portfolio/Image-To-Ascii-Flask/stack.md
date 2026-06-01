# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | 3.12 | Strong imaging ecosystem; pinned via `runtime.txt` |
| Framework | Flask | ≥3.0.0 | Minimal surface for a one-endpoint app; no ORM/admin overhead |
| Imaging | Pillow | ≥10.2.0 | Mature decoding + high-quality LANCZOS resampling |
| SVG rasterization | cairosvg | ≥2.7.1 | Converts SVG uploads to PNG so Pillow can process them |
| WSGI server | gunicorn | ≥21.2.0 | Production-grade concurrent serving |

## Frontend

- **Framework**: None — server-rendered `index.html` with vanilla JavaScript
- **State Management**: Module-scoped variables in `script.js`
- **Styling**: Hand-written CSS (`static/style.css`)
- **Build Tool**: None — static assets served directly by Flask

## Backend

- **Runtime**: Python 3.12
- **Framework**: Flask
- **API Style**: REST-ish — `POST /convert` returns JSON, plus static/asset routes
- **Auth**: None (public tool)

## Infrastructure

- **Hosting**: Render (Docker web service)
- **Containerization**: Docker on `python:3.12-slim` with `libcairo2` installed
- **CI/CD**: Render auto-deploy on push
- **Monitoring**: None (server-side exception logging via Flask's logger)

## Development Tools

- **Package Manager**: pip (`requirements.txt`)
- **Testing**: None — small enough to verify by hand
- **Process model**: gunicorn with 2 workers (`Procfile` / Docker `CMD`)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `Flask` | Web framework: routing, request parsing, JSON responses |
| `Pillow` | Image decoding, grayscale conversion, resizing |
| `cairosvg` | Rasterizes SVG uploads to PNG before conversion |
| `gunicorn` | Production WSGI server |
| `Werkzeug` | Flask's WSGI/HTTP toolchain (request/file handling) |
