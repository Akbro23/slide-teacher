"use client";

import {
  ChevronLeft,
  ChevronRight,
  MessageSquareQuote,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { DotMarker } from "@/components/dot-marker";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PDF_OPTIONS } from "@/lib/pdf-worker";
import type { AnchorPoint, KeyTerm } from "@/types";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.2;

/** Selections shorter than this are almost always mis-clicks. */
const MIN_SELECTION_CHARS = 3;
const MAX_SELECTION_CHARS = 300;

interface PdfViewerProps {
  file: File;
  numPages: number;
  page: number;
  terms: KeyTerm[];
  activeTermId?: string;
  onPageChange: (page: number) => void;
  onSelectTerm: (term: KeyTerm, anchor: AnchorPoint) => void;
  onSelectText: (text: string, anchor: AnchorPoint) => void;
}

interface SelectionAnchor {
  text: string;
  /** Offsets relative to the page wrapper, so the button tracks zoom and scroll. */
  left: number;
  top: number;
}

export function PdfViewer({
  file,
  numPages,
  page,
  terms,
  activeTermId,
  onPageChange,
  onSelectTerm,
  onSelectText,
}: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);

  const pageTerms = terms.filter((term) => term.page === page);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      // Leave room for the scroll container's padding.
      setContainerWidth(Math.max(320, entry.contentRect.width - 48));
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.min(numPages, Math.max(1, next));
      if (clamped === page) return;

      setAnchor(null);
      window.getSelection()?.removeAllRanges();
      onPageChange(clamped);
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [numPages, page, onPageChange],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        goToPage(page + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        goToPage(page - 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToPage, page]);

  const readSelection = useCallback(() => {
    const host = pageRef.current;
    const selection = window.getSelection();

    if (!host || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      setAnchor(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!host.contains(range.commonAncestorContainer)) {
      setAnchor(null);
      return;
    }

    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (text.length < MIN_SELECTION_CHARS || text.length > MAX_SELECTION_CHARS) {
      setAnchor(null);
      return;
    }

    const selectionRect = range.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();

    setAnchor({
      text,
      left: selectionRect.left - hostRect.left + selectionRect.width / 2,
      top: selectionRect.top - hostRect.top,
    });
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="bg-muted/40 min-h-0 flex-1 overflow-auto p-6"
      >
        <div className="mx-auto w-fit">
          <Document
            file={file}
            options={PDF_OPTIONS}
            loading={
              <Skeleton
                className="aspect-video w-full"
                style={{ width: containerWidth || undefined }}
              />
            }
            error={
              <p className="text-destructive p-8 text-sm">
                This PDF could not be rendered.
              </p>
            }
            className="flex justify-center"
          >
            <div
              ref={pageRef}
              className="relative w-fit shadow-xl"
              onPointerUp={readSelection}
              onKeyUp={readSelection}
            >
              <Page
                pageNumber={page}
                width={containerWidth ? containerWidth * zoom : undefined}
                renderAnnotationLayer={false}
                loading={
                  <Skeleton
                    className="aspect-video"
                    style={{ width: (containerWidth || 320) * zoom }}
                  />
                }
              />

              {pageTerms.map((term) => (
                <DotMarker
                  key={term.id}
                  term={term}
                  active={term.id === activeTermId}
                  onSelect={onSelectTerm}
                />
              ))}

              {anchor && (
                <div
                  className="absolute z-30 -translate-x-1/2 -translate-y-full pb-2"
                  style={{ left: anchor.left, top: anchor.top }}
                >
                  <Button
                    size="sm"
                    className="shadow-lg"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      onSelectText(anchor.text, {
                        x: rect.left + rect.width / 2,
                        y: rect.bottom,
                      });
                      setAnchor(null);
                      window.getSelection()?.removeAllRanges();
                    }}
                  >
                    <MessageSquareQuote className="size-3.5" />
                    Explain
                  </Button>
                </div>
              )}
            </div>
          </Document>
        </div>
      </div>

      <div className="flex h-12 shrink-0 items-center justify-center gap-1 border-t px-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <span className="text-muted-foreground min-w-24 text-center text-sm tabular-nums">
          {page} / {numPages}
        </span>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Next page"
          disabled={page >= numPages}
          onClick={() => goToPage(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>

        <Separator orientation="vertical" className="mx-2 h-5" />

        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
        >
          <ZoomOut className="size-4" />
        </Button>

        <span className="text-muted-foreground min-w-12 text-center text-xs tabular-nums">
          {Math.round(zoom * 100)}%
        </span>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
        >
          <ZoomIn className="size-4" />
        </Button>
      </div>
    </div>
  );
}
