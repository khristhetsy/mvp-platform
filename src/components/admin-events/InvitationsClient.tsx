"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NewButton } from "@/components/admin/ToolbarGear";
import {
  INVITE_ROLES,
  OFFERS,
  ROLE_LABEL,
  STAT_KEYS,
  STAT_LABEL,
  STAT_SOURCE,
  defaultStatSettings,
  type Audience,
  type InviteRole,
  type StatCounts,
  type StatSettings,
} from "@/lib/icfo-events/invitations/types";
import { platformInputToIso, toPlatformInput } from "@/lib/time/platform-input";

type Campaign = {
  id: string; name: string; eventIds: string[]; audiences: Audience[]; status: string;
  scheduleAt: string | null; stats: StatSettings; fromName: string; fromEmail: string;
  invited: number; sent: number; opened: number; registered: number;
};
type EventRow = { id: string; slug: string; title: string; starts_at: string };
type ListRow = { id: string; name: string; count: number };
type Data = { campaigns: Campaign[]; events: EventRow[]; lists: ListRow[]; today: Record<string, StatCounts> };

type Draft = {
  id: string | null; name: string; eventIds: string[]; audiences: Audience[]; when: "now" | "later";
  scheduleAt: string; stats: StatSettings; fromName: string; fromEmail: string; status: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-50 text-amber-800",
  scheduled: "bg-blue-50 text-blue-800",
  sending: "bg-blue-50 text-blue-800",
  paused: "bg-slate-100 text-slate-700",
  done: "bg-emerald-50 text-emerald-800",
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function emptyDraft(events: EventRow[]): Draft {
  return {
    id: null,
    name: "Event invitations",
    eventIds: events.map((e) => e.id),
    audiences: INVITE_ROLES.map((role) => ({ role, listId: null, offers: OFFERS[role].map((o) => o.key), subject: null, intro: null })),
    when: "later",
    scheduleAt: "",
    stats: defaultStatSettings(),
    fromName: "iCFO Capital",
    fromEmail: "outreach@icapos.com",
    status: "draft",
  };
}


export function InvitationsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [preview, setPreview] = useState<{ role: InviteRole; subject: string; html: string } | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(async () => { setReloadKey((k) => k + 1); }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/events/invitations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Data | null) => { if (alive && j) setData(j); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [reloadKey]);

  const locked = draft ? ["scheduled", "sending", "done"].includes(draft.status) : false;
  const rows = useMemo(() => (data?.campaigns ?? []).filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())), [data, q]);

  function open(c: Campaign) {
    setMsg(null); setPreview(null);
    const audiences = INVITE_ROLES.map((role) => c.audiences.find((a) => a.role === role) ?? { role, listId: null, offers: OFFERS[role].map((o) => o.key), subject: null, intro: null });
    setDraft({ id: c.id, name: c.name, eventIds: c.eventIds, audiences, when: "later", scheduleAt: toPlatformInput(c.scheduleAt), stats: c.stats, fromName: c.fromName, fromEmail: c.fromEmail, status: c.status });
  }

  function patchAudience(role: InviteRole, p: Partial<Audience>) {
    setDraft((d) => d && { ...d, audiences: d.audiences.map((a) => (a.role === role ? { ...a, ...p } : a)) });
  }

  async function save(): Promise<string | null> {
    if (!draft) return null;
    const body = {
      name: draft.name, eventIds: draft.eventIds, audiences: draft.audiences,
      scheduleAt: draft.when === "now" ? new Date().toISOString() : draft.scheduleAt ? platformInputToIso(draft.scheduleAt) : null,
      stats: draft.stats, fromName: draft.fromName, fromEmail: draft.fromEmail,
    };
    const r = await fetch(draft.id ? `/api/admin/events/invitations/${draft.id}` : "/api/admin/events/invitations", {
      method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ kind: "err", text: j.error ?? "Could not save." }); return null; }
    setDraft((d) => d && { ...d, id: j.campaign.id, status: j.campaign.status });
    return j.campaign.id as string;
  }

  async function act(action: "schedule" | "pause" | "resume" | "test" | "preview", role?: InviteRole) {
    if (!draft) return;
    setBusy(true); setMsg(null);
    try {
      if (action === "schedule" && draft.when === "later" && !draft.scheduleAt) { setMsg({ kind: "err", text: "Pick a send time, or choose Send now." }); return; }
      const id = locked ? draft.id : await save();
      if (!id) return;
      const r = await fetch(`/api/admin/events/invitations/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, role }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ kind: "err", text: j.error ?? "Action failed." }); return; }
      if (action === "preview") { setPreview({ role: role ?? "founder", subject: j.subject, html: j.html }); return; }
      if (action === "test") { setMsg({ kind: "ok", text: `Test sent to ${j.to}.` }); return; }
      if (action === "schedule") setMsg({ kind: "ok", text: `Scheduled. ${j.enrolled} people will be invited${j.skipped ? `, ${j.skipped} left out (unsubscribed or flagged)` : ""}.` });
      if (action === "pause") setMsg({ kind: "ok", text: "Paused." });
      if (action === "resume") setMsg({ kind: "ok", text: "Resumed." });
      await load();
      setDraft((d) => d && { ...d, status: action === "pause" ? "paused" : "scheduled" });
    } finally {
      setBusy(false);
    }
  }

  async function saveOnly() {
    setBusy(true); setMsg(null);
    const id = await save();
    if (id) { setMsg({ kind: "ok", text: "Saved." }); await load(); }
    setBusy(false);
  }

  async function remove() {
    if (!draft?.id) { setDraft(null); return; }
    setBusy(true);
    const r = await fetch(`/api/admin/events/invitations/${draft.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "err", text: j.error ?? "Could not delete." }); return; }
    setDraft(null); await load();
  }

  if (!data) return <p className="py-10 text-sm text-slate-500">Loading invitations…</p>;

  /* ------------------------------------------------------------- list view */
  if (!draft) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 pb-3">
          <NewButton onClick={() => { setMsg(null); setPreview(null); setDraft(emptyDraft(data.events)); }} />
          <h1 className="text-[15px] font-semibold text-slate-900">Invitations</h1>
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5">
              <i className="ti ti-search text-slate-400" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns" className="w-full text-[13px] outline-none" />
            </div>
          </div>
          <span className="text-[12.5px] tabular-nums text-slate-600">{rows.length ? `1-${rows.length} / ${rows.length}` : "0 / 0"}</span>
        </div>
        {rows.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-medium text-slate-800">Invite founders, investors and advisors to your events</p>
            <p className="mt-1 text-sm text-slate-500">A campaign sends the invitation, follows up, and stops when someone registers.</p>
            <button type="button" onClick={() => setDraft(emptyDraft(data.events))} className="mt-4 rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white">Create campaign</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-slate-500">
                  <th className="px-2 py-2 font-medium">Campaign</th><th className="px-2 py-2 font-medium">Events</th><th className="px-2 py-2 font-medium">Audiences</th>
                  <th className="px-2 py-2 font-medium">Status</th><th className="px-2 py-2 font-medium">Send time</th>
                  <th className="px-2 py-2 text-right font-medium">Invited</th><th className="px-2 py-2 text-right font-medium">Sent</th><th className="px-2 py-2 text-right font-medium">Opened</th><th className="px-2 py-2 text-right font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => open(c)} className="cursor-pointer border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-2 py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="px-2 py-2 text-slate-600">{c.eventIds.length}</td>
                    <td className="px-2 py-2 text-slate-600">{c.audiences.filter((a) => a.listId).map((a) => ROLE_LABEL[a.role]).join(", ") || "None"}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[c.status] ?? ""}`}>{c.status[0].toUpperCase() + c.status.slice(1)}</span></td>
                    <td className="px-2 py-2 text-slate-600">{c.scheduleAt ? new Date(c.scheduleAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not set"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{c.invited}</td><td className="px-2 py-2 text-right tabular-nums">{c.sent}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{c.opened}</td><td className="px-2 py-2 text-right tabular-nums">{c.registered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------- form view */
  const chosenEvents = data.events.filter((e) => draft.eventIds.includes(e.id));
  const todayFor = (k: (typeof STAT_KEYS)[number]) => {
    const vals = chosenEvents.map((e) => data.today[e.id]?.[k] ?? null);
    if (vals.every((v) => v === null)) return "Not built yet";
    if (draft.stats.per === "event") return chosenEvents[0] ? String(vals[0] ?? 0) : "0";
    return String(vals.reduce<number>((s, v) => s + (v ?? 0), 0));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 pb-3">
        <button type="button" onClick={() => { setDraft(null); setPreview(null); void load(); }} className="text-[13px] text-slate-500 hover:text-slate-800">Invitations</button>
        <i className="ti ti-chevron-right text-slate-400" aria-hidden="true" />
        <input value={draft.name} disabled={locked} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="min-w-[220px] rounded-md border border-transparent px-1.5 py-1 text-[15px] font-semibold text-slate-900 hover:border-slate-200 focus:border-slate-300" />
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[draft.status] ?? ""}`}>{draft.status[0].toUpperCase() + draft.status.slice(1)}</span>
      </div>

      {msg ? <p className={`mt-3 rounded-md px-3 py-2 text-[13px] ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{msg.text}</p> : null}
      {locked ? <p className="mt-3 text-[12.5px] text-slate-500">This campaign is {draft.status}. Events and audiences are fixed; live number settings can still change.</p> : null}

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section>
          <p className="mb-2 text-[12px] font-medium text-slate-500">1. Events attendees can choose</p>
          <div className="grid gap-1.5">
            {data.events.length === 0 ? <p className="text-sm text-slate-500">No upcoming published events.</p> : null}
            {data.events.map((e) => (
              <label key={e.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px]">
                <input type="checkbox" disabled={locked} checked={draft.eventIds.includes(e.id)} onChange={(ev) => setDraft({ ...draft, eventIds: ev.target.checked ? [...draft.eventIds, e.id] : draft.eventIds.filter((x) => x !== e.id) })} />
                <span className="flex-1">{e.title}</span>
                <span className="text-[11.5px] text-slate-500">{fmtDate(e.starts_at)}</span>
              </label>
            ))}
          </div>

          <p className="mb-2 mt-5 text-[12px] font-medium text-slate-500">3. Send</p>
          <div className="flex flex-wrap gap-2">
            <select disabled={locked} value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value as Draft["when"] })} className="rounded-md border border-slate-300 px-2 py-1.5 text-[13px]">
              <option value="later">Schedule</option>
              <option value="now">Send now</option>
            </select>
            {draft.when === "later" ? (
              <input type="datetime-local" disabled={locked} value={draft.scheduleAt} onChange={(e) => setDraft({ ...draft, scheduleAt: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-[13px]" />
            ) : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[11.5px] text-slate-500">From name<input disabled={locked} value={draft.fromName} onChange={(e) => setDraft({ ...draft, fromName: e.target.value })} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[13px] text-slate-900" /></label>
            <label className="text-[11.5px] text-slate-500">From email<input disabled={locked} value={draft.fromEmail} onChange={(e) => setDraft({ ...draft, fromEmail: e.target.value })} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[13px] text-slate-900" /></label>
          </div>
          <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-[12px] text-slate-600">Skips unsubscribed and flagged addresses. Follow ups stop when someone registers for every chosen event, replies by unsubscribing, or the events pass.</p>
        </section>

        <section>
          <p className="mb-2 text-[12px] font-medium text-slate-500">2. Audience and what each role is offered</p>
          <div className="grid gap-2.5">
            {draft.audiences.map((a) => (
              <div key={a.role} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-slate-900">{ROLE_LABEL[a.role]}</p>
                  <select disabled={locked} value={a.listId ?? ""} onChange={(e) => patchAudience(a.role, { listId: e.target.value || null })} className="ml-auto max-w-[60%] rounded-md border border-slate-300 px-2 py-1 text-[12.5px]">
                    <option value="">Not invited</option>
                    {data.lists.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.count.toLocaleString("en-US")}</option>)}
                  </select>
                </div>
                <div className="mt-2 grid gap-1">
                  {OFFERS[a.role].map((o) => (
                    <label key={o.key} className="flex items-center gap-2 text-[12.5px] text-slate-700">
                      <input type="checkbox" disabled={locked} checked={a.offers.includes(o.key)} onChange={(e) => patchAudience(a.role, { offers: e.target.checked ? [...a.offers, o.key] : a.offers.filter((x) => x !== o.key) })} />
                      {o.label}
                    </label>
                  ))}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11.5px] text-slate-500">Subject and opening line</summary>
                  <input disabled={locked} value={a.subject ?? ""} onChange={(e) => patchAudience(a.role, { subject: e.target.value })} placeholder="Leave blank to lead with the live number" className="mt-1.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12.5px]" />
                  <textarea disabled={locked} value={a.intro ?? ""} onChange={(e) => patchAudience(a.role, { intro: e.target.value })} rows={2} placeholder="You're invited. Here's who is already coming." className="mt-1.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12.5px]" />
                </details>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy || !draft.eventIds.length} onClick={() => act("preview", a.role)} className="rounded-md border border-slate-300 px-2.5 py-1 text-[12px]">Preview</button>
                  <button type="button" disabled={busy || !draft.eventIds.length} onClick={() => act("test", a.role)} className="rounded-md border border-slate-300 px-2.5 py-1 text-[12px]">Send test to me</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {preview ? (
        <section className="mt-5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-[12.5px]">
            <span className="text-slate-500">{ROLE_LABEL[preview.role]} · Subject:</span><span className="font-medium text-slate-900">{preview.subject}</span>
            <button type="button" onClick={() => setPreview(null)} className="ml-auto text-slate-500" aria-label="Close preview"><i className="ti ti-x" aria-hidden="true" /></button>
          </div>
          <iframe title="Email preview" srcDoc={preview.html} className="h-[560px] w-full bg-white" sandbox="" />
        </section>
      ) : null}

      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-medium text-slate-500">Live numbers in the emails and on the registration page</p>
          <select value={draft.stats.per} onChange={(e) => setDraft({ ...draft, stats: { ...draft.stats, per: e.target.value as StatSettings["per"] } })} className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-[12.5px]">
            <option value="combined">All chosen events combined</option>
            <option value="event">The next event only</option>
          </select>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead><tr className="text-left text-[11px] text-slate-500"><th className="px-2 py-1.5 font-medium">Show</th><th className="px-2 py-1.5 font-medium">Number</th><th className="px-2 py-1.5 font-medium">Counted from</th><th className="px-2 py-1.5 font-medium">Minimum to show</th><th className="px-2 py-1.5 font-medium">Today</th></tr></thead>
            <tbody>
              {STAT_KEYS.map((k) => (
                <tr key={k} className="border-t border-slate-200">
                  <td className="px-2 py-1.5"><input type="checkbox" checked={draft.stats.items[k].show} onChange={(e) => setDraft({ ...draft, stats: { ...draft.stats, items: { ...draft.stats.items, [k]: { ...draft.stats.items[k], show: e.target.checked } } } })} /></td>
                  <td className="px-2 py-1.5 text-slate-900">{STAT_LABEL[k]}</td>
                  <td className="px-2 py-1.5 text-slate-500">{STAT_SOURCE[k]}</td>
                  <td className="px-2 py-1.5"><input type="number" min={0} value={draft.stats.items[k].min} onChange={(e) => setDraft({ ...draft, stats: { ...draft.stats, items: { ...draft.stats.items, [k]: { ...draft.stats.items[k], min: Math.max(0, Number(e.target.value) || 0) } } } })} className="w-16 rounded-md border border-slate-300 px-1.5 py-0.5" /></td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-700">{todayFor(k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11.5px] text-slate-500">Below its minimum a number shows a label such as &ldquo;Booking now&rdquo; instead. Counts refresh every 5 minutes.</p>
      </section>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        {draft.status === "draft" ? <button type="button" disabled={busy} onClick={remove} className="mr-auto rounded-md px-3 py-1.5 text-[13px] text-rose-700">Delete draft</button> : null}
        <button type="button" disabled={busy} onClick={saveOnly} className="rounded-md border border-slate-300 px-3 py-1.5 text-[13px]">Save</button>
        {draft.status === "scheduled" || draft.status === "sending" ? <button type="button" disabled={busy} onClick={() => act("pause")} className="rounded-md border border-slate-300 px-3 py-1.5 text-[13px]">Pause</button> : null}
        {draft.status === "paused" ? <button type="button" disabled={busy} onClick={() => act("resume")} className="rounded-md bg-[#2E78F5] px-3 py-1.5 text-[13px] font-semibold text-white">Resume</button> : null}
        {draft.status === "draft" ? <button type="button" disabled={busy} onClick={() => act("schedule")} className="rounded-md bg-[#2E78F5] px-3 py-1.5 text-[13px] font-semibold text-white">{draft.when === "now" ? "Send now" : "Schedule"}</button> : null}
      </div>
    </div>
  );
}
