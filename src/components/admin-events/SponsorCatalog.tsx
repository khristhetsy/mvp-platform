"use client";

import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";
import type { Sponsor, SponsorCategory, SponsorTier } from "@/lib/icfo-events/types";

const TIERS: { value: SponsorTier; label: string }[] = [
  { value: "presenting", label: "Presenting" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "community", label: "Community" },
];
const CATEGORIES: { value: SponsorCategory; label: string }[] = [
  { value: "legal", label: "Legal" },
  { value: "consulting", label: "Consulting" },
  { value: "banking", label: "Banking" },
  { value: "other", label: "Other" },
];

function AssignOwner({ sponsorId, hasOwner }: { sponsorId: string; hasOwner: boolean }) {
  const t = useTranslations("adminCmp");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [assigned, setAssigned] = useState(hasOwner);
  const [error, setError] = useState<string | null>(null);

  async function assign(clear: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sponsors/${sponsorId}/owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clear ? null : email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed.");
      setAssigned(!clear);
      if (clear) setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (assigned) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-emerald-700">{t("linked")}</span>
        <button type="button" onClick={() => assign(true)} disabled={busy} className="text-xs text-rose-600 hover:underline">
          Unlink
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("owner_email")}
        className="w-32 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={() => assign(false)}
        disabled={busy || !email.trim()}
        className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50"
      >
        Link
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

function LogoUpload({
  sponsorId,
  hasLogo,
  onUploaded,
}: {
  sponsorId: string;
  hasLogo: boolean;
  onUploaded: (sponsor: Sponsor) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/events/sponsors/${sponsorId}/logo`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed.");
      onUploaded(json.sponsor as Sponsor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="cursor-pointer text-xs font-medium text-[var(--blue)] hover:underline">
        {busy ? "Uploading…" : hasLogo ? "Replace logo" : "Upload logo"}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={upload} disabled={busy} className="hidden" />
      </label>
      {hasLogo && <span className="text-xs text-emerald-700"><i className="ti ti-check" aria-hidden="true" /></span>}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

function VideoManage({ sponsor, onUpdated }: { sponsor: Sponsor; onUpdated: (s: Sponsor) => void }) {
  const [busy, setBusy] = useState<null | "upload" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const hasVideo = Boolean(sponsor.videoRef);
  const isLink = sponsor.videoProvider === "external";

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/events/sponsors/${sponsor.id}/video`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed.");
      onUpdated(json.sponsor as Sponsor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
      e.target.value = "";
    }
  }

  async function setLink() {
    const url = window.prompt("Booth video link (YouTube, Vimeo, Loom…). Leave blank to remove.", isLink ? (sponsor.videoRef ?? "") : "");
    if (url === null) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sponsors/${sponsor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(url.trim() ? { videoProvider: "external", videoRef: url.trim() } : { videoProvider: null, videoRef: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Save failed.");
      onUpdated(json.sponsor as Sponsor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleContact() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sponsors/${sponsor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowContactRequest: !sponsor.allowContactRequest }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Save failed.");
      onUpdated(json.sponsor as Sponsor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function createMeet() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sponsors/${sponsor.id}/meet`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not create meeting.");
      onUpdated(json.sponsor as Sponsor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting.");
    } finally {
      setBusy(null);
    }
  }

  async function setMeetLink() {
    const url = window.prompt("Google Meet link (https://meet.google.com/…). Leave blank to remove.", sponsor.meetingUrl ?? "");
    if (url === null) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sponsors/${sponsor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl: url.trim() || "" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Save failed.");
      onUpdated(json.sponsor as Sponsor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={setLink} disabled={busy !== null} className="text-xs font-medium text-[var(--blue)] hover:underline disabled:opacity-50">{isLink && hasVideo ? "Edit link" : "Add link"}</button>
        <span className="text-[var(--border-subtle)]">·</span>
        <label className="cursor-pointer text-xs font-medium text-[var(--blue)] hover:underline">
          {busy === "upload" ? "Uploading…" : sponsor.videoProvider === "recorded" ? "Replace" : "Upload"}
          <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={upload} disabled={busy !== null} className="hidden" />
        </label>
        {hasVideo && <span className="text-xs text-emerald-700" title={isLink ? "Link" : "Uploaded"}><i className="ti ti-video" aria-hidden="true" /></span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-muted)]">Meeting:</span>
        <button type="button" onClick={createMeet} disabled={busy !== null} className="text-xs font-medium text-[var(--blue)] hover:underline disabled:opacity-50">Create Meet</button>
        <span className="text-[var(--border-subtle)]">·</span>
        <button type="button" onClick={setMeetLink} disabled={busy !== null} className="text-xs font-medium text-[var(--blue)] hover:underline disabled:opacity-50">{sponsor.meetingUrl ? "Edit link" : "Add link"}</button>
        {sponsor.meetingUrl && <span className="text-xs text-emerald-700" title="Meeting link set"><i className="ti ti-video" aria-hidden="true" /></span>}
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
        <input type="checkbox" checked={sponsor.allowContactRequest} onChange={toggleContact} disabled={busy !== null} />
        Contact requests
      </label>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

export function SponsorCatalog({ initialSponsors }: { initialSponsors: Sponsor[] }) {
  const t = useTranslations("adminCmp");
  const [sponsors, setSponsors] = useState<Sponsor[]>(initialSponsors);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [blurb, setBlurb] = useState("");
  const [tier, setTier] = useState<SponsorTier>("community");
  const [category, setCategory] = useState<SponsorCategory>("other");
  const [sectorSlug, setSectorSlug] = useState<string>("");
  const [categoryExclusive, setCategoryExclusive] = useState(false);
  const [videoRef, setVideoRef] = useState("");
  const [allowContact, setAllowContact] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function onSponsorUpdated(updated: Sponsor) {
    setSponsors((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function setArchived(id: string, archived: boolean) {
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/events/sponsors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not update.");
      onSponsorUpdated(json.sponsor as Sponsor);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not update.");
    }
  }

  async function remove(id: string, sponsorName: string) {
    if (!window.confirm(`Delete “${sponsorName}” permanently? This can't be undone.`)) return;
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/events/sponsors/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Delete failed.");
      setSponsors((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  const activeCount = sponsors.filter((s) => !s.archivedAt).length;
  const archivedCount = sponsors.length - activeCount;
  const visible = sponsors.filter((s) => (filter === "active" ? !s.archivedAt : Boolean(s.archivedAt)));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          website: website || null,
          blurb: blurb || null,
          tier,
          category,
          sectorSlug: sectorSlug || null,
          categoryExclusive,
          videoProvider: videoRef.trim() ? "external" : null,
          videoRef: videoRef.trim() || null,
          allowContactRequest: allowContact,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not create sponsor.");
      setSponsors((prev) => [...prev, json.sponsor as Sponsor]);
      setName("");
      setWebsite("");
      setBlurb("");
      setCategoryExclusive(false);
      setVideoRef("");
      setAllowContact(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create sponsor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>
      <h1 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{t("sponsor_catalog")}</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Create sponsors once, then attach them to any event with a placement.
      </p>

      {error && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <form onSubmit={create} className="mt-5 grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-2 gap-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("sponsor_name")} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://website (optional)" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        </div>
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder={t("one_line_blurb_optional")} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        <div className="grid grid-cols-3 gap-3">
          <select value={tier} onChange={(e) => setTier(e.target.value as SponsorTier)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
            {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value as SponsorCategory)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={sectorSlug} onChange={(e) => setSectorSlug(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
            <option value="">Cross-sector</option>
            {EVENT_SECTORS.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
        </div>
        <input value={videoRef} onChange={(e) => setVideoRef(e.target.value)} placeholder="Booth video link — YouTube/Vimeo/Loom (optional; or upload one after creating)" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={categoryExclusive} onChange={(e) => setCategoryExclusive(e.target.checked)} />
          Category-exclusive (one anchor per category per event)
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={allowContact} onChange={(e) => setAllowContact(e.target.checked)} />
          Allow contact requests (show a “Request contact” button on the booth)
        </label>
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !name.trim()} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? "Creating…" : "Add sponsor"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border-subtle)] text-sm">
          <button type="button" onClick={() => setFilter("active")} className={`px-3 py-1.5 ${filter === "active" ? "bg-[var(--indigo-soft)] font-medium text-[var(--indigo)]" : "text-[var(--text-secondary)]"}`}>Active · {activeCount}</button>
          <button type="button" onClick={() => setFilter("archived")} className={`border-l border-[var(--border-subtle)] px-3 py-1.5 ${filter === "archived" ? "bg-[var(--indigo-soft)] font-medium text-[var(--indigo)]" : "text-[var(--text-secondary)]"}`}>Archived · {archivedCount}</button>
        </div>
        <span className="text-xs text-[var(--text-muted)]">Archived booths are hidden from events but kept — you can restore them.</span>
      </div>

      {rowError && <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{rowError}</div>}

      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">
            {filter === "archived" ? "No archived sponsors." : t("no_sponsors_yet")}
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Tier</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Logo</th>
                <th className="px-4 py-3 font-semibold">Booth video</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <Fragment key={s.id}>
                  <tr className="border-b border-[var(--border-subtle)] align-top last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--navy)]">{s.name}</td>
                    <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{s.tier}</td>
                    <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{s.category}</td>
                    <td className="px-4 py-3"><LogoUpload sponsorId={s.id} hasLogo={Boolean(s.logoPath)} onUploaded={onSponsorUpdated} /></td>
                    <td className="min-w-[210px] px-4 py-3"><VideoManage sponsor={s} onUpdated={onSponsorUpdated} /></td>
                    <td className="px-4 py-3"><AssignOwner sponsorId={s.id} hasOwner={Boolean(s.ownerId)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap text-xs">
                        {s.archivedAt ? (
                          <button type="button" onClick={() => void setArchived(s.id, false)} className="font-medium text-[var(--blue)] hover:underline">Restore</button>
                        ) : (
                          <>
                            <button type="button" onClick={() => setEditingId(editingId === s.id ? null : s.id)} className="font-medium text-[var(--blue)] hover:underline">Edit</button>
                            <span className="text-[var(--border-subtle)]">·</span>
                            <button type="button" onClick={() => void setArchived(s.id, true)} className="font-medium text-[var(--text-secondary)] hover:underline">Archive</button>
                          </>
                        )}
                        <span className="text-[var(--border-subtle)]">·</span>
                        <button type="button" onClick={() => void remove(s.id, s.name)} className="font-medium text-rose-600 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                  {editingId === s.id && (
                    <tr className="border-b border-[var(--border-subtle)] bg-slate-50/60">
                      <td colSpan={7} className="px-4 py-4">
                        <SponsorEditForm
                          sponsor={s}
                          onSaved={(u) => { onSponsorUpdated(u); setEditingId(null); }}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SponsorEditForm({ sponsor, onSaved, onCancel }: { sponsor: Sponsor; onSaved: (s: Sponsor) => void; onCancel: () => void }) {
  const [name, setName] = useState(sponsor.name);
  const [website, setWebsite] = useState(sponsor.website ?? "");
  const [blurb, setBlurb] = useState(sponsor.blurb ?? "");
  const [tier, setTier] = useState<SponsorTier>(sponsor.tier);
  const [category, setCategory] = useState<SponsorCategory>(sponsor.category);
  const [sectorSlug, setSectorSlug] = useState(sponsor.sectorSlug ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sponsors/${sponsor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), website: website.trim() || "", blurb: blurb.trim() || null, tier, category, sectorSlug: sectorSlug || "" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Save failed.");
      onSaved(json.sponsor as Sponsor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sponsor name" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://website" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
      </div>
      <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="One-line blurb" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
      <div className="grid grid-cols-3 gap-2">
        <select value={tier} onChange={(e) => setTier(e.target.value as SponsorTier)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
          {TIERS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as SponsorCategory)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
          {CATEGORIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        <select value={sectorSlug} onChange={(e) => setSectorSlug(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
          <option value="">Cross-sector</option>
          {EVENT_SECTORS.map((x) => <option key={x.slug} value={x.slug}>{x.label}</option>)}
        </select>
      </div>
      {error && <span className="text-xs text-rose-600">{error}</span>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm">Cancel</button>
        <button type="button" onClick={save} disabled={busy} className="cap-btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}
