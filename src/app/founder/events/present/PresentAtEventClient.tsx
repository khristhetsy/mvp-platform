"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, Sparkles, Video } from "lucide-react";
import type { PresentTier } from "@/lib/icfo-events/present-tiers";

export type PresentEventOption = {
  id: string;
  title: string;
  startsAt: string | null;
  slug?: string;
  format?: string;
  summary?: string | null;
  /** Public URL of the event's banner image, when one is set. */
  coverUrl?: string | null;
  coverFocal?: string;
  coverOverlay?: number;
};

const FORMAT_LABELS: Record<string, string> = {
  showcase: "Showcase",
  demo_day: "Demo day",
  webinar: "Webinar",
  hybrid: "Hybrid",
};

/** Event banner: the uploaded cover image with its overlay, or a navy block
 *  when the event has no image yet. */
function EventBanner({ e, tall }: { e: PresentEventOption; tall?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${tall ? "h-40 sm:h-48" : "h-20"}`} style={{ background: "#0c2340" }}>
      {e.coverUrl ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: `url(${e.coverUrl})`, backgroundSize: "cover", backgroundPosition: e.coverFocal ?? "center" }}
        />
      ) : null}
      <div aria-hidden className="absolute inset-0" style={{ background: "#0c2340", opacity: e.coverUrl ? (e.coverOverlay ?? 40) / 100 : 1 }} />
      {tall ? (
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-xl font-semibold leading-tight text-white sm:text-2xl">{e.title}</p>
          <p className="mt-1 text-xs text-white/80">
            {fmtDate(e.startsAt)}
            {e.format ? ` · ${FORMAT_LABELS[e.format] ?? e.format}` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
export type ExistingApplication = { eventId: string; status: string; kind: string; topic: string };

function fmtDate(iso: string | null): string {
  if (!iso) return "Date TBA";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PresentAtEventClient({
  tier,
  planLabel,
  events,
  existing,
}: {
  tier: PresentTier | null;
  planLabel: string;
  events: PresentEventOption[];
  existing: ExistingApplication[];
}) {
  const [eventId, setEventId] = useState("");
  const [topic, setTopic] = useState("");
  const [bio, setBio] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [extraLink, setExtraLink] = useState("");
  const [optional, setOptional] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const includedFeatureIds = useMemo(
    () => (tier ? tier.features.filter((f) => !f.optional).map((f) => f.id) : []),
    [tier],
  );

  if (!tier) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted,#f1f5f9)]">
          <Lock className="h-5 w-5 text-[var(--text-muted)]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Presenting is a paid feature</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
          You&rsquo;re on the <span className="font-medium text-[var(--text-primary)]">{planLabel}</span> plan. Upgrade to
          Basic for a <span className="font-medium">Spotlight</span> slot, or Professional for a{" "}
          <span className="font-medium">Full presentation</span> on stage.
        </p>
        <Link
          href="/founder/settings/billing"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          View plans
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Application submitted</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
          Your request to present is with the iCFO events team. You&rsquo;ll be notified when it&rsquo;s reviewed. You can
          track it below.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setEventId("");
            setTopic("");
            setBio("");
            setVideoUrl("");
            setExtraLink("");
            setOptional(new Set());
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted,#f8fafc)]"
        >
          Apply to another event
        </button>
      </div>
    );
  }

  const appliedEventIds = new Set(existing.map((e) => e.eventId));
  const selectedEvent = events.find((e) => e.id === eventId) ?? null;

  async function submit() {
    setError(null);
    if (!eventId) return setError("Choose an event.");
    if (!topic.trim()) return setError("Enter a talk title.");
    if (tier!.requiresVideo && !videoUrl.trim()) return setError("A video presentation link is required.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/founder/events/present", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          topic: topic.trim(),
          bio: bio.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
          links: extraLink.trim() ? [extraLink.trim()] : [],
          features: [...includedFeatureIds, ...optional],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Could not submit your application.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Form */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-indigo,#2E78F5)]/10 px-3 py-1 text-xs font-medium text-[var(--brand-indigo,#2E78F5)]">
            {tier.key === "full" ? <Video className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {tier.label} — included with {planLabel}
          </span>
        </div>

        <p className="block text-sm font-medium text-[var(--text-primary)]">Choose an event</p>
        {events.length === 0 ? (
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">No events are open for applications right now.</p>
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Event">
            {events.map((e) => {
              const applied = appliedEventIds.has(e.id);
              const on = eventId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={applied}
                  onClick={() => setEventId(e.id)}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    on
                      ? "border-[var(--brand-indigo,#2E78F5)] ring-2 ring-[var(--brand-indigo,#2E78F5)]/30"
                      : "border-[var(--border-subtle)] hover:border-slate-300"
                  } ${applied ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <EventBanner e={e} />
                  <div className="px-3 py-2">
                    <p className="line-clamp-2 text-[13px] font-semibold text-[var(--text-primary)]">{e.title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {fmtDate(e.startsAt)}
                      {e.format ? ` · ${FORMAT_LABELS[e.format] ?? e.format}` : ""}
                      {applied ? " · Applied" : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedEvent ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            <EventBanner e={selectedEvent} tall />
            {selectedEvent.summary || selectedEvent.slug ? (
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                {selectedEvent.summary ? (
                  <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--text-muted)] line-clamp-3">{selectedEvent.summary}</p>
                ) : <span />}
                {selectedEvent.slug ? (
                  <Link
                    href={`/events/${selectedEvent.slug}`}
                    target="_blank"
                    className="shrink-0 text-xs font-semibold text-[var(--brand-indigo,#2E78F5)] hover:underline"
                  >
                    View event page ↗
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <label className="mt-5 block text-sm font-medium text-[var(--text-primary)]">Talk title</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          placeholder="e.g. How we hit $1M ARR in fintech infrastructure"
          className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />

        <label className="mt-5 block text-sm font-medium text-[var(--text-primary)]">
          Video presentation link {tier.requiresVideo ? <span className="text-red-500">*</span> : <span className="text-[var(--text-muted)]">(optional)</span>}
        </label>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Loom, YouTube, or Vimeo URL"
          className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Paste a link to your {tier.requiresVideo ? "full presentation" : "60-second pitch"} video.
        </p>

        <label className="mt-5 block text-sm font-medium text-[var(--text-primary)]">Abstract</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="A few sentences on what you'll cover and why the room should care."
          className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />

        <label className="mt-5 block text-sm font-medium text-[var(--text-primary)]">Slides or website (optional)</label>
        <input
          value={extraLink}
          onChange={(e) => setExtraLink(e.target.value)}
          placeholder="https://…"
          className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit application"}
        </button>
      </div>

      {/* Tier features + existing applications */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">{tier.label} includes</h4>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{tier.blurb}</p>
          <ul className="mt-4 space-y-2.5">
            {tier.features.map((f) => {
              const isOptional = Boolean(f.optional);
              const checked = isOptional ? optional.has(f.id) : true;
              return (
                <li key={f.id} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!isOptional}
                    onChange={() =>
                      setOptional((prev) => {
                        const next = new Set(prev);
                        if (next.has(f.id)) next.delete(f.id);
                        else next.add(f.id);
                        return next;
                      })
                    }
                    className="mt-0.5 h-4 w-4 accent-[var(--brand-indigo,#2E78F5)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    {f.label}
                    {isOptional && <span className="ml-1 text-xs text-[var(--text-muted)]">(add-on)</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {existing.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Your applications</h4>
            <ul className="mt-3 space-y-3">
              {existing.map((a, i) => (
                <li key={`${a.eventId}-${i}`} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-[var(--text-primary)]">{a.topic}</span>
                  <span className="shrink-0 rounded-full bg-[var(--surface-muted,#f1f5f9)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                    {statusLabel(a.status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
