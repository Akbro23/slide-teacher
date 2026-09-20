import type { KeyTerm, PdfDocumentText, PdfTextItem } from "@/types";

// Deliberately free of any pdf.js import: this module is reachable from the
// server-rendered pass of the client page, where pdf.js cannot be loaded.

/** Stable identity for a term, so a dot and the open panel agree on it. */
export function keyTermId(page: number, term: string): string {
  return `${page}:${term.toLowerCase()}`;
}

/**
 * Horizontal centre of `term` inside a text run.
 *
 * pdf.js often emits a whole line as one run, so the run's own centre can be
 * several words away from the term. Interpolating by character offset assumes
 * uniform advance widths — wrong in detail, but it puts the dot on the right
 * word, which is all a 12px marker needs.
 */
function centreOfTerm(item: PdfTextItem, term: string): number {
  const offset = item.text.toLowerCase().indexOf(term.toLowerCase());
  if (offset === -1 || item.text.length === 0) {
    return item.x + item.width / 2;
  }

  const centreChar = offset + Math.min(term.length, item.text.length - offset) / 2;
  return item.x + (item.width * centreChar) / item.text.length;
}

/**
 * Resolves the model's `{ page, itemIndex }` answers against the locally held
 * geometry. The model never sees or emits coordinates, so it cannot invent them.
 */
export function attachPositions(
  pdfText: PdfDocumentText,
  hits: Array<{ page: number; term: string; itemIndex: number }>,
): KeyTerm[] {
  const byPage = new Map(pdfText.pages.map((page) => [page.page, page]));
  const seen = new Set<string>();
  const terms: KeyTerm[] = [];

  for (const hit of hits) {
    const item = byPage.get(hit.page)?.items[hit.itemIndex];
    if (!item) continue;

    // One dot per term per page, even if the model lists it twice.
    const id = keyTermId(hit.page, hit.term);
    if (seen.has(id)) continue;
    seen.add(id);

    terms.push({
      id,
      term: hit.term,
      page: hit.page,
      x: centreOfTerm(item, hit.term),
      y: item.y + item.height / 2,
    });
  }

  return terms;
}

/** Slide text around a term, giving the model enough to disambiguate it. */
export function getPageContext(
  pdfText: PdfDocumentText,
  page: number,
  maxChars = 1200,
): string {
  const text = pdfText.pages.find((entry) => entry.page === page)?.text ?? "";
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
