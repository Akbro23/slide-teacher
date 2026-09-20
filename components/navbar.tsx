"use client";

import { FileText, NotebookPen, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavbarProps {
  fileName?: string;
  notesCount: number;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onClose?: () => void;
}

export function Navbar({
  fileName,
  notesCount,
  notesOpen,
  onToggleNotes,
  onClose,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
        <Sparkles className="size-4 text-primary" aria-hidden />
        Slide Teacher
      </div>

      {fileName && (
        <>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4 shrink-0" aria-hidden />
            <span className="truncate" title={fileName}>
              {fileName}
            </span>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-1">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            New PDF
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={notesOpen ? "secondary" : "ghost"}
              size="icon"
              aria-label="Toggle notes"
              aria-pressed={notesOpen}
              onClick={onToggleNotes}
            >
              <NotebookPen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notes</TooltipContent>
        </Tooltip>

        {notesCount > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {notesCount}
          </Badge>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
