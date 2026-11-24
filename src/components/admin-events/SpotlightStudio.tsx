"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { SPOTLIGHT_SLOT_SECONDS, formatClock, minutesBetween, spotlightCapacity } from "@/lib/icfo-events/spotlight/rules";
import type { SpotlightApplication } from "@/lib/icfo-events/spotlight/service";

export type StudioSession = { id: string; title: string; type: string; startsAt: string | null; endsAt: string | null };
type StudioEvent = { id: string; title: string; slug: string; timezone: string; startsAt: string | null; endsAt: string | null };
type Filter = "open" | "change" | "approved" | "declined";

const TYPE_LABEL: Record<string, string> = {
  keynote: "Keynote",
  panel: "Panel",
  talk_show: "Talk show",
  founder_showcase: "Founder showcase",
  workshop: "Workshop",
};

function stateOf(a: SpotlightApplication): Filter {
  if (a.status === "approved") return "approved";
  if (a.status === "declined") return "declined";
  if (a.status === "under_review" && a.decisionNote) return "change";
  return "open";
}

const STATE_LABEL: Record<Filter, string> = {
  open: "To review",
  change: "Change requested",
  approved: "Approved",
  declined: "Declined",
};

export function SpotlightStudio({
  event,
  sessions,
  sectors,
  initialApplications,
  videoUrls,
  canEdit,
}: {
  event: StudioEvent;
  sessions: StudioSession[];
  sectors: { slug: string; label: string }[];
  initialApplications: SpotlightApplication[];
  videoUrls: Record<string, string>;
  canEdit: boolean;
}) {
  const [apps, setApps] = useState(initialApplications);
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialApplications.find((a) => stateOf(a) === "open")?.id ?? initialApplications[0]?.id ?? null,
  );
  const [whatIf, setWhatIf] = useState(150);

  const tz = event.timezone;
  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }) : "time not set";
  const sectorName = (slug: string | null) => (slug ? (sectors.find((s) => s.slug === slug)?.label ?? slug) : "No track");

  const showcase = sessions.filter((s) => s.type === "founder_showcase");
  const showcaseMinutes = showcase.map((s) => minutesBetween(s.startsAt, s.endsAt));
  const measured = showcase.length > 0 && showcaseMinutes.every((m) => m != null);
  const capacity = measured ? showcaseMinutes.reduce<number>((t, m) => t + spotlightCapacity(m ?? 0), 0) : null;
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { open: 0, change: 0, approved: 0, declined: 0 };
    for (const a of apps) c[stateOf(a)] += 1;
    return c;
  }, [apps]);

  const visible = apps.filter((a) => stateOf(a) === filter);
  const selected = apps.find((a) => a.id === selectedId) ?? null;

  function replace(next: SpotlightApplication) {
    setApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/events/${event.id}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" /> {event.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Spotlight studio</h1>
          <div className="flex items-center gap-2">
            <a href="https://studio.youtube.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-slate-50">
              YouTube Studio <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link href={`/events/${event.slug}/spotlight`} target="_blank" className="cap-btn-primary inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium">
              Preview player <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Run of show */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Run of show</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {fmtTime(event.startsAt)} to {fmtTime(event.endsAt)} · one slot is {formatClock(SPOTLIGHT_SLOT_SECONDS)} (up to 1:00 pitch plus a 5s break)
          </span>
        </div>
        <ul className="mt-3 divide-y divide-slate-100">
          {sessions.map((s) => {
            const mins = minutesBetween(s.startsAt, s.endsAt);
            const isShow = s.type === "founder_showcase";
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${isShow ? "bg-blue-50 text-[#185FA5]" : "bg-slate-100 text-slate-600"}`}>{TYPE_LABEL[s.type] ?? s.type}</span>
                  <span className="text-[var(--text-primary)]">{s.title}</span>
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {s.startsAt ? `${fmtTime(s.startsAt)} to ${fmtTime(s.endsAt)}` : "Set start and end on the event page"}
                  {mins != null ? ` · ${mins} min` : ""}
                  {isShow && mins != null ? ` · ${spotlightCapacity(mins)} slots` : ""}
                </span>
              </li>
            );
          })}
          {sessions.length === 0 ? <li className="py-2 text-sm text-[var(--text-muted)]">No sessions yet. Add a Founder showcase session on the event page.</li> : null}
        </ul>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Live slots"
            value={capacity == null ? "Not measured" : String(capacity)}
            detail={capacity == null ? "Showcase sessions need start and end times" : `across ${showcase.length} showcase ${showcase.length === 1 ? "block" : "blocks"}`}
            ring={capacity == null ? { percent: null, pending: true } : undefined}
            audience="admin"
          />
          <MetricCard
            label="Approved"
            value={String(counts.approved)}
            unit={capacity == null ? undefined : `of ${capacity}`}
            detail="approved pitches in the lineup"
            ring={capacity ? { percent: Math.min(100, Math.round((counts.approved / capacity) * 100)) } : { percent: null, pending: true }}
            flag={capacity != null && counts.approved > capacity ? { text: `${counts.approved - capacity} over: extras play on demand in booths`, tone: "warn" } : null}
            audience="admin"
          />
          <MetricCard
            label="To review"
            value={String(counts.open)}
            detail={`${counts.change} waiting on a founder change`}
            ring={{ percent: null, pending: true }}
            audience="admin"
          />
        </div>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          Planning: if the Spotlight runs
          <input type="number" min={0} max={600} step={5} value={whatIf} onChange={(e) => setWhatIf(Number(e.target.value))} className="w-20 rounded border border-[var(--border-subtle)] px-2 py-1 text-xs" />
          minutes, it fits <span className="font-semibold text-[var(--text-primary)]">{spotlightCapacity(whatIf)}</span> companies.
        </label>
      </section>

      {/* Review queue */}
      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-3">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(STATE_LABEL) as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-2.5 py-1 text-xs ${filter === f ? "bg-[#1A6CE4] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {STATE_LABEL[f]} {counts[f]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">{visible.length} of {apps.length} applications</p>
          <ul className="mt-1 divide-y divide-slate-100">
            {visible.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full px-2 py-2 text-left ${selectedId === a.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">{a.company?.name ?? a.applicantName ?? "Founder"}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {sectorName(a.sectorSlug)} · {a.youtubeVideoId ? "YouTube link sent" : "no link"}
                  </p>
                </button>
              </li>
            ))}
            {visible.length === 0 ? <li className="px-2 py-6 text-center text-xs text-[var(--text-muted)]">Nothing here.</li> : null}
          </ul>
        </div>

        {selected ? (
          <ReviewPanel
            key={selected.id}
            app={selected}
            eventId={event.id}
            videoUrl={videoUrls[selected.id] ?? null}
            showcase={showcase}
            fmtTime={fmtTime}
            sectorName={sectorName}
            canEdit={canEdit}
            onChange={replace}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-10 text-center text-sm text-[var(--text-muted)]">
            Spotlight applications land here when founders send their 1 minute YouTube pitch.
          </div>
        )}
      </section>

      <Lineup eventId={event.id} apps={apps} showcase={showcase} fmtTime={fmtTime} canEdit={canEdit} onReordered={setApps} />
    </div>
  );
}

async function post(eventId: string, appId: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/admin/events/${eventId}/spotlight/${appId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "That didn't work.");
  return json;
}

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${done ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-[#185FA5]"}`}>{done ? "✓" : n}</span>
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ReviewPanel({
  app,
  eventId,
  videoUrl,
  showcase,
  fmtTime,
  sectorName,
  canEdit,
  onChange,
}: {
  app: SpotlightApplication;
  eventId: string;
  videoUrl: string | null;
  showcase: StudioSession[];
  fmtTime: (iso: string | null) => string;
  sectorName: (slug: string | null) => string;
  canEdit: boolean;
  onChange: (a: SpotlightApplication) => void;
}) {
  const [youtube, setYoutube] = useState(app.youtubeVideoId ?? "");
  const [note, setNote] = useState("");
  const [sessionId, setSessionId] = useState(app.sessionId ?? showcase[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const decided = app.status === "approved" || app.status === "declined";

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-[var(--text-primary)]">{app.company?.name ?? app.applicantName ?? "Founder"}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {app.applicantName ?? ""}{app.applicantEmail ? ` · ${app.applicantEmail}` : ""} · {sectorName(app.sectorSlug)}
            {app.company?.fundingStage ? ` · ${app.company.fundingStage}` : ""}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{app.topic}</p>
          {app.companySummary ? <p className="text-xs text-[var(--text-muted)]">{app.companySummary}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{STATE_LABEL[stateOf(app)]}</span>
      </div>

      {app.youtubeVideoId ? (
        <div className="aspect-video overflow-hidden rounded-lg bg-[#0A1A40]">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${app.youtubeVideoId}?rel=0`}
            title="Pitch on YouTube"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : videoUrl ? (
        <video src={videoUrl} controls preload="metadata" className="aspect-video w-full rounded-lg bg-[#0A1A40]" />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-sm text-[var(--text-muted)]">No YouTube link yet</div>
      )}
      <p className="text-xs text-[var(--text-muted)]">Plays as posted and stops at 1:00. The studio never edits a pitch.</p>

      {app.decisionNote && app.status === "under_review" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Change requested: {app.decisionNote}</p>
      ) : null}

      {canEdit && !decided ? (
        <>
          <Step n={1} title="Check the YouTube link" done={Boolean(app.youtubeVideoId)}>
            <p className="text-xs text-[var(--text-muted)]">
              The founder sent this link. Watch it above: it must be 1:00 or shorter and must not state an amount being raised. If the link is wrong, request a change below.
            </p>
            <div className="mt-2 flex gap-2">
              <input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtu.be/…" className="min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm" />
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run("youtube", async () => {
                    const json = await post(eventId, app.id, { action: "youtube", youtube });
                    const id = (json.youtubeVideoId as string | null) ?? null;
                    setYoutube(id ?? "");
                    onChange({ ...app, youtubeVideoId: id });
                  })
                }
                className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "youtube" ? "Saving…" : "Save"}
              </button>
            </div>
          </Step>

          <Step n={2} title="Decide">
            <label className="block text-xs text-[var(--text-muted)]">
              Showcase block
              <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm text-[var(--text-primary)]">
                {showcase.map((s) => (
                  <option key={s.id} value={s.id}>{s.title} · {fmtTime(s.startsAt)}</option>
                ))}
                <option value="">No block yet (booth only)</option>
              </select>
            </label>
            <label className="mt-3 block text-xs text-[var(--text-muted)]">
              Note to the founder (needed to request a change or decline)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== null || !note.trim()}
                onClick={() =>
                  run("decline", async () => {
                    await post(eventId, app.id, { action: "decline", note });
                    onChange({ ...app, status: "declined", decisionNote: note });
                  })
                }
                className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "decline" ? "Declining…" : "Decline"}
              </button>
              <button
                type="button"
                disabled={busy !== null || !note.trim()}
                onClick={() =>
                  run("request_change", async () => {
                    await post(eventId, app.id, { action: "request_change", note });
                    onChange({ ...app, status: "under_review", decisionNote: note });
                  })
                }
                className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "request_change" ? "Sending…" : "Request change"}
              </button>
              <button
                type="button"
                disabled={busy !== null || !app.youtubeVideoId}
                title={app.youtubeVideoId ? undefined : "A YouTube link is needed first"}
                onClick={() =>
                  run("approve", async () => {
                    const json = await post(eventId, app.id, { action: "approve", sessionId: sessionId || null });
                    onChange({
                      ...app,
                      status: "approved",
                      decisionNote: null,
                      videoPath: null,
                      presenterId: String(json.presenterId),
                      boothSponsorId: (json.boothId as string | null) ?? null,
                      sessionId: sessionId || null,
                      position: 9999,
                    });
                  })
                }
                className="cap-btn-primary rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
            </div>
            {!app.youtubeVideoId ? <p className="mt-2 text-xs text-[var(--text-muted)]">Approve needs the founder&rsquo;s YouTube link from step 1.</p> : null}
          </Step>
        </>
      ) : null}

      {decided ? (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-[var(--text-secondary)]">
          {app.status === "approved"
            ? `Approved${app.boothSponsorId ? " · booth created for the founder to finish" : ""}. The pitch joins the lineup below.`
            : `Declined. ${app.decisionNote ?? ""}`}
        </div>
      ) : null}

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
    </div>
  );
}

function Lineup({
  eventId,
  apps,
  showcase,
  fmtTime,
  canEdit,
  onReordered,
}: {
  eventId: string;
  apps: SpotlightApplication[];
  showcase: StudioSession[];
  fmtTime: (iso: string | null) => string;
  canEdit: boolean;
  onReordered: (next: SpotlightApplication[]) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blocks = [...showcase.map((s) => ({ id: s.id as string | null, title: s.title, startsAt: s.startsAt })), { id: null, title: "Booth only (no live slot)", startsAt: null }];

  function itemsFor(blockId: string | null) {
    return apps
      .filter((a) => a.status === "approved" && a.presenterId && (a.sessionId ?? null) === blockId)
      .sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
  }

  async function move(blockId: string | null, index: number, dir: -1 | 1) {
    const items = itemsFor(blockId);
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const order = [...items];
    [order[index], order[j]] = [order[j], order[index]];
    const positions = new Map(order.map((a, i) => [a.id, i]));
    onReordered(apps.map((a) => (positions.has(a.id) ? { ...a, position: positions.get(a.id) ?? 0 } : a)));
    setSaving(blockId ?? "none");
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/spotlight/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presenterIds: order.map((a) => a.presenterId) }),
      });
      if (!res.ok) throw new Error("Could not save the order.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the order.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Lineup</h2>
      <p className="text-xs text-[var(--text-muted)]">Plays top to bottom in each block, every {formatClock(SPOTLIGHT_SLOT_SECONDS)}.</p>
      <div className="mt-3 space-y-4">
        {blocks.map((b) => {
          const items = itemsFor(b.id);
          if (b.id === null && items.length === 0) return null;
          return (
            <div key={b.id ?? "none"}>
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                {b.title}{b.startsAt ? ` · starts ${fmtTime(b.startsAt)}` : ""} · {items.length}
                {saving === (b.id ?? "none") ? " · saving…" : ""}
              </p>
              <ol className="mt-1 divide-y divide-slate-100 rounded-lg border border-[var(--border-subtle)]">
                {items.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-16 text-xs text-[var(--text-muted)]">
                      {b.startsAt ? fmtTime(new Date(Date.parse(b.startsAt) + i * SPOTLIGHT_SLOT_SECONDS * 1000).toISOString()) : `#${i + 1}`}
                    </span>
                    <span className="flex-1 text-[var(--text-primary)]">{a.company?.name ?? a.applicantName}</span>
                    {canEdit ? (
                      <span className="flex gap-1">
                        <button type="button" aria-label="Move up" onClick={() => move(b.id, i, -1)} disabled={i === 0} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" aria-label="Move down" onClick={() => move(b.id, i, 1)} disabled={i === items.length - 1} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      </span>
                    ) : null}
                  </li>
                ))}
                {items.length === 0 ? <li className="px-3 py-3 text-xs text-[var(--text-muted)]">No approved pitches in this block yet.</li> : null}
              </ol>
            </div>
          );
        })}
      </div>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
