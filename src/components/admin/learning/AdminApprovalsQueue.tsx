"use client";

import { useMemo, useState } from "react";
import { formatApiError } from "@/lib/api/errors";

type ContentType = "program" | "module" | "lesson" | "quiz";
type Row = { id: string; title: string; content_status?: string | null; is_published?: boolean | null; slug?: string | null };

type Props = {
  programs: Row[];
  modules: Row[];
  lessons: Row[];
  quizzes: Row[];
};

type Action = "approve" | "publish" | "unpublish" | "archive";

export function AdminApprovalsQueue({ programs, modules, lessons, quizzes }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    const wrap = (type: ContentType, rows: Row[]) => rows.map((r) => ({ type, ...r }));
    return [...wrap("program", programs), ...wrap("module", modules), ...wrap("lesson", lessons), ...wrap("quiz", quizzes)];
  }, [programs, modules, lessons, quizzes]);

  async function act(type: ContentType, id: string, action: Action) {
    setLoading(`${type}:${id}:${action}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/learning/content/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: type,
          contentId: id,
          action,
          notes: noteById[id] || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw json;
      setHidden((v) => ({ ...v, [id]: true }));
    } catch (e) {
      setError(formatApiError(e, "Unable to update content status."));
    } finally {
      setLoading(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-600">No content pending review.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items
          .filter((x) => !hidden[x.id])
          .map((x) => (
            <div key={`${x.type}:${x.id}`} className="px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{x.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {x.type} · status: {x.content_status ?? "—"}
                    {typeof x.is_published === "boolean" ? ` · published: ${x.is_published ? "yes" : "no"}` : ""}
                    {x.slug ? ` · ${x.slug}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(loading)}
                    onClick={() => void act(x.type, x.id, "approve")}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(loading)}
                    onClick={() => void act(x.type, x.id, "publish")}
                    className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Publish
                  </button>
                  {(x.type === "program" || x.type === "module") && (
                    <button
                      type="button"
                      disabled={Boolean(loading)}
                      onClick={() => void act(x.type, x.id, "unpublish")}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={Boolean(loading)}
                    onClick={() => void act(x.type, x.id, "archive")}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                  >
                    Archive
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  placeholder="Optional review note (stored in status history)"
                  value={noteById[x.id] ?? ""}
                  onChange={(e) => setNoteById((v) => ({ ...v, [x.id]: e.target.value }))}
                />
              </div>
              {loading === `${x.type}:${x.id}:approve` ||
              loading === `${x.type}:${x.id}:publish` ||
              loading === `${x.type}:${x.id}:unpublish` ||
              loading === `${x.type}:${x.id}:archive` ? (
                <p className="mt-2 text-xs text-slate-500">Saving…</p>
              ) : null}
            </div>
          ))}
      </div>
    </div>
  );
}

