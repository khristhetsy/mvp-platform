"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, Sparkles, Video } from "lucide-react";
import { SPOTLIGHT, type PresentTier } from "@/lib/icfo-events/present-tiers";
import { PITCH_OUTLINE } from "@/lib/icfo-events/spotlight/rules";
import { SpotlightVideoUpload, type UploadedSpotlightVideo } from "@/components/events/SpotlightVideoUpload";
import { IcfoDisclaimer } from "@/components/events/IcfoDisclaimer";

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
  /** Sector tracks, for the Spotlight track picker. */
  sectors?: { slug: string; label: string }[];
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
export type ExistingApplication = {
  id?: string;
  eventId: string;
  status: string;
  kind: string;
  topic: string;
  decisionNote?: string | null;
  boothSponsorId?: string | null;
};

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
  // Spotlight: an uploaded 3 minute pitch. Every presenting plan can use it;
  // Professional can also choose the full presentation.
  const [mode, setMode] = useState<"spotlight" | "full">("spotlight");
  const [sectorSlug, setSectorSlug] = useState("");
  const [companySummary, setCompanySummary] = useState("");
  const [wantsBooth, setWantsBooth] = useState(true);
  const [disclaimer, setDisclaimer] = useState(false);
  const [video, setVideo] = useState<UploadedSpotlightVideo | null>(null);

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
            setVideo(null);
            setDisclaimer(false);
            setCompanySummary("");
            setSectorSlug("");
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted,#f8fafc)]"
        >
          Apply to another event
        </button>
      </div>
    );
  }

  const spotlightMode = mode === "spotlight";
  const shownTier = spotlightMode ? SPOTLIGHT : tier;
  const appliedEventIds = new Set(existing.filter((e) => e.kind === shownTier.kind).map((e) => e.eventId));
  const selectedEvent = events.find((e) => e.id === eventId) ?? null;

  async function submit() {
    setError(null);
    if (!eventId) return setError("Choose an event.");
    if (!topic.trim()) return setError("Enter a talk title.");
    if (spotlightMode) return submitSpotlight();
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

  async function submitSpotlight() {
    if (!video) return setError("Upload your pitch video.");
    if (!disclaimer) return setError("Confirm you have read the disclaimer.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/founder/events/present", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "spotlight",
          eventId,
          topic: topic.trim(),
          sectorSlug: sectorSlug || undefined,
          companySummary: companySummary.trim() || undefined,
          wantsBooth,
          disclaimerAccepted: true,
          videoPath: video.path,
          videoType: video.type,
          videoBytes: video.bytes,
          videoSeconds: video.seconds,
          videoWidth: video.width,
          videoHeight: video.height,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Could not submit your application.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
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
            {spotlightMode ? <Sparkles className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
            {shownTier.label}, included with {planLabel}
          </span>
        </div>
        {tier.key === "full" ? (
          <div className="mb-5 inline-flex rounded-lg border border-[var(--border-subtle)] p-0.5 text-sm" role="tablist">
            {(["spotlight", "full"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setEventId(""); setError(null); }}
                className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-[var(--brand-indigo,#2E78F5)] text-white" : "text-[var(--text-secondary)]"}`}
              >
                {m === "spotlight" ? "Founder Spotlight video" : "Full presentation"}
              </button>
            ))}
          </div>
        ) : null}

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
                  onClick={() => { setEventId(e.id); setVideo(null); setSectorSlug(""); }}
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

        {spotlightMode ? (
          <>
            {selectedEvent?.sectors?.length ? (
              <>
                <label className="mt-5 block text-sm font-medium text-[var(--text-primary)]">Sector track</label>
                <select
                  value={sectorSlug}
                  onChange={(e) => setSectorSlug(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="">Choose your track</option>
                  {selectedEvent.sectors.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.label}</option>
                  ))}
                </select>
              </>
            ) : null}

            <label className="mt-5 block text-sm font-medium text-[var(--text-primary)]">One line company summary</label>
            <input
              value={companySummary}
              onChange={(e) => setCompanySummary(e.target.value)}
              maxLength={200}
              placeholder="e.g. AP automation for mid market finance teams"
              className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Used for the short introduction played before your pitch.</p>

            <div className="mt-5 rounded-xl bg-[var(--surface-muted,#f8fafc)] p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">What to cover in your 3 minutes</p>
              <ol className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                {PITCH_OUTLINE.map((p, i) => (
                  <li key={p.id}>{i + 1}. {p.label}</li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Use real numbers only and end with the amount you are raising. Before you record, run your deck through the{" "}
                <Link href="/founder/pitch-deck-analyzer" className="font-medium text-[var(--brand-indigo,#2E78F5)] hover:underline">Pitch Deck Analyzer</Link>{" "}
                and rehearse in{" "}
                <Link href="/founder/pitch-practice" className="font-medium text-[var(--brand-indigo,#2E78F5)] hover:underline">Pitch Practice</Link>.
              </p>
            </div>

            <p className="mt-5 block text-sm font-medium text-[var(--text-primary)]">Pitch video <span className="text-red-500">*</span></p>
            <div className="mt-1.5">
              {eventId ? (
                <SpotlightVideoUpload key={eventId} eventId={eventId} onUploaded={setVideo} />
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Choose an event first.</p>
              )}
            </div>

            <label className="mt-5 flex items-start gap-2.5 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={wantsBooth} onChange={(e) => setWantsBooth(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand-indigo,#2E78F5)]" />
              Create my virtual booth from my profile when approved
            </label>
            <label className="mt-3 flex items-start gap-2.5 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={disclaimer} onChange={(e) => setDisclaimer(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand-indigo,#2E78F5)]" />
              I have read the disclaimer below. My pitch makes no offer of securities and no promise of returns.
            </label>
            <IcfoDisclaimer className="mt-2" />
          </>
        ) : (
          <>
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

          </>
        )}

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
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">{shownTier.label} includes</h4>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{shownTier.blurb}</p>
          <ul className="mt-4 space-y-2.5">
            {shownTier.features.map((f) => {
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
                <li key={`${a.eventId}-${i}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-[var(--text-primary)]">
                      {a.topic}
                      {a.kind === "founder_showcase" ? <span className="ml-1 text-xs text-[var(--text-muted)]">(Spotlight)</span> : null}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--surface-muted,#f1f5f9)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                      {a.kind === "founder_showcase" && a.status === "under_review" && a.decisionNote ? "Change requested" : statusLabel(a.status)}
                    </span>
                  </div>
                  {a.kind === "founder_showcase" && a.status === "under_review" && a.decisionNote && a.id ? (
                    <SpotlightResubmit applicationId={a.id} eventId={a.eventId} note={a.decisionNote} />
                  ) : null}
                  {a.kind === "founder_showcase" && a.status === "approved" && a.boothSponsorId ? (
                    <Link href={`/sponsor/${a.boothSponsorId}`} className="mt-1 inline-block text-xs font-semibold text-[var(--brand-indigo,#2E78F5)] hover:underline">
                      Finish your booth →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** After staff ask for a change: show their note and take a new video. */
function SpotlightResubmit({ applicationId, eventId, note }: { applicationId: string; eventId: string; note: string }) {
  const [video, setVideo] = useState<UploadedSpotlightVideo | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!video) return;
    setState("saving");
    setError(null);
    const res = await fetch(`/api/founder/events/spotlight/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoPath: video.path,
        videoType: video.type,
        videoBytes: video.bytes,
        videoSeconds: video.seconds,
        videoWidth: video.width,
        videoHeight: video.height,
      }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const json = res ? await res.json().catch(() => ({})) : {};
      setError((json as { error?: string }).error ?? "Could not send the new video.");
      setState("idle");
      return;
    }
    setState("done");
  }

  if (state === "done") return <p className="mt-2 text-xs text-emerald-700">New video sent for review.</p>;
  return (
    <div className="mt-2 rounded-lg bg-amber-50 p-3">
      <p className="text-xs text-amber-800">{note}</p>
      <div className="mt-2">
        <SpotlightVideoUpload eventId={eventId} onUploaded={setVideo} />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={!video || state === "saving"}
        className="mt-2 rounded-md bg-[var(--brand-indigo,#2E78F5)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {state === "saving" ? "Sending…" : "Send new video"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
