"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  moduleSlug: string;
  lessonId: string;
  initialContent?: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function LessonNotes({ moduleSlug, lessonId, initialContent = "" }: Props) {
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/founder/learning/notes/${encodeURIComponent(moduleSlug)}/${encodeURIComponent(lessonId)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as { content?: string };
        if (typeof json.content === "string") setContent(json.content);
      } catch {
        // ignore load errors
      }
    })();
  }, [moduleSlug, lessonId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  function persist(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setSaveStatus("saving");
        try {
          const res = await fetch(
            `/api/founder/learning/notes/${encodeURIComponent(moduleSlug)}/${encodeURIComponent(lessonId)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: next }),
            },
          );
          if (!res.ok) throw new Error("save failed");
          setSaveStatus("saved");
          if (resetRef.current) clearTimeout(resetRef.current);
          resetRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
        } catch {
          setSaveStatus("error");
          if (resetRef.current) clearTimeout(resetRef.current);
          resetRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
        }
      })();
    }, 1000);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Notes</p>
        {saveStatus === "saving" ? <span className="text-xs text-slate-500">Saving…</span> : null}
        {saveStatus === "saved" ? <span className="text-xs text-emerald-600">Saved ✓</span> : null}
        {saveStatus === "error" ? <span className="text-xs text-red-600">Error saving</span> : null}
      </div>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          persist(e.target.value);
        }}
        placeholder="Notes auto-save to your account…"
        className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        rows={5}
      />
    </div>
  );
}
