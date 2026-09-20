"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { GlassPanel } from "@/components/glass-panel";
import { Navbar } from "@/components/navbar";
import { NotesPopover } from "@/components/notes-popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadZone } from "@/components/upload-zone";
import { useNotes } from "@/hooks/use-notes";
import { attachPositions, getPageContext, keyTermId } from "@/lib/terms";
import type {
  AnchorPoint,
  ExplainTarget,
  KeyTerm,
  PdfDocumentText,
} from "@/types";

// pdf.js touches browser-only globals at import time, so the viewer can never
// be part of the server bundle.
const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((module) => module.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 flex-1 p-6">
        <Skeleton className="mx-auto aspect-video w-full max-w-4xl" />
      </div>
    ),
  },
);

type Status = "idle" | "processing" | "ready";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<PdfDocumentText | null>(null);
  const [terms, setTerms] = useState<KeyTerm[]>([]);
  const [page, setPage] = useState(1);

  const [target, setTarget] = useState<ExplainTarget | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const { notes, addNote, removeNote } = useNotes();

  const handleFile = useCallback(async (uploaded: File) => {
    setFile(uploaded);
    setStatus("processing");
    setStage("Reading the slides");
    setProgress(12);
    setTerms([]);
    setTarget(null);
    setPage(1);

    let extracted: PdfDocumentText;
    try {
      extracted = await extractText(uploaded);
    } catch (error) {
      console.error(error);
      toast.error("That PDF could not be read.");
      setStatus("idle");
      setFile(null);
      return;
    }

    setPdfText(extracted);
    setStage("Finding the key terms");
    setProgress(55);

    // A failure here costs the dots, not the document: text selection still
    // works, so the viewer opens either way.
    try {
      const result = await requestKeyTerms(extracted);
      setTerms(attachPositions(extracted, result.terms));

      if (result.truncatedAtPage) {
        toast.info(
          `Key terms marked for the first ${result.truncatedAtPage} pages.`,
        );
      }
    } catch (error) {
      console.error(error);
      toast.warning(
        error instanceof Error ? error.message : "Could not mark key terms.",
        { description: "You can still select any text to ask about it." },
      );
    }

    setProgress(100);
    setStatus("ready");
  }, []);

  const explainTerm = useCallback(
    (term: KeyTerm, anchor: AnchorPoint) => {
      if (!pdfText) return;
      setTarget({
        term: term.term,
        context: getPageContext(pdfText, term.page),
        page: term.page,
        source: "term",
        anchor,
      });
    },
    [pdfText],
  );

  const explainSelection = useCallback(
    (text: string, anchor: AnchorPoint) => {
      if (!pdfText) return;
      setTarget({
        term: text,
        context: getPageContext(pdfText, page),
        page,
        source: "selection",
        anchor,
      });
    },
    [pdfText, page],
  );

  // The panel's own button confirms the save and the navbar count increments,
  // so the sidebar deliberately stays closed rather than popping open.
  const saveNote = addNote;

  const reset = useCallback(() => {
    setStatus("idle");
    setFile(null);
    setPdfText(null);
    setTerms([]);
    setTarget(null);
    setPage(1);
    setProgress(0);
  }, []);

  return (
    <>
      <Navbar
        fileName={status === "ready" ? file?.name : undefined}
        notesCount={notes.length}
        notesOpen={notesOpen}
        onToggleNotes={() => setNotesOpen((open) => !open)}
        onClose={status === "ready" ? reset : undefined}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {status === "idle" && (
          <div className="flex-1 overflow-y-auto">
            <UploadZone onFile={handleFile} />
          </div>
        )}

        {status === "processing" && (
          <div className="mx-auto flex w-full max-w-sm flex-col justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium">{stage}</p>
            <Progress value={progress} />
            <p className="text-muted-foreground truncate text-xs">
              {file?.name ?? "Working"}
            </p>
          </div>
        )}

        {status === "ready" && file && pdfText && (
          <PdfViewer
            file={file}
            numPages={pdfText.numPages}
            page={page}
            terms={terms}
            activeTermId={
              target?.source === "term"
                ? keyTermId(target.page, target.term)
                : undefined
            }
            onPageChange={setPage}
            onSelectTerm={explainTerm}
            onSelectText={explainSelection}
          />
        )}
      </main>

      <NotesPopover
        open={notesOpen}
        notes={notes}
        onClose={() => setNotesOpen(false)}
        onRemove={removeNote}
        onJumpToPage={setPage}
      />

      <GlassPanel
        target={target}
        onClose={() => setTarget(null)}
        onSaveNote={saveNote}
      />
    </>
  );
}

/** Imported lazily so pdf.js stays out of the initial page bundle. */
async function extractText(file: File): Promise<PdfDocumentText> {
  const { extractTextWithPositions } = await import("@/lib/pdf-utils");
  return extractTextWithPositions(file);
}

async function requestKeyTerms(pdfText: PdfDocumentText): Promise<{
  terms: Array<{ page: number; term: string; itemIndex: number }>;
  truncatedAtPage: number | null;
}> {
  const response = await fetch("/api/extract-terms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Coordinates stay on the client. The model only sees indexed text and
    // answers with indices, so it has no opportunity to invent positions.
    body: JSON.stringify({
      pages: pdfText.pages.map((page) => ({
        page: page.page,
        items: page.items.map((item) => ({
          index: item.index,
          text: item.text,
        })),
      })),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not mark key terms.");
  }

  return payload;
}
