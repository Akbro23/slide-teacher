"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Lightbulb, Repeat, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnchorPoint, ExplainTarget, ExplainType } from "@/types";

interface GlassPanelProps {
  target: ExplainTarget | null;
  onClose: () => void;
  onSaveNote: (note: { term: string; explanation: string; page: number }) => void;
}

/** Gap between the clicked point and the popover edge. */
const ANCHOR_GAP = 14;
/** Minimum breathing room against the viewport edges. */
const EDGE_MARGIN = 12;
const PANEL_WIDTH = 360;

const EXTRAS = [
  { type: "example", label: "Example", icon: BookOpen },
  { type: "analogy", label: "Analogy", icon: Repeat },
  { type: "elaborate", label: "Elaborate", icon: Lightbulb },
] as const satisfies ReadonlyArray<{
  type: Exclude<ExplainType, "base">;
  label: string;
  icon: typeof BookOpen;
}>;

async function fetchExplanation(
  target: ExplainTarget,
  explainType: ExplainType,
): Promise<string> {
  const response = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      term: target.term,
      explainType,
      context: target.context || undefined,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not reach the explainer.");
  }

  return payload.text as string;
}

function useExplanation(
  target: ExplainTarget,
  explainType: ExplainType,
  enabled: boolean,
) {
  return useQuery({
    // Cache is scoped to the term and the kind of explanation, so re-opening a
    // dot or re-clicking an extra is instant for the rest of the session.
    queryKey: ["explain", target.term, explainType],
    queryFn: () => fetchExplanation(target, explainType),
    enabled,
  });
}

/**
 * Places the popover next to the anchor: below it by preference, flipped above
 * when there isn't room, and always clamped inside the viewport. Re-runs when
 * the content grows, since requesting an extra changes the height.
 */
function usePopoverPosition(anchor: AnchorPoint | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );

  const place = useCallback(() => {
    const element = ref.current;
    if (!element || !anchor) return;

    const { width, height } = element.getBoundingClientRect();

    let top = anchor.y + ANCHOR_GAP;
    if (top + height + EDGE_MARGIN > window.innerHeight) {
      const above = anchor.y - height - ANCHOR_GAP;
      // Only flip if above genuinely fits; otherwise clamping below is better.
      top = above >= EDGE_MARGIN ? above : top;
    }

    setPosition({
      left: clamp(anchor.x - width / 2, width, window.innerWidth),
      top: clamp(top, height, window.innerHeight),
    });
  }, [anchor]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener("resize", place);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [place]);

  return { ref, position };
}

function clamp(value: number, size: number, viewport: number) {
  return Math.max(
    EDGE_MARGIN,
    Math.min(value, viewport - size - EDGE_MARGIN),
  );
}

function Passage({
  label,
  query,
}: {
  label?: string;
  query: UseQueryResult<string, Error>;
}) {
  if (query.isPending) {
    return (
      <div className="space-y-2">
        {label && <SectionLabel>{label}</SectionLabel>}
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-4/6" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-2">
        {label && <SectionLabel>{label}</SectionLabel>}
        <p className="text-destructive text-sm">{query.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && <SectionLabel>{label}</SectionLabel>}
      <p className="text-sm leading-relaxed whitespace-pre-line">{query.data}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
      {children}
    </p>
  );
}

function PanelBody({
  target,
  onClose,
  onSaveNote,
}: Pick<GlassPanelProps, "onClose" | "onSaveNote"> & { target: ExplainTarget }) {
  const [requested, setRequested] = useState<Set<ExplainType>>(new Set());
  const [saved, setSaved] = useState(false);

  const base = useExplanation(target, "base", true);
  const example = useExplanation(target, "example", requested.has("example"));
  const analogy = useExplanation(target, "analogy", requested.has("analogy"));
  const elaborate = useExplanation(
    target,
    "elaborate",
    requested.has("elaborate"),
  );

  const extraQueries = { example, analogy, elaborate };

  return (
    <>
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0 space-y-0.5">
          <SectionLabel>
            {target.source === "selection" ? "Selection" : "Key term"} · page{" "}
            {target.page}
          </SectionLabel>
          <h2 className="font-heading text-sm leading-snug font-semibold">
            {target.term}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close explanation"
          className="-mt-1 -mr-1 size-7 shrink-0"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <Separator className="mt-3" />

      {/* Caps the popover height without turning it into a full-height panel. */}
      <div className="max-h-[min(22rem,45vh)] min-h-0 space-y-4 overflow-y-auto px-4 py-3.5">
        <Passage query={base} />

        {EXTRAS.filter(({ type }) => requested.has(type)).map(
          ({ type, label }) => (
            <Passage key={type} label={label} query={extraQueries[type]} />
          ),
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t px-2.5 py-2">
        {EXTRAS.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={requested.has(type)}
            onClick={() =>
              setRequested((previous) => new Set(previous).add(type))
            }
          >
            <Icon className="size-3" />
            {label}
          </Button>
        ))}

        <Button
          variant="ghost"
          size="icon"
          aria-label="Save to notes"
          className="ml-auto size-7"
          disabled={!base.data || saved}
          onClick={() => {
            if (!base.data) return;
            onSaveNote({
              term: target.term,
              explanation: base.data,
              page: target.page,
            });
            setSaved(true);
          }}
        >
          {saved ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <BookOpen className="size-3.5" />
          )}
        </Button>
      </div>
    </>
  );
}

export function GlassPanel({ target, onClose, onSaveNote }: GlassPanelProps) {
  const { ref, position } = usePopoverPosition(target?.anchor);

  useEffect(() => {
    if (!target) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    function onPointerDown(event: PointerEvent) {
      // A click outside dismisses, but clicking another dot should open that
      // dot rather than just closing this popover.
      const node = event.target as HTMLElement;
      if (ref.current?.contains(node)) return;
      if (node.closest('[aria-label^="Explain "]')) return;
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [target, onClose, ref]);

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          ref={ref}
          key={`${target.page}:${target.term}`}
          role="dialog"
          aria-label={`Explanation of ${target.term}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          style={{
            width: PANEL_WIDTH,
            left: position?.left ?? target.anchor.x,
            top: position?.top ?? target.anchor.y,
            // Avoid a flash at the anchor before the first measurement lands.
            visibility: position ? "visible" : "hidden",
          }}
          className="bg-background/80 fixed z-50 flex flex-col overflow-hidden rounded-lg border shadow-xl backdrop-blur-2xl"
        >
          <PanelBody target={target} onClose={onClose} onSaveNote={onSaveNote} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
