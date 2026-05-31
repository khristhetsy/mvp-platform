"use client";

import { BookmarkPlus } from "lucide-react";

export function SavedViewPlaceholder() {
  return (
    <button
      type="button"
      disabled
      title="Saved views coming soon"
      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-400"
    >
      <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
      Saved views
      <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Soon</span>
    </button>
  );
}
