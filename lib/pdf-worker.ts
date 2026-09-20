import { pdfjs } from "react-pdf";

// Populated by scripts/copy-pdf-worker.mjs, which runs before `next dev` and
// `next build`.
export const PDF_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";

/** Passed to react-pdf's `<Document options>`; must be module-level to stay referentially stable. */
export const PDF_OPTIONS = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
} as const;

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
}

export { pdfjs };
