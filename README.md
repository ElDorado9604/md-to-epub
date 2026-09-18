# Markdown → EPUB

Minimal, production-ready, static React + TypeScript web app that converts Markdown (`.md`) files to EPUB (`.epub`) entirely in the browser. No backend required.

## Features

- Select a local `.md` file
- Optional title and author
- Client-side conversion using `marked` + `jszip`
- Valid minimal EPUB 3 package
- Download the resulting `.epub`

## Tech stack

- React 18 + TypeScript
- Vite
- marked (Markdown → HTML)
- jszip (EPUB packaging)

## Development

```bash
npm install
npm run dev
```

## Build & Deploy (GitHub Pages)

```bash
npm run build
# or
npm run deploy   # requires gh-pages
```

The `base` in `vite.config.ts` is set to `/md-to-epub/`. Adjust it to match your repository name if needed.

## License

MIT
