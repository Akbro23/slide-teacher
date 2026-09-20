"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AnchorPoint, KeyTerm } from "@/types";

interface DotMarkerProps {
  term: KeyTerm;
  active: boolean;
  onSelect: (term: KeyTerm, anchor: AnchorPoint) => void;
}

export function DotMarker({ term, active, onSelect }: DotMarkerProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Explain ${term.term}`}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onSelect(term, {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            });
          }}
          style={{ left: `${term.x * 100}%`, top: `${term.y * 100}%` }}
          className={cn(
            "absolute z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "ring-2 ring-white/70 transition-transform hover:scale-150",
            "focus-visible:ring-ring/60 outline-none focus-visible:ring-[3px]",
            active ? "bg-primary scale-150" : "bg-sky-500",
          )}
        >
          {/* Draws attention without animating every dot on the page forever. */}
          <span
            className={cn(
              "absolute inset-0 rounded-full bg-sky-500/60",
              !active && "animate-ping [animation-duration:2.5s]",
            )}
            aria-hidden
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{term.term}</TooltipContent>
    </Tooltip>
  );
}
