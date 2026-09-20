# Slide Teacher — agent notes

AI-powered PDF slide explainer. See `README.md` for setup and architecture.
This file records the constraints that are easy to break.

## Hard constraints

**Never import `lib/pdf-utils.ts` statically from a component.** It loads pdf.js,
which touches browser globals at import time and breaks the server pass of the
client page. Import it dynamically (`await import(...)`) inside an event handler.
Pure helpers that operate on its output belong in `lib/terms.ts`, which must stay
free of any pdf.js import.

**Keep `pdfjs-dist` pinned to an exact version.** It must match the version
`react-pdf` resolves, or the worker and the API disagree at runtime. Check with
`pnpm why pdfjs-dist` — it should report one version.

**Coordinates never go to the model.** The client sends indexed text only; the
model returns `{ page, term, itemIndex }` and the client resolves positions
locally. Do not "simplify" this by asking the model to echo x/y — it will invent
them.

**Batch pages in `/api/extract-terms`.** One request per page looks cleaner and
immediately exhausts Gemini's free-tier per-minute quota. `PAGES_PER_BATCH` and
`CONCURRENCY` exist for that reason.

**All provider access goes through `getModel()` in `lib/ai.ts`.** Routes depend
only on the AI SDK's `LanguageModel` interface, so swapping providers is a
two-line change. Do not import `@ai-sdk/google` anywhere else.

## Conventions

- Explanations are non-streaming `generateText` calls returning JSON, which is
  what makes `staleTime: Infinity` caching in TanStack Query work. Introducing
  streaming means rethinking the cache.
- Structured output uses `generateText` + `Output.object({ schema })` from AI SDK
  v7, not the older `generateObject`.
- React Compiler lint rules are on: no `setState` inside an effect body. Read
  external stores with `useSyncExternalStore` (see `hooks/use-notes.ts`) and
  derive theme-dependent UI from the `dark` class rather than mount state.
- Term extraction failure must never block the viewer. Selection-based explaining
  is the fallback path.

## Testing without a real deck

```bash
node scripts/make-sample-pdf.mjs   # writes tmp/sample-slides.pdf
node --env-file=.env.local scripts/list-models.mjs
```

`tmp/` and `public/pdfjs/` are generated and gitignored.
