"use client";

import { useState, useEffect } from "react";

type Props = {
  /** Investor-facing insight shown above the draft */
  benchmark: string;
  /** Pre-filled template the founder can edit before inserting */
  draft: string;
  /** Called with the (possibly edited) draft when founder clicks Insert */
  onInsert: (text: string) => void;
};

export function AIFieldHelper({ benchmark, draft, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [editableDraft, setEditableDraft] = useState(draft);

  // Sync editable draft when parent changes the generated draft
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditableDraft(draft);
  }, [draft]);

  function handleInsert() {
    onInsert(editableDraft);
    setOpen(false);
  }

  return (
    <div className="mt-2">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all"
        style={
          open
            ? { background: "#534AB7", borderColor: "#534AB7", color: "white" }
            : { background: "transparent", borderColor: "#c7d2fe", color: "#534AB7" }
        }
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"
            stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
          />
        </svg>
        {open ? "Hide draft" : "AI draft"}
      </button>

      {/* Expandable panel */}
      {open ? (
        <div
          className="mt-3 overflow-hidden rounded-xl border"
          style={{ borderColor: "#c7d2fe", background: "#fafaff", animation: "aiHelperIn 0.2s ease both" }}
        >
          <style>{`@keyframes aiHelperIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* Insight header */}
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #e0e7ff" }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#534AB7" }}>
                Investor insight
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: "#3C3489" }}>
                {benchmark}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-full p-1 hover:bg-indigo-100"
              style={{ color: "#7F77DD" }}
              aria-label="Close AI helper"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Draft area */}
          <div className="px-4 pt-3 pb-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Suggested draft{" "}
              <span className="normal-case font-normal text-slate-400">— edit before inserting</span>
            </p>
            <textarea
              rows={5}
              value={editableDraft}
              onChange={(e) => setEditableDraft(e.target.value)}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleInsert}
                className="rounded-full px-4 py-2 text-xs font-semibold text-white"
                style={{ background: "#534AB7" }}
              >
                Insert draft
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
