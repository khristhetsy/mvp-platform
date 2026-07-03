"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Megaphone, ShieldCheck } from "lucide-react";
import type { VoiceCampaign, CampaignStatus } from "@/lib/voice/types";

const BLUE = "#2E78F5";
const NAVY = "#0A1A40";
const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "archived"];

export function CampaignsManager({ initial, canWrite, guardrailVersion }: { initial: VoiceCampaign[]; canWrite: boolean; guardrailVersion: string }) {
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  async function refresh() {
    const res = await fetch("/api/admin/voice/campaigns");
    const json = await res.json();
    if (res.ok) setCampaigns(json.campaigns ?? []);
  }

  async function call(url: string, opts: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Request failed.");
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        {/* Campaign list */}
        <div className="space-y-3">
          {canWrite && <NewCampaign onCreate={(name, audience) => call("/api/admin/voice/campaigns", { method: "POST", body: JSON.stringify({ name, audience }) })} busy={busy} />}
          <div className="rounded-xl border border-slate-200 bg-white">
            {campaigns.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No campaigns yet.</p>
            ) : campaigns.map((c) => (
              <button key={c.id} onClick={() => setSelectedId(c.id)} className={`flex w-full items-center justify-between gap-2 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50 ${c.id === selectedId ? "bg-[var(--blue-muted)]" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium" style={{ color: NAVY }}>{c.name}</span>
                  <span className="text-[11px] capitalize text-slate-400">{c.audience} · {c.variants.length} variant{c.variants.length === 1 ? "" : "s"}</span>
                </span>
                <StatusPill status={c.status} />
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-semibold" style={{ color: NAVY }}>{selected.name}</h2>
                </div>
                {canWrite && (
                  <select value={selected.status} disabled={busy} onChange={(e) => call(`/api/admin/voice/campaigns/${selected.id}`, { method: "POST", body: JSON.stringify({ action: "update", status: e.target.value }) })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm capitalize focus:outline-none">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#0F6E56" }} />
                Guardrail prompt {selected.guardrailPromptVersion ?? guardrailVersion} · the AI disclosure auto-prepends to every opener · scripts are lexicon-checked on save.
              </p>
            </div>

            <VariantEditor campaign={selected} canWrite={canWrite} busy={busy}
              onAdd={(label, script, weight) => call(`/api/admin/voice/campaigns/${selected.id}`, { method: "POST", body: JSON.stringify({ action: "addVariant", label, openerScript: script, trafficWeight: weight }) })}
              onSave={(vid, patch) => call(`/api/admin/voice/variants/${vid}`, { method: "PATCH", body: JSON.stringify(patch) })}
              onDelete={(vid) => call(`/api/admin/voice/variants/${vid}`, { method: "DELETE" })}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">Select or create a campaign.</div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: CampaignStatus }) {
  const tone = status === "active" ? "bg-emerald-50 text-emerald-700" : status === "paused" ? "bg-amber-50 text-amber-700" : status === "archived" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${tone}`}>{status}</span>;
}

function NewCampaign({ onCreate, busy }: { onCreate: (name: string, audience: string) => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("founder");
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">New campaign</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
      <div className="flex gap-2">
        <select value={audience} onChange={(e) => setAudience(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none">
          <option value="founder">Founders</option>
          <option value="investor">Investors</option>
        </select>
        <button onClick={() => { if (name.trim()) { onCreate(name.trim(), audience); setName(""); } }} disabled={busy || !name.trim()} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function VariantEditor({ campaign, canWrite, busy, onAdd, onSave, onDelete }: {
  campaign: VoiceCampaign; canWrite: boolean; busy: boolean;
  onAdd: (label: string, script: string, weight: number) => void;
  onSave: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [script, setScript] = useState("");
  const [weight, setWeight] = useState(100);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">A/B variants</h3>
      <div className="space-y-3">
        {campaign.variants.length === 0 && <p className="text-sm text-slate-400">No variants yet. Add one to define an opener + traffic split.</p>}
        {campaign.variants.map((v) => (
          <div key={v.id} className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{v.label} · {v.trafficWeight}%</span>
              {canWrite && <button onClick={() => onDelete(v.id)} disabled={busy} aria-label="Delete variant" className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
            </div>
            {canWrite ? (
              <textarea defaultValue={v.openerScript ?? ""} onBlur={(e) => { if (e.target.value !== (v.openerScript ?? "")) onSave(v.id, { openerScript: e.target.value }); }} rows={3} placeholder="Opener script (the AI disclosure is added automatically)…" className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{v.openerScript ?? "—"}</p>
            )}
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-3">
          <div className="flex gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (A)" className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
            <input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none" />
            <span className="self-center text-xs text-slate-400">% traffic</span>
          </div>
          <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={3} placeholder="Opener script…" className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
          <button onClick={() => { if (label.trim()) { onAdd(label.trim(), script, weight); setLabel(""); setScript(""); setWeight(100); } }} disabled={busy || !label.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
            <Plus className="h-4 w-4" /> Add variant
          </button>
        </div>
      )}
    </div>
  );
}
