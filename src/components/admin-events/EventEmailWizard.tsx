"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TemplateVisualEditor } from "@/components/marketing/TemplateVisualEditor";
import { buildEventEmailBlocks, finalizeEventEmailHtml, eventEmailTheme } from "@/lib/event-email/blocks";
import type { EventMergeData } from "@/lib/event-email/merge";
import type { TemplateBlock } from "@/lib/marketing/template-blocks";
import type { TemplateTheme } from "@/lib/marketing/template-theme";

type PickerEvent = { id: string; title: string; slug: string; status: string; startsAt: string | null; coverUrl: string | null };
type MergeData = {
  title: string; badge: string; tagline: string; dateLabel: string; timeRange: string; formatLine: string;
  bannerUrl: string | null; registerUrl: string; lobbyUrl: string;
  sessions: { type: string; title: string; abstract: string; accent: string }[];
  sponsorLockup: string | null; organizerLine: string;
};
type EmailType = "invite" | "reminder" | "day_of" | "booklet";

const TYPES: { key: EmailType; label: string; note: string }[] = [
  { key: "invite", label: "Invite", note: "Primary CTA: Register to attend" },
  { key: "reminder", label: "Reminder", note: "“Three days to go” urgency" },
  { key: "day_of", label: "Day-of", note: "Lobby CTA promoted to primary" },
  { key: "booklet", label: "Booklet", note: "Primary CTA: Download the booklet PDF" },
];

