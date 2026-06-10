"use client";

import { useState } from "react";

const categories = ["bug", "feature", "onboarding", "documents", "deal_room", "learning", "other"] as const;
const severities = ["low", "normal", "high", "critical"] as const;

export function BetaFeedbackForm() {
  const [category, setCategory] = useState<(typeof categories)[number]>("other");
  const [severity, setSeverity] = useState<(typeof severities)[number]>("normal");
  const [message, setMessage] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/beta/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          severity,
          message: message.trim(),
          screenshotUrl: screenshotUrl.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(typeof payload.error === "string" ? payload.error : "Unable to submit feedback.");
        return;
      }
      setMessage("");
      setScreenshotUrl("");
      setStatus("Feedback submitted — thank you. Staff will review during beta.");
    } catch {
      setStatus("Unable to submit feedback.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Submit beta feedback</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Severity
          <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            {severities.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Message
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={3}
          rows={4}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Describe the issue or suggestion…"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Screenshot URL (optional)
        <input
          value={screenshotUrl}
          onChange={(e) => setScreenshotUrl(e.target.value)}
          type="url"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="https://…"
        />
      </label>
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="cap-btn-primary w-fit rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
  );
}
