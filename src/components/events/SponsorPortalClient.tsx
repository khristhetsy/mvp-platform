"use client";

import { useState } from "react";
import type { SponsorLead, SponsorDownload } from "@/lib/icfo-events/types";

export function SponsorPortalClient({
  sponsorId,
  initialBlurb,
  initialWebsite,
  initialDownloads,
  leads,
}: {
  sponsorId: string;
  initialBlurb: string | null;
  initialWebsite: string | null;
  initialDownloads: SponsorDownload[];
  leads: SponsorLead[];
}) {
  const [blurb, setBlurb] = useState(initialBlurb ?? "");
  const [website, setWebsite] = useState(initialWebsite ?? "");
  const [downloads, setDownloads] = useState<SponsorDownload[]>(initialDownloads);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDownload(i: number, field: "label" | "url", value: string) {
    setDownloads((prev) => prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)));
    setSaved(false);
  }
  function addDownload() {
    if (downloads.length >= 8) return;
    setDownloads((prev) => [...prev, { label: "", url: "" }]);
  }
  function removeDownload(i: number) {
    setDownloads((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const cleanDownloads = downloads.filter((d) => d.label.trim() && d.url.trim());
    try {
      const res = await fetch(`/api/sponsor/${sponsorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blurb: blurb || null, website: website || null, downloads: cleanDownloads }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not save.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <form onSubmit={save} className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <h2 className="font-semibold text-[var(--navy)]">Your booth</h2>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Blurb</span>
          <textarea
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            placeholder="Tell attendees who you are."
          />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Website</span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            placeholder="https://…"
          />
        </label>
        <div className="mt-4">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Resources / downloads</span>
          <div className="mt-2 space-y-2">
            {downloads.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={d.label}
                  onChange={(e) => updateDownload(i, "label", e.target.value)}
                  placeholder="Label"
                  className="w-1/3 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm"
                />
                <input
                  value={d.url}
                  onChange={(e) => updateDownload(i, "url", e.target.value)}
                  placeholder="https://…"
                  className="flex-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm"
                />
                <button type="button" onClick={() => removeDownload(i)} className="text-xs text-rose-600 hover:underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
          {downloads.length < 8 && (
            <button type="button" onClick={addDownload} className="mt-2 text-xs font-medium text-[var(--blue)] hover:underline">
              + Add resource
            </button>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-3 flex items-center gap-2">
          <button type="submit" disabled={busy} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? "Saving…" : "Save booth"}
          </button>
          {saved && <span className="text-xs text-emerald-700">Saved</span>}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Logo, tier, and event placements are managed by the iCFO team.
        </p>
      </form>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <h2 className="font-semibold text-[var(--navy)]">Opt-in intros</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Attendees who chose to connect with you. These are opt-in — never a raw attendee list.
        </p>
        {leads.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No intro requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {leads.map((l) => (
              <li key={l.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--navy)]">{l.attendeeName ?? "Attendee"}</span>
                  {l.eventTitle && <span className="text-xs text-[var(--text-muted)]">{l.eventTitle}</span>}
                </div>
                {l.message && <p className="mt-1 text-sm text-[var(--text-secondary)]">{l.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
