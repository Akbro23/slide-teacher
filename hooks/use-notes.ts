"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { SavedNote } from "@/types";

const STORAGE_KEY = "slide-teacher:notes";
const EMPTY = "[]";

// localStorage is an external store, so it is read through
// useSyncExternalStore rather than mirrored into state by an effect. That keeps
// the server pass and hydration consistent, and syncs across tabs for free.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // `storage` only fires in *other* tabs; same-tab writes notify directly.
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function parse(raw: string): SavedNote[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedNote[]) : [];
  } catch {
    return [];
  }
}

function write(notes: SavedNote[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Over quota or private mode: the next read simply returns what is stored.
  }
  for (const listener of listeners) listener();
}

export function useNotes() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => EMPTY);
  const notes = useMemo(() => parse(raw), [raw]);

  const addNote = useCallback(
    (note: Pick<SavedNote, "term" | "explanation" | "page">) => {
      write([
        { ...note, id: crypto.randomUUID(), createdAt: Date.now() },
        ...parse(readRaw()),
      ]);
    },
    [],
  );

  const removeNote = useCallback((id: string) => {
    write(parse(readRaw()).filter((note) => note.id !== id));
  }, []);

  return { notes, addNote, removeNote };
}
