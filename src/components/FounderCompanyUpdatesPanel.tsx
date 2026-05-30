"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { CompanyUpdateRecord } from "@/lib/company-updates/types";
import { formatApiError } from "@/lib/api/errors";

const UPDATE_TYPES = [
  { value: "investor_update", label: "Investor update" },
  { value: "milestone", label: "Milestone" },
  { value: "fundraising", label: "Fundraising" },
  { value: "product", label: "Product" },
  { value: "financial", label: "Financial" },
  { value: "operational", label: "Operational" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "draft", label: "Draft (private)" },
  { value: "private", label: "Private (founder only)" },
  { value: "interested_investors", label: "Interested investors" },
  { value: "marketplace", label: "Marketplace viewers" },
] as const;

export function FounderCompanyUpdatesPanel({
  initialUpdates,
}: Readonly<{
  initialUpdates: CompanyUpdateRecord[];
}>) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [updateType, setUpdateType] = useState<string>("investor_update");
  const [visibility, setVisibility] = useState<string>("draft");
  const [publish, setPublish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/founder/company-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, updateType, visibility, publish }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(formatApiError(payload, "Unable to save update."));
      return;
    }

    setTitle("");
    setBody("");
    setPublish(false);
    router.refresh();
  }

  return (
    <WorkspacePanel
      title="Company updates"
      subtitle="Share milestones with interested investors or marketplace viewers"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 text-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Update title"
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          required
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Update summary for investors (not a legal offering document)"
          rows={4}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-500">Type</span>
            <select
              value={updateType}
              onChange={(e) => setUpdateType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {UPDATE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Visibility</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          Publish now (requires interested investors or marketplace visibility)
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save update"}
        </button>
      </form>

      <div className="mt-6 divide-y divide-slate-100">
        {initialUpdates.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">No updates yet.</p>
        ) : (
          initialUpdates.map((update) => (
            <div key={update.id} className="py-3 text-sm">
              <p className="font-medium text-slate-900">{update.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {update.update_type} · {update.visibility}
                {update.published_at
                  ? ` · published ${new Date(update.published_at).toLocaleDateString()}`
                  : " · draft"}
              </p>
              <p className="mt-2 line-clamp-3 text-slate-600">{update.body}</p>
            </div>
          ))
        )}
      </div>
    </WorkspacePanel>
  );
}
