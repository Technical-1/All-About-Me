# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | 3.8+ | Ubiquitous, great imaging ecosystem, ideal for a portable CLI |
| Imaging | Pillow | ≥10.2.0 | Mature, well-maintained decoding + high-quality LANCZOS resampling |
| CLI parsing | `argparse` | stdlib | No extra dependency for a handful of flags |

## Backend

- **Runtime**: Python 3.8+
- **Entry point**: `img2ascii.py` (`main()` for CLI, `image_to_ascii()` as a library)
- **API Style**: Command-line flags; importable function for programmatic use

## Infrastructure

- **Hosting**: None — runs locally as a script
- **CI/CD**: None
- **Monitoring**: None

## Development Tools

- **Package Manager**: pip
- **Testing**: None — small enough to verify by hand against sample images

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `Pillow` | Opens images, converts to grayscale, and resizes to the character grid |
