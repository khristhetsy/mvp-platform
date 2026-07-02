"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Submission = {
  id: string;
  content: string;
  submittedAt: string;
  adminFeedback: string | null;
  founderName: string;
  companyName: string;
};

type Props = {
  moduleSlug: string;
  lessonId: string;
};

export function AdminLessonWorksheetSubmissions({ moduleSlug, lessonId }: Props) {
  const t = useTranslations("adminCmp");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadSubmissions() {
    const params = new URLSearchParams({ moduleSlug, lessonId });
    const res = await fetch(`/api/admin/learning/worksheets?${params.toString()}`);
    if (!res.ok) return;
    const json = (await res.json()) as { submissions?: Submission[] };
    setSubmissions(json.submissions ?? []);
    setLoaded(true);
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) await loadSubmissions();
  }

  async function saveFeedback(submissionId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/learning/worksheets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, feedback: feedbackDraft }),
      });
      if (res.ok) {
        setSubmissions((prev) =>
          prev.map((s) => (s.id === submissionId ? { ...s, adminFeedback: feedbackDraft } : s)),
        );
        setExpandedId(null);
        setFeedbackDraft("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <button type="button" onClick={() => void toggleOpen()} className="text-xs font-semibold text-slate-700">
        {open ? "▼" : "▶"} Worksheet submissions {loaded ? `(${submissions.length})` : ""}
      </button>
      {open ? (
        <div className="mt-3 overflow-x-auto">
          {submissions.length === 0 ? (
            <p className="text-xs text-slate-500">{t("no_submissions_yet")}</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-2">Founder</th>
                  <th className="py-2 pr-2">Company</th>
                  <th className="py-2 pr-2">Submitted</th>
                  <th className="py-2 pr-2">Preview</th>
                  <th className="py-2">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {submissions.flatMap((s) => {
                  const rows = [
                    <tr
                      key={s.id}
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                      onClick={() => {
                        setExpandedId(expandedId === s.id ? null : s.id);
                        setFeedbackDraft(s.adminFeedback ?? "");
                      }}
                    >
                      <td className="py-2 pr-2">{s.founderName}</td>
                      <td className="py-2 pr-2">{s.companyName}</td>
                      <td className="py-2 pr-2">{new Date(s.submittedAt).toLocaleDateString()}</td>
                      <td className="py-2 pr-2">
                        {s.content.slice(0, 100)}
                        {s.content.length > 100 ? "…" : ""}
                      </td>
                      <td className="py-2">{s.adminFeedback ? "Given" : "—"}</td>
                    </tr>,
                  ];
                  if (expandedId === s.id) {
                    rows.push(
                      <tr key={`${s.id}-detail`}>
                        <td colSpan={5} className="bg-slate-50 p-3">
                          <p className="mb-2 text-slate-700">{s.content}</p>
                          <textarea
                            value={feedbackDraft}
                            onChange={(e) => setFeedbackDraft(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                            placeholder={t("coach_feedback")}
                          />
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveFeedback(s.id)}
                            className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {saving ? "Saving…" : "Save feedback"}
                          </button>
                        </td>
                      </tr>,
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
