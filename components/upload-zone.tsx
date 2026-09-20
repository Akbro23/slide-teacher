"use client";

import { motion } from "framer-motion";
import { FileUp, MousePointerClick, Sparkles, Type } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

interface UploadZoneProps {
  onFile: (file: File) => void;
}

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "Click a marked term",
    body: "Key terms get a dot. Click one for an instant explanation.",
  },
  {
    icon: Type,
    title: "Select any text",
    body: "Highlight anything on the slide and ask about it directly.",
  },
  {
    icon: Sparkles,
    title: "Go deeper",
    body: "Add an example, an analogy, or more detail on demand.",
  },
];

export function UploadZone({ onFile }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(file: File | undefined) {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("That file isn't a PDF.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("That PDF is larger than 50 MB.");
      return;
    }

    setError(null);
    onFile(file);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-10 px-6 py-16">
      <div className="space-y-3 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Understand your slides
        </h1>
        <p className="text-muted-foreground text-pretty">
          Upload a lecture PDF. Slide Teacher marks the terms worth knowing and
          explains any of them on click.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full"
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a PDF"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center transition-colors",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
            dragging
              ? "border-primary bg-primary/5"
              : "hover:border-muted-foreground/40 hover:bg-muted/40",
          )}
        >
          <div className="bg-muted flex size-11 items-center justify-center rounded-full">
            <FileUp className="text-muted-foreground size-5" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Drop a PDF here, or click to browse
            </p>
            <p className="text-muted-foreground text-xs">
              Up to 50 MB. Nothing leaves your browser except the slide text.
            </p>
          </div>
          <Button variant="secondary" size="sm" tabIndex={-1}>
            Choose file
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            accept(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {error && (
          <p role="alert" className="text-destructive mt-3 text-center text-sm">
            {error}
          </p>
        )}
      </motion.div>

      <ul className="grid w-full gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="space-y-1.5">
            <Icon className="text-muted-foreground size-4" aria-hidden />
            <p className="text-sm font-medium">{title}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
