"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type SectorOption = { slug: string; label: string };

export function ApplyToPresentForm({
  eventId,
  slug,
  sectors,
}: {
  eventId: string;
  slug: string;
  sectors: SectorOption[];
}) {
  const t = useTranslations("eventsCmp");
  const router = useRouter();
  const [kind, setKind] = useState<"presenter" | "panelist" | "founder_showcase">("presenter");
  const [topic, setTopic] = useState("");
  const [bio, setBio] = useState("");
  const [sectorSlug, setSectorSlug] = useState<string>(sectors[0]?.slug ?? "");
  const [linksText, setLinksText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const links = linksText
      .split(/[\n,]/)
      .map((l) => l.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/events/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          kind,
          topic,
          bio: bio || null,
          sectorSlug: sectorSlug || null,
          links,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : "Could not submit application.";
        throw new Error(msg);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit application.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="font-semibold text-emerald-800">{t("application_submitted")}</h2>
        <p className="mt-1 text-sm text-emerald-700">
          Thanks — our team will review it and let you know. You&apos;ll get a notification with the decision.
        </p>
        <button
          onClick={() => router.push(`/events/${slug}`)}
          className="mt-4 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700"
        >
          Back to event
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-[var(--border-subtle)] bg-white p-6 shadow-[var(--shadow-panel)]">
      <label className="block">
        <span className="text-sm font-medium text-[var(--text-secondary)]">{t("format")}</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
        >
          <option value="presenter">Presenter / speaker</option>
          <option value="panelist">Panelist</option>
          <option value="founder_showcase">Founder showcase</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--text-secondary)]">{t("topic")}</span>
        <input
          required
          maxLength={200}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          placeholder={t("what_will_you_present")}
        />
      </label>

      {sectors.length > 0 && (
        <label className="block">
          <span className="text-sm font-medium text-[var(--text-secondary)]">{t("sector_track")}</span>
          <select
            value={sectorSlug}
            onChange={(e) => setSectorSlug(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          >
            {sectors.map((s) => (
              <option key={s.slug} value={s.slug}>{s.label}</option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="text-sm font-medium text-[var(--text-secondary)]">{t("short_bio")}</span>
        <textarea
          rows={3}
          maxLength={3000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          placeholder={t("a_few_lines_about_you_and_why_this_topic")}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--text-secondary)]">{t("links")}</span>
        <textarea
          rows={2}
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          placeholder={t("linkedin_deck_website_one_per_line")}
        />
        <span className="mt-1 block text-xs text-[var(--text-muted)]">Full URLs (https://…), one per line.</span>
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !topic.trim()}
          className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </form>
  );
}
