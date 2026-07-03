"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, MessageSquare, CalendarClock, StickyNote, ArrowDownLeft, ArrowUpRight, Loader2, Plus } from "lucide-react";

const BLUE = "#2E78F5";

type Channel = "voice" | "sms" | "whatsapp" | "email" | "note" | "meeting";
type Entry = { id: string; channel: Channel; direction: "outbound" | "inbound"; summary: string | null; occurredAt: string };

const ICON: Record<Channel, typeof Phone> = { voice: Phone, sms: MessageSquare, whatsapp: MessageSquare, email: Mail, meeting: CalendarClock, note: StickyNote };
const LABEL: Record<Channel, string> = { voice: "Call", sms: "Text", whatsapp: "WhatsApp", email: "Email", meeting: "Meeting", note: "Note" };

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ActivityLog({ externalId }: { externalId: string }) {
  const [items, setItems] = useState<Entry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("voice");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/crm/contacts/${encodeURIComponent(externalId)}/activity`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setItems(json.activity ?? []);
    else setItems([]);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reactive activity load on contact change
    void load();
  }, [externalId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!summary.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/crm/contacts/${encodeURIComponent(externalId)}/activity`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, direction, summary: summary.trim() }),
      });
      if (res.ok) { setSummary(""); setOpen(false); await load(); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Activity</h2>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Plus className="h-3.5 w-3.5" /> Log activity
        </button>
      </div>

      {open && (
        <div className="mb-4 rounded-lg border border-slate-100 p-3">
          <div className="flex flex-wrap gap-2">
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none">
              {(["voice", "email", "sms", "meeting", "note"] as Channel[]).map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}
            </select>
            {channel !== "note" && (
              <select value={direction} onChange={(e) => setDirection(e.target.value as "outbound" | "inbound")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none">
                <option value="outbound">Outbound</option><option value="inbound">Inbound</option>
              </select>
            )}
          </div>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="What happened? e.g. Left voicemail; sent deck; agreed to meet Thursday." className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
            <button onClick={save} disabled={busy || !summary.trim()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </button>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading activity…</div>
      ) : items.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">No activity yet. Calls, emails, and manual entries appear here.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((e) => {
            const Icon = ICON[e.channel] ?? StickyNote;
            const Dir = e.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
            return (
              <li key={e.id} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100"><Icon className="h-3.5 w-3.5 text-slate-500" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800">{LABEL[e.channel]}</span>
                    {e.channel !== "note" && <Dir className="h-3 w-3 text-slate-400" />}
                    <span className="ml-auto text-[11px] text-slate-400">{rel(e.occurredAt)}</span>
                  </div>
                  {e.summary && <p className="mt-0.5 text-sm text-slate-600">{e.summary}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
