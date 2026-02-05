# Project Screenshots

This directory contains preview images for featured projects.

## File Structure

Each project folder should contain:
- `preview.png` - Static thumbnail (required, ~640px width)
- `preview.gif` - Animated preview (optional, 3-8 seconds, <2MB)

## Directory Naming

Directory names must match the project slug (lowercase, hyphens):
- `AHSR` → `ahsr/`
- `Git-Archiver-Web` → `git-archiver-web/`
- `Blackjack-Trainer` → `blackjack-trainer/`

## GIF Specifications

For best results:
- Duration: 3-8 seconds (looping)
- Resolution: 640px max width
- File size: Under 2MB
- Frame rate: 15-30fps

Use tools like `gifsicle` to optimize:
```bash
gifsicle -O3 --colors 256 input.gif -o output.gif
```

## Behavior

- Desktop: GIF plays on hover
- Mobile: GIF plays when card is centered in viewport
- If GIF is missing, static PNG shows with zoom effect on hover
- Respects `prefers-reduced-motion` accessibility setting
