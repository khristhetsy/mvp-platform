"use client";

import { useState } from "react";
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
        <span className="text-xs text-emerald-700">Linked ✓</span>
        <button onClick={() => assign(true)} disabled={busy} className="text-xs text-rose-600 hover:underline">
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
        placeholder="owner email"
        className="w-32 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs"
      />
      <button
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
      {hasLogo && <span className="text-xs text-emerald-700">✓</span>}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

export function SponsorCatalog({ initialSponsors }: { initialSponsors: Sponsor[] }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>(initialSponsors);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [blurb, setBlurb] = useState("");
  const [tier, setTier] = useState<SponsorTier>("community");
  const [category, setCategory] = useState<SponsorCategory>("other");
  const [sectorSlug, setSectorSlug] = useState<string>("");
  const [categoryExclusive, setCategoryExclusive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onLogoUploaded(updated: Sponsor) {
    setSponsors((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

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
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not create sponsor.");
      setSponsors((prev) => [...prev, json.sponsor as Sponsor]);
      setName("");
      setWebsite("");
      setBlurb("");
      setCategoryExclusive(false);
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
      <h1 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">Sponsor catalog</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Create sponsors once, then attach them to any event with a placement.
      </p>

      {error && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <form onSubmit={create} className="mt-5 grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-2 gap-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Sponsor name" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://website (optional)" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        </div>
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="One-line blurb (optional)" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
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
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={categoryExclusive} onChange={(e) => setCategoryExclusive(e.target.checked)} />
          Category-exclusive (one anchor per category per event)
        </label>
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !name.trim()} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? "Creating…" : "Add sponsor"}
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
        {sponsors.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">No sponsors yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Tier</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Logo</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody>
              {sponsors.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--navy)]">{s.name}</td>
                  <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{s.tier}</td>
                  <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{s.category}</td>
                  <td className="px-4 py-3">
                    <LogoUpload sponsorId={s.id} hasLogo={Boolean(s.logoPath)} onUploaded={onLogoUploaded} />
                  </td>
                  <td className="px-4 py-3">
                    <AssignOwner sponsorId={s.id} hasOwner={Boolean(s.ownerId)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
