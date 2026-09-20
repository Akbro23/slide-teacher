import type { PdfDocumentText, PdfPageText, PdfTextItem } from "@/types";
import { PDF_OPTIONS, pdfjs } from "@/lib/pdf-worker";

// This module loads pdf.js, so it must only ever be imported dynamically from
// the browser. Pure helpers that operate on its output live in lib/terms.ts.

/** Shape of the text-run entries pdf.js returns; marked-content entries lack `str`. */
interface RawTextItem {
  str: string;
  width: number;
  height: number;
  transform: number[];
  hasEOL: boolean;
}

function isTextRun(item: unknown): item is RawTextItem {
  return typeof (item as RawTextItem)?.str === "string";
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Reads every page's text runs and normalises their geometry to 0-1 with a
 * top-left origin, so dot positions survive any render scale or zoom level.
 *
 * pdf.js reports positions in PDF user space (bottom-left origin, unrotated).
 * `viewport.convertToViewportPoint` handles both the flip and any page
 * rotation, which raw `transform` arithmetic would miss.
 */
export async function extractTextWithPositions(
  file: File | ArrayBuffer,
): Promise<PdfDocumentText> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const doc = await pdfjs.getDocument({ ...PDF_OPTIONS, data }).promise;

  try {
    const pages: PdfPageText[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      const items: PdfTextItem[] = [];
      let text = "";

      for (const raw of content.items) {
        if (!isTextRun(raw)) continue;

        text += raw.str;
        if (raw.hasEOL) text += "\n";

        const trimmed = raw.str.trim();
        if (!trimmed) continue;

        const [, skewY, skewX, , translateX, translateY] = raw.transform;
        // Glyph height from the transform matrix; `raw.height` is 0 for some fonts.
        const glyphHeight =
          Math.hypot(skewY, skewX) || raw.height || viewport.height * 0.02;

        const [left, baseline] = viewport.convertToViewportPoint(
          translateX,
          translateY,
        );

        items.push({
          index: items.length,
          text: trimmed,
          x: clamp01(left / viewport.width),
          y: clamp01((baseline - glyphHeight) / viewport.height),
          width: clamp01(raw.width / viewport.width),
          height: clamp01(glyphHeight / viewport.height),
        });
      }

      pages.push({ page: pageNumber, items, text: text.trim() });
      page.cleanup();
    }

    return { numPages: doc.numPages, pages };
  } finally {
    await doc.destroy();
  }
}
