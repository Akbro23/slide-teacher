# Slide Teacher

AI-powered PDF slide explainer for students. Upload a lecture PDF, click marked key terms or select any text, and get an explanation in a glassmorphism overlay panel.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # then paste your Gemini API key
pnpm dev
```

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The app runs without one, but no dots appear and the explain panel shows an error — text selection and PDF viewing still work.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | yes | Gemini API key. Server-side only, never sent to the browser. `GOOGLE_GENERATIVE_AI_API_KEY` also works. |
| `AI_MODEL` | no | Overrides the model. Defaults to `gemini-3.5-flash-lite`. |

To see which models your key can use:

```bash
node --env-file=.env.local scripts/list-models.mjs
```

## Tech stack

- **Framework** — Next.js 16 (App Router), TypeScript, pnpm
- **UI** — shadcn/ui (neutral, dark by default), Tailwind CSS v4, framer-motion
- **PDF** — react-pdf / pdfjs-dist v5, rendered and parsed entirely client-side
- **AI** — Vercel AI SDK (`ai` v7) with `@ai-sdk/google`
- **Data fetching** — TanStack Query v5, `staleTime: Infinity` for in-session caching

The AI SDK sits between the app and the provider, so switching to OpenAI or
Anthropic means editing the two lines in `lib/ai.ts` — nothing else imports a
provider.

## How it works

**Text extraction** — `extractTextWithPositions()` in `lib/pdf-utils.ts` reads
each page's text runs via pdfjs-dist and normalises their geometry to 0–1 with
a top-left origin. Positions are therefore independent of render scale, zoom, and
page size. `viewport.convertToViewportPoint` is used rather than raw `transform`
arithmetic so rotated pages come out right.

**Key term identification** — the client sends only *indexed text* to
`/api/extract-terms`; coordinates never leave the browser. The model answers with
`{ page, term, itemIndex }`, and `attachPositions()` in `lib/terms.ts` resolves
those indices back against the local geometry. The model therefore has no
opportunity to invent coordinates, and the request is far smaller.

**Batching** — pages are marked ten at a time rather than one request per page.
Gemini's free tier allows only a handful of requests per minute, so per-page
fan-out exhausts the quota on any real deck.

**Dot anchoring** — pdf.js often emits a whole line as a single text run, so a
dot placed at the run's centre can land several words from the term.
`centreOfTerm()` interpolates by character offset within the run instead.

**Caching** — each `(term, explainType)` pair is a TanStack Query key held for
the whole session. Re-opening a term or re-clicking an extra is instant and costs
no tokens. Example / Analogy / Elaborate are separate queries, each `enabled` by
its button, appended below the base explanation.

**Graceful degradation** — if term extraction fails (no key, rate limit, bad
response), the viewer still opens and text selection still works. Losing the dots
never costs you the document.

## Project structure

```
app/
  layout.tsx                Root layout: Inter, Providers, Toaster
  page.tsx                  Upload → processing → viewing state machine
  api/
    extract-terms/route.ts  POST indexed page text → key terms with indices
    explain/route.ts        POST term + explainType → explanation prose
components/
  providers.tsx             ThemeProvider + QueryClientProvider + TooltipProvider
  navbar.tsx                Logo, PDF name, notes toggle, theme toggle
  theme-toggle.tsx          CSS-driven sun/moon, no mount flash
  upload-zone.tsx           Drag-and-drop PDF upload
  pdf-viewer.tsx            Paged rendering, dot overlay, selection handling
  dot-marker.tsx            Positioned dot with tooltip
  glass-panel.tsx           Explanation panel and its queries
  notes-sidebar.tsx         Collapsible saved-notes sidebar
hooks/
  use-notes.ts              localStorage-backed notes via useSyncExternalStore
lib/
  ai.ts                     Provider and model selection (the only swap point)
  pdf-utils.ts              pdf.js text + position extraction (browser only)
  pdf-worker.ts             Worker and asset URLs
  terms.ts                  Pure geometry helpers, safe on the server
scripts/
  copy-pdf-worker.mjs       Copies pdf.js worker/cmaps/fonts into public/
  list-models.mjs           Lists models the configured key can use
  make-sample-pdf.mjs       Generates tmp/sample-slides.pdf for testing
types/
  index.ts                  Shared types
```

## Notes on the build

`lib/pdf-utils.ts` must only be imported dynamically from the browser — pdf.js
touches browser globals at import time and would break the server pass of the
client page. Pure helpers live in `lib/terms.ts` for that reason.

`scripts/copy-pdf-worker.mjs` runs before `pnpm dev` and `pnpm build`. It keeps
`public/pdfjs` in sync with the installed pdfjs-dist version, which must match the
copy react-pdf resolves — hence `pdfjs-dist` is pinned exactly.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Copy pdf.js assets, then start the dev server |
| `pnpm build` | Copy pdf.js assets, then build for production |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `node scripts/make-sample-pdf.mjs` | Write a 3-slide test PDF to `tmp/` |
