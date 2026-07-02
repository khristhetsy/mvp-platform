"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CollaborationVisibility } from "@/lib/collaboration/types";

export function CollaborationCommentForm({
  allowedVisibilities,
  defaultVisibility,
  canInternalNote,
  onSubmit,
  disabled,
}: Readonly<{
  allowedVisibilities: CollaborationVisibility[];
  defaultVisibility: CollaborationVisibility;
  canInternalNote: boolean;
  onSubmit: (input: {
    body: string;
    visibility: CollaborationVisibility;
    isInternalNote: boolean;
  }) => Promise<void>;
  disabled?: boolean;
}>) {
  const t = useTranslations("sharedCmp");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit({ body: body.trim(), visibility, isInternalNote: canInternalNote && isInternalNote });
      setBody("");
      setIsInternalNote(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post comment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
      <textarea
        aria-label="Comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        disabled={disabled || pending}
        placeholder={t("add_a_comment_use_name_for_mentions_foundati")}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60"
      />
      <div className="flex flex-wrap items-center gap-2">
        {allowedVisibilities.length > 1 ? (
          <select
            aria-label="Comment visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as CollaborationVisibility)}
            disabled={disabled || pending}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
          >
            {allowedVisibilities.map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        ) : null}
        {canInternalNote ? (
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={isInternalNote}
              onChange={(e) => setIsInternalNote(e.target.checked)}
              disabled={disabled || pending}
            />
            Internal note
          </label>
        ) : null}
        <button
          type="submit"
          disabled={disabled || pending || !body.trim()}
          className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post comment"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
