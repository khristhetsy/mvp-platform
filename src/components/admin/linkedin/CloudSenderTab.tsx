"use client";

import { useCallback, useEffect, useState } from "react";
import type { CloudAccount, CloudCampaign, CloudLead } from "@/lib/linkedin/cloud-sender";
import { ErrorLine, api, btnCls, inputCls, primaryCls } from "@/components/admin/accounting/ui";
import { Section, Tag } from "@/components/admin/investor-directory/ui";

type Overview = { configured: boolean; connected: boolean; accounts: CloudAccount[]; campaigns: CloudCampaign[]; error: string | null };

const STATUS: Record<CloudCampaign["status"], { label: string; tone: "ok" | "warn" | "mute" | "bad" }> = {
  dry_run: { label: "Dry run", tone: "warn" },
  running: { label: "Running", tone: "ok" },
  paused: { label: "Paused", tone: "mute" },
  archived: { label: "Archived", tone: "mute" },
};
const LEAD_STATE: Record<string, { label: string; tone: "ok" | "warn" | "mute" | "bad" }> = {
  new: { label: "New", tone: "mute" },
  in_progress: { label: "In progress", tone: "mute" },
  invite_pending: { label: "Invite pending", tone: "warn" },
  connected: { label: "Connected", tone: "ok" },
  replied: { label: "Replied", tone: "ok" },
  done: { label: "Done", tone: "mute" },
  failed: { label: "Failed", tone: "bad" },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const slug = (url: string) => url.replace(/^https?:\/\/(www\.)?linkedin\.com/, "");

/** Admin › LinkedIn: the separate cloud sender service, seen from iCapOS. */
export function CloudSenderTab() {
  const [data, setData] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [leads, setLeads] = useState<CloudLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [urls, setUrls] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    api<Overview>("/api/admin/linkedin/cloud").then((r) => {
      if (!alive) return;
      if (r.ok) { setData(r.data); setError(null); setSelected((cur) => cur ?? r.data.campaigns[0]?.id ?? null); } else setError(r.error);
    });
    return () => { alive = false; };
  }, [tick]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    api<{ leads: CloudLead[] }>(`/api/admin/linkedin/cloud/campaigns/${selected}/leads`).then((r) => {
      if (!alive) return;
      if (r.ok) setLeads(r.data.leads); else setError(r.error);
    });
    return () => { alive = false; };
  }, [selected, tick]);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true); setMessage(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) { setError(null); reload(); } else setError(r.error);
  }

  const changeStatus = (c: CloudCampaign, status: "dry_run" | "running" | "paused") => {
    if (status === "running" && !window.confirm(`Go live with "${c.name}"? The sender will send real LinkedIn invites to its leads.`)) return;
    void run(() => api(`/api/admin/linkedin/cloud/campaigns/${c.id}/status`, "POST", { status, confirm: status === "running" ? true : undefined }));
  };

  if (!data) return <>{error ? <ErrorLine text={error} /> : <p className="text-[13px] text-slate-500">Loading…</p>}</>;

  if (!data.configured) {
    return (
      <Section title="Cloud sender">
        <p className="text-[13px] text-slate-600">The cloud sender is not set up. Add <code>CLOUD_SENDER_URL</code> and <code>CLOUD_SENDER_TOKEN</code> to the server settings, then reload.</p>
      </Section>
    );
  }

  const selectedCampaign = data.campaigns.find((c) => c.id === selected) ?? null;
  const first = data.accounts[0];
  const shownLeads = selected ? leads : [];

  return (
    <div className="space-y-4">
      <ErrorLine text={error} />
      <Section title="Connection">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <span>
            <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${data.connected ? "bg-green-600" : "bg-red-500"}`} />
            {data.connected ? "Connected to the sender" : (data.error ?? "Not connected")}
            {data.connected ? <span className="text-slate-500"> · {data.accounts.length} account{data.accounts.length === 1 ? "" : "s"}{first ? ` · ${first.invites_today} invite${first.invites_today === 1 ? "" : "s"} today${first.invites_per_day ? ` of ${first.invites_per_day}` : ""}` : ""}</span> : null}
          </span>
          <button type="button" className={btnCls} onClick={reload}>Check again</button>
        </div>
      </Section>

      <Section title="Campaigns on the sender">
        <div className="mb-3 flex justify-end">
          <button type="button" className={primaryCls} onClick={() => setCreating((v) => !v)}>New campaign</button>
        </div>
        {creating ? (
          <form className="mb-4 space-y-2 rounded-xl border border-slate-200 p-3" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await api<{ id: string }>("/api/admin/linkedin/cloud/campaigns", "POST", { name, note: note.trim() || undefined });
              if (r.ok) { setName(""); setNote(""); setCreating(false); setSelected(r.data.id); setMessage("Created as a dry run. Nothing is sent until you go live."); return { ok: true as const }; }
              return r;
            });
          }}>
            <input className={inputCls} placeholder="Campaign name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label="Campaign name" required />
            <textarea className={inputCls} placeholder="Invite note (optional, 300 characters)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} aria-label="Invite note" />
            <button type="submit" className={primaryCls} disabled={busy || !name.trim()}>Create as dry run</button>
          </form>
        ) : null}
        {message ? <p className="mb-3 text-[12.5px] text-slate-600">{message}</p> : null}
        {data.campaigns.length === 0 ? <p className="text-[13px] text-slate-500">No campaigns on the sender yet.</p> : (
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-slate-500"><th className="py-2 font-medium">Name</th><th className="font-medium">Status</th><th className="font-medium">Leads</th><th className="font-medium">Accepted</th><th className="font-medium">Replies</th><th /></tr></thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id} className={`cursor-pointer border-t border-slate-100 ${c.id === selected ? "bg-[#EEF4FF]" : ""}`} onClick={() => setSelected(c.id)}>
                  <td className="py-2.5">{c.name}</td>
                  <td><Tag tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Tag></td>
                  <td>{c.leads}</td><td>{c.accepted}</td><td>{c.replies}</td>
                  <td className="text-right">
                    {c.status === "running" ? <button type="button" className={btnCls} disabled={busy} onClick={(e) => { e.stopPropagation(); changeStatus(c, "paused"); }}>Pause</button>
                      : <button type="button" className={btnCls} disabled={busy} onClick={(e) => { e.stopPropagation(); changeStatus(c, "running"); }}>Go live</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">New campaigns always start as a dry run. Going live asks you to confirm first.</p>
      </Section>

      {selectedCampaign ? (
        <Section title={`Leads in "${selectedCampaign.name}"`}>
          {shownLeads.length === 0 ? <p className="text-[13px] text-slate-500">No leads yet.</p> : (
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-slate-500"><th className="py-2 font-medium">Contact</th><th className="font-medium">LinkedIn</th><th className="font-medium">State</th><th className="font-medium">Invited</th><th className="font-medium">Accepted</th><th className="font-medium">Replied</th></tr></thead>
              <tbody>
                {shownLeads.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="py-2.5">{l.full_name ?? "—"}</td>
                    <td className="text-slate-600">{slug(l.profile_url)}</td>
                    <td><Tag tone={(LEAD_STATE[l.state] ?? LEAD_STATE.new!).tone}>{(LEAD_STATE[l.state] ?? { label: l.state }).label}</Tag></td>
                    <td>{when(l.invited_at)}</td><td>{when(l.accepted_at)}</td><td>{when(l.replied_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mb-2 mt-4 text-[12.5px] text-slate-500">Add leads, one LinkedIn profile link per line.</p>
          <textarea className={inputCls} rows={3} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://www.linkedin.com/in/..." aria-label="LinkedIn profile links" />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" className={primaryCls} disabled={busy || !urls.trim()} onClick={() => void run(async () => {
              const list = urls.split(/\s+/).filter(Boolean);
              const r = await api<{ added: number; skipped: string[] }>(`/api/admin/linkedin/cloud/campaigns/${selectedCampaign.id}/leads`, "POST", { urls: list });
              if (!r.ok) return r;
              setUrls("");
              setMessage(`Added ${r.data.added}${r.data.skipped.length ? `, skipped ${r.data.skipped.length} (not a profile link or already there)` : ""}.`);
              return { ok: true as const };
            })}>Add leads</button>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
