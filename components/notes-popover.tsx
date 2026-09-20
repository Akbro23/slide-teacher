"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { SavedNote } from "@/types";

interface NotesPopoverProps {
  open: boolean;
  notes: SavedNote[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onJumpToPage: (page: number) => void;
}

/** Drops down from the navbar button instead of docking to the side. */
export function NotesPopover({
  open,
  notes,
  onClose,
  onRemove,
  onJumpToPage,
}: NotesPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const node = event.target as HTMLElement;
      if (ref.current?.contains(node)) return;
      // The navbar button toggles on its own; don't fight it.
      if (node.closest('[aria-label="Toggle notes"]')) return;
      onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label="Saved notes"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className="bg-background/85 fixed top-16 right-4 z-50 flex max-h-[min(28rem,60vh)] w-80 flex-col overflow-hidden rounded-lg border shadow-xl backdrop-blur-2xl"
        >
          <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium">
            Notes
            <span className="text-muted-foreground ml-auto tabular-nums">
              {notes.length}
            </span>
          </div>

          {notes.length === 0 ? (
            <p className="text-muted-foreground px-4 py-5 text-xs leading-relaxed">
              Explanations you save land here, so you can review the whole deck
              at the end.
            </p>
          ) : (
            <ul className="min-h-0 divide-y overflow-y-auto">
              {notes.map((note) => (
                <li key={note.id} className="group space-y-1 px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onJumpToPage(note.page);
                        onClose();
                      }}
                      className="min-w-0 flex-1 text-left text-xs font-medium hover:underline"
                    >
                      {note.term}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · p{note.page}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove note for ${note.term}`}
                      className="size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => onRemove(note.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
                    {note.explanation}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
