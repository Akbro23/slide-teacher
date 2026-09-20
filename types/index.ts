/** A single text run extracted from a PDF page, with normalised geometry. */
export interface PdfTextItem {
  /** Index of this item within its page. Used as the stable handle the model refers to. */
  index: number;
  text: string;
  /** Left edge, 0-1, fraction of page width. */
  x: number;
  /** Top edge, 0-1, fraction of page height. Origin is top-left. */
  y: number;
  /** 0-1, fraction of page width. */
  width: number;
  /** 0-1, fraction of page height. */
  height: number;
}

export interface PdfPageText {
  /** 1-based page number, matching react-pdf's `pageNumber`. */
  page: number;
  items: PdfTextItem[];
  /** Reading-order plain text for the page, used as prompt context. */
  text: string;
}

export interface PdfDocumentText {
  numPages: number;
  pages: PdfPageText[];
}

/** A model-identified key term, anchored to a position on a page. */
export interface KeyTerm {
  id: string;
  term: string;
  page: number;
  /** 0-1 horizontal centre of the anchoring text item. */
  x: number;
  /** 0-1 vertical centre of the anchoring text item. */
  y: number;
}

export const EXPLAIN_TYPES = ["base", "example", "analogy", "elaborate"] as const;

export type ExplainType = (typeof EXPLAIN_TYPES)[number];

/** Viewport-space point the explanation popover is anchored to. */
export interface AnchorPoint {
  x: number;
  y: number;
}

/** What the glass panel is currently explaining. */
export interface ExplainTarget {
  term: string;
  /** Surrounding slide text, so the model can disambiguate the term. */
  context: string;
  page: number;
  /** Distinguishes a clicked dot from an arbitrary user selection. */
  source: "term" | "selection";
  /** Where the user clicked, in viewport coordinates. */
  anchor: AnchorPoint;
}

export interface SavedNote {
  id: string;
  term: string;
  explanation: string;
  page: number;
  createdAt: number;
}