export function EventEmailWizard({
  initialEventId,
  initialType,
  bookletEditionId,
}: {
  initialEventId?: string;
  initialType?: EmailType;
  bookletEditionId?: string;
}) {
  const [step, setStep] = useState(initialEventId ? 2 : 1);
  const [events, setEvents] = useState<PickerEvent[]>([]);
  const [eventId, setEventId] = useState<string | null>(initialEventId ?? null);
  const [merge, setMerge] = useState<MergeData | null>(null);
  const [type, setType] = useState<EmailType>(initialType ?? "invite");
  const bookletUrl = bookletEditionId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/events/brochure/${bookletEditionId}`
    : undefined;
  const [includeBanner, setIncludeBanner] = useState(true);
  const [includeLobby, setIncludeLobby] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Inline block editor (whole email becomes editable Marketing blocks).
  const [editMode, setEditMode] = useState(false);
  const [editBlocks, setEditBlocks] = useState<TemplateBlock[] | null>(null);
  const [blockTheme, setBlockTheme] = useState<TemplateTheme>(eventEmailTheme());

  // step 3 — audience & send
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [registrants, setRegistrants] = useState<{ registered: number; attended: number; no_show: number; total: number } | null>(null);
  const [listId, setListId] = useState("");
  const [audienceKind, setAudienceKind] = useState<"list" | "registrants">("list");
  const [regStatuses, setRegStatuses] = useState<string[]>(["registered"]);
  const [subject, setSubject] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduleAt, setScheduleAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ campaignId: string; status: string } | null>(null);

  const lobbyForced = type === "day_of";

  // load audience options when entering step 3
  useEffect(() => {
    if (step !== 3 || !eventId) return;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/events/email/audience?eventId=${eventId}`);
        const json = await res.json();
        if (res.ok) { setLists(json.lists ?? []); setRegistrants(json.registrants ?? null); }
      } catch { /* ignore */ }
    })();
  }, [step, eventId]);

  async function createCampaign() {
    if (!eventId || !subject.trim()) return;
    if (audienceKind === "list" && !listId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId, type, includeBanner, includeLobby: includeLobby || lobbyForced,
          bookletEditionId,
          bodyHtml: editedHtml ?? undefined,
          audienceKind, listId, registrantStatuses: regStatuses, subject: subject.trim(),
          scheduleAt: scheduleMode === "later" && scheduleAt ? new Date(scheduleAt).toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't create the campaign.");
      setResult({ campaignId: json.campaignId, status: json.status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the campaign.");
    } finally {
      setCreating(false);
    }
  }

  // Seed the block document from the event, then edit it inline. Once seeded,
  // edits are a snapshot — changing the email type won't reseed until Reset.
  function startEditing() {
    if (editBlocks === null && merge) {
      setEditBlocks(buildEventEmailBlocks(merge as unknown as EventMergeData, type, { includeBanner, includeLobby: includeLobby || lobbyForced, bookletUrl }));
    }
    setEditMode(true);
  }
  function resetContent() {
    if (!merge) return;
    setEditBlocks(buildEventEmailBlocks(merge as unknown as EventMergeData, type, { includeBanner, includeLobby: includeLobby || lobbyForced, bookletUrl }));
  }
  const editedHtml = editBlocks ? finalizeEventEmailHtml(editBlocks, blockTheme) : null;

  // load picker
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/events/email/events");
        const json = await res.json();
        if (res.ok) setEvents(json.events as PickerEvent[]);
      } catch { /* ignore */ }
    })();
  }, []);

  // load merge data when an event is chosen
  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/events/email/${eventId}/merge`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't load event data.");
        const m = json.merge as MergeData;
        setMerge(m);
        setSubject((prev) => prev || (initialType === "booklet" ? `Your event booklet: ${m.title}` : `You're invited: ${m.title}`));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load event data.");
      }
    })();
  }, [eventId, initialType]);

  // render preview on any change
  const renderPreview = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events/email/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, type, includeBanner, includeLobby: includeLobby || lobbyForced, bookletUrl }),
      });
      const json = await res.json();
      if (res.ok) setHtml(json.html as string);
    } finally {
      setLoading(false);
    }
  }, [eventId, type, includeBanner, includeLobby, lobbyForced, bookletUrl]);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step !== 2 || !eventId) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void renderPreview(), 200);
  }, [step, eventId, renderPreview]);

  function pick(id: string) { setEventId(id); setStep(2); }

  return (
    <div>
      {/* step indicator */}
      <div className="mb-5 flex items-center gap-2 text-xs font-semibold">
        {["Select event", "Content & preview", "Audience & send"].map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${active ? "bg-[var(--blue)] text-white" : done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{done ? "✓" : n}</span>
              <span className={active ? "text-[var(--navy)]" : "text-[var(--text-muted)]"}>{label}</span>
              {n < 3 && <span className="mx-1 text-slate-300">→</span>}
            </div>
          );
        })}
      </div>

      {error && <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* STEP 1 — select event */}
      {step === 1 && (
        <div>
          <p className="mb-3 text-sm text-[var(--text-muted)]">Pick a published or live event. Data is pulled from the event record — fix any wrong data at the source on the event page.</p>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No published or live events yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {events.map((e) => (
                <button key={e.id} type="button" onClick={() => pick(e.id)} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-3 text-left hover:border-[var(--blue)]">
                  <span className="h-12 w-16 flex-none overflow-hidden rounded-md bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {e.coverUrl ? <img src={e.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--navy)]">{e.title}</span>
                    <span className="block text-xs text-[var(--text-muted)]">{e.status} · {e.startsAt ? new Date(e.startsAt).toLocaleDateString() : "date TBA"}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2 — content & preview */}
      {step === 2 && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <button type="button" onClick={() => setStep(1)} className="text-xs font-semibold text-[var(--blue)] hover:underline">← Change event</button>

            {/* pulled data card */}
            {merge && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Pulled from event record</p>
                <p className="mt-1 text-sm font-semibold text-[var(--navy)]">{merge.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{merge.dateLabel}{merge.timeRange ? ` · ${merge.timeRange}` : ""}</p>
                <p className="text-xs text-[var(--text-muted)]">{merge.formatLine} · {merge.sessions.length} session{merge.sessions.length === 1 ? "" : "s"}</p>
              </div>
            )}

            {/* email type */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Email type</p>
              <div className="space-y-2">
                {TYPES.map((tt) => (
                  <button key={tt.key} type="button" onClick={() => setType(tt.key)} className={`w-full rounded-lg border px-3 py-2 text-left ${type === tt.key ? "border-[var(--blue)] bg-[var(--blue-muted)]" : "border-[var(--border-subtle)] bg-white"}`}>
                    <span className="block text-sm font-semibold text-[var(--navy)]">{tt.label}</span>
                    <span className="block text-xs text-[var(--text-muted)]">{tt.note}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* toggles */}
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={includeBanner} onChange={(e) => setIncludeBanner(e.target.checked)} /> Banner image <span className="text-xs text-[var(--text-muted)]">(else solid navy hero)</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={includeLobby || lobbyForced} disabled={lobbyForced} onChange={(e) => setIncludeLobby(e.target.checked)} /> Lobby CTA {lobbyForced && <span className="text-xs text-[var(--text-muted)]">(forced on for day-of)</span>}</label>
            </div>

            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-[var(--text-muted)]">🔒 Compliance footer is locked into every event template (education/community only — not an offer of securities).</div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(3)} className="cap-btn-primary flex-1 rounded-md px-4 py-2 text-sm font-medium">Continue to audience →</button>
              {editMode ? (
                <button type="button" onClick={() => setEditMode(false)} className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--navy)] hover:border-[var(--blue)]">Done editing</button>
              ) : (
                <button type="button" onClick={startEditing} disabled={!merge} className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--navy)] hover:border-[var(--blue)] disabled:opacity-50">Edit content</button>
              )}
            </div>
            {editBlocks && (
              <p className="text-[11px] text-[var(--text-muted)]">
                You’re editing every block inline. This is a snapshot — it won’t re-pull if the event changes.{" "}
                <button type="button" onClick={resetContent} className="font-semibold text-[var(--blue)] underline">Reset to event content</button>
              </p>
            )}
          </div>

          {/* preview / inline editor */}
          <div>
            {editMode && editBlocks ? (
              <>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Editing content · inline block editor</p>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-2">
                  <TemplateVisualEditor blocks={editBlocks} onChange={setEditBlocks} theme={blockTheme} onThemeChange={setBlockTheme} />
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">The compliance footer is added automatically on send and can’t be removed.</p>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Live preview {loading && <span className="font-normal">· rendering…</span>}</p>
                  <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border-subtle)] text-xs">
                    {(["desktop", "mobile"] as const).map((d) => (
                      <button key={d} type="button" onClick={() => setDevice(d)} className={`px-3 py-1 font-semibold capitalize ${device === d ? "bg-[var(--blue)] text-white" : "bg-white text-[var(--text-muted)]"}`}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center rounded-xl border border-[var(--border-subtle)] bg-slate-100 p-3">
                  <iframe title="Email preview" srcDoc={editedHtml ?? html} style={{ width: device === "mobile" ? 380 : "100%", maxWidth: 680, height: 640, border: "none", background: "#fff", borderRadius: 8 }} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 3 — audience & send */}
      {step === 3 && (
        <div className="max-w-xl">
          <button type="button" onClick={() => setStep(2)} className="text-xs font-semibold text-[var(--blue)] hover:underline">← Back to content</button>
          {result ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
              <p className="font-semibold">Campaign created ({result.status}).</p>
              <p className="mt-1">It&apos;s in Marketing Hub with the rendered email, audience, and event linkage — ready to review and send.</p>
              <a href="/admin/marketing/campaigns" className="mt-3 inline-block font-semibold underline">Open in Marketing Hub →</a>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Audience</label>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-1.5"><input type="radio" checked={audienceKind === "list"} onChange={() => setAudienceKind("list")} /> CRM list</label>
                  <label className="flex items-center gap-1.5"><input type="radio" checked={audienceKind === "registrants"} onChange={() => setAudienceKind("registrants")} /> Event registrants</label>
                </div>
              </div>

              {audienceKind === "list" ? (
                <select value={listId} onChange={(e) => setListId(e.target.value)} className="block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
                  <option value="">Select a CRM list…</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Build a send list from this event&apos;s registrants (suppression honored). Include statuses:</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {(["registered", "attended", "no_show"] as const).map((s) => {
                      const on = regStatuses.includes(s);
                      const count = registrants ? registrants[s] : 0;
                      return (
                        <label key={s} className="flex items-center gap-1.5">
                          <input type="checkbox" checked={on} onChange={(e) => setRegStatuses((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))} />
                          {s.replace("_", "-")} <span className="text-xs text-[var(--text-muted)]">({count})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Subject line</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Schedule</label>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-1.5"><input type="radio" checked={scheduleMode === "now"} onChange={() => setScheduleMode("now")} /> Save as draft</label>
                  <label className="flex items-center gap-1.5"><input type="radio" checked={scheduleMode === "later"} onChange={() => setScheduleMode("later")} /> Schedule for later</label>
                </div>
                {scheduleMode === "later" && (
                  <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="mt-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
                )}
              </div>
              <button type="button" onClick={createCampaign} disabled={creating || !subject.trim() || (audienceKind === "list" && !listId) || (audienceKind === "registrants" && regStatuses.length === 0) || (scheduleMode === "later" && !scheduleAt)} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
                {creating ? "Creating…" : scheduleMode === "later" ? "Schedule campaign" : "Create draft campaign"}
              </button>
              <p className="text-[11px] text-[var(--text-muted)]">The compliance footer is locked into the email. The campaign lands in Marketing Hub — final send happens there.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
