"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SponsorLead, SponsorDownload } from "@/lib/icfo-events/types";

export function SponsorPortalClient({
  sponsorId,
  initialBlurb,
  initialWebsite,
  initialDownloads,
  initialVideoProvider = null,
  initialVideoRef = null,
  initialAllowContact = true,
  initialMeetingUrl = null,
  leads,
}: {
  sponsorId: string;
  initialBlurb: string | null;
  initialWebsite: string | null;
  initialDownloads: SponsorDownload[];
  initialVideoProvider?: string | null;
  initialVideoRef?: string | null;
  initialAllowContact?: boolean;
  initialMeetingUrl?: string | null;
  leads: SponsorLead[];
}) {
  const t = useTranslations("eventsCmp");
  const [blurb, setBlurb] = useState(initialBlurb ?? "");
  const [website, setWebsite] = useState(initialWebsite ?? "");
  const [downloads, setDownloads] = useState<SponsorDownload[]>(initialDownloads);
  // Booth video: keep the provider + a link field; uploads set provider="recorded".
  const [videoProvider, setVideoProvider] = useState<string | null>(initialVideoProvider);
  const [videoLink, setVideoLink] = useState(initialVideoProvider === "external" ? (initialVideoRef ?? "") : "");
  const [hasUpload, setHasUpload] = useState(initialVideoProvider === "recorded");
  const [uploading, setUploading] = useState(false);
  const [allowContact, setAllowContact] = useState(initialAllowContact);
  const [meetingUrl, setMeetingUrl] = useState(initialMeetingUrl ?? "");
  const [creatingMeet, setCreatingMeet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createMeet() {
    setCreatingMeet(true);
    setError(null);
    try {
      const res = await fetch(`/api/sponsor/${sponsorId}/meet`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not create meeting.");
      setMeetingUrl(json.meetingUrl as string);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting.");
    } finally {
      setCreatingMeet(false);
    }
  }

  async function uploadVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/sponsor/${sponsorId}/video`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed.");
      setVideoProvider("recorded");
      setHasUpload(true);
      setVideoLink("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

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
    const body: Record<string, unknown> = {
      blurb: blurb || null,
      website: website || null,
      downloads: cleanDownloads,
      allowContactRequest: allowContact,
      meetingUrl: meetingUrl.trim() || "",
    };
    // A typed link wins; an empty link with no upload clears the video.
    if (videoLink.trim()) { body.videoProvider = "external"; body.videoRef = videoLink.trim(); }
    else if (!hasUpload) { body.videoProvider = null; body.videoRef = null; }
    try {
      const res = await fetch(`/api/sponsor/${sponsorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        <h2 className="font-semibold text-[var(--navy)]">{t("your_booth")}</h2>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-[var(--text-secondary)]">{t("blurb")}</span>
          <textarea
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            placeholder={t("tell_attendees_who_you_are")}
          />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-[var(--text-secondary)]">{t("website")}</span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            placeholder="https://…"
          />
        </label>
        <div className="mt-4">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Booth video</span>
          <input
            value={videoLink}
            onChange={(e) => { setVideoLink(e.target.value); setVideoProvider(e.target.value.trim() ? "external" : null); setSaved(false); }}
            placeholder="Paste a link — YouTube, Vimeo, Loom…"
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          />
          <div className="mt-2 flex items-center gap-3">
            <label className="cursor-pointer text-xs font-medium text-[var(--blue)] hover:underline">
              {uploading ? "Uploading…" : hasUpload ? "Replace uploaded video" : "Or upload a video file"}
              <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={uploadVideo} disabled={uploading} className="hidden" />
            </label>
            {videoProvider === "recorded" && hasUpload && <span className="text-xs text-emerald-700">Video uploaded ✓</span>}
            {videoProvider === "external" && videoLink.trim() && <span className="text-xs text-emerald-700">Link set ✓</span>}
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">A link takes priority. Uploads are streamed on your booth (mp4/webm/mov, up to 500 MB).</p>
        </div>

        <div className="mt-4">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Booth meeting (Google Meet)</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={meetingUrl}
              onChange={(e) => { setMeetingUrl(e.target.value); setSaved(false); }}
              placeholder="https://meet.google.com/…"
              className="flex-1 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            />
            <button type="button" onClick={createMeet} disabled={creatingMeet} className="whitespace-nowrap rounded-md border border-[var(--border-subtle)] px-3 py-2 text-xs font-medium text-[var(--blue)] disabled:opacity-50">
              {creatingMeet ? "Creating…" : "Create Meet"}
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Adds a “Join meeting” button to your booth. Create one from your connected Google account, or paste a link.</p>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={allowContact} onChange={(e) => { setAllowContact(e.target.checked); setSaved(false); }} />
          Allow contact requests (show a “Request contact” button on your booth)
        </label>

        <div className="mt-4">
          <span className="text-sm font-medium text-[var(--text-secondary)]">{t("resources_downloads")}</span>
          <div className="mt-2 space-y-2">
            {downloads.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={d.label}
                  onChange={(e) => updateDownload(i, "label", e.target.value)}
                  placeholder={t("label")}
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
          {saved && <span className="text-xs text-emerald-700">{t("saved")}</span>}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Logo, tier, and event placements are managed by the iCFO team.
        </p>
      </form>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <h2 className="font-semibold text-[var(--navy)]">{t("opt_in_intros")}</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Attendees who chose to connect with you. These are opt-in — never a raw attendee list.
        </p>
        {leads.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">{t("no_intro_requests_yet")}</p>
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
