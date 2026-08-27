"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Megaphone, ShieldCheck, Users, X } from "lucide-react";
import type { VoiceCampaign, CampaignStatus, AudienceConfig, AudienceSource } from "@/lib/voice/types";

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

            <AudiencePicker campaign={selected} canWrite={canWrite} busy={busy}
              onSave={(cfg) => call(`/api/admin/voice/campaigns/${selected.id}`, { method: "POST", body: JSON.stringify({ action: "update", audienceConfig: cfg }) })}
            />

            <CadenceEditor campaign={selected} canWrite={canWrite} busy={busy}
              onSave={(steps) => call(`/api/admin/voice/campaigns/${selected.id}`, { method: "POST", body: JSON.stringify({ action: "update", cadenceSteps: steps }) })}
              onEnroll={() => call(`/api/admin/voice/campaigns/${selected.id}`, { method: "POST", body: JSON.stringify({ action: "enrollCadence" }) })}
            />

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

type ListOpt = { id: string; name: string; count: number };
type SegOpt = { kind: "module" | "status"; value: string; label: string; count: number };
type ContactHit = { externalId: string; name: string; email: string | null; company: string | null };

function AudiencePicker({ campaign, canWrite, busy, onSave }: {
  campaign: VoiceCampaign; canWrite: boolean; busy: boolean;
  onSave: (cfg: AudienceConfig) => Promise<boolean> | void;
}) {
  const cfg = campaign.audienceConfig;
  const [source, setSource] = useState<AudienceSource>(cfg?.source ?? "all");
  const [listId, setListId] = useState(cfg?.listId ?? "");
  const [segment, setSegment] = useState(cfg?.segmentKind && cfg?.segmentValue ? `${cfg.segmentKind}:${cfg.segmentValue}` : "");
  const [picked, setPicked] = useState<ContactHit[]>([]);
  const [lists, setLists] = useState<ListOpt[]>([]);
  const [segs, setSegs] = useState<SegOpt[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContactHit[]>([]);

  // Reset local state when switching campaigns.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form to the selected campaign
    setSource(campaign.audienceConfig?.source ?? "all");
    setListId(campaign.audienceConfig?.listId ?? "");
    setSegment(campaign.audienceConfig?.segmentKind && campaign.audienceConfig?.segmentValue ? `${campaign.audienceConfig.segmentKind}:${campaign.audienceConfig.segmentValue}` : "");
    setPicked([]);
  }, [campaign.id, campaign.audienceConfig]);

  useEffect(() => {
    if (source === "list" && lists.length === 0) {
      void fetch("/api/marketing/lists").then((r) => r.json()).then((d) => setLists((Array.isArray(d) ? d : []).map((l: { id: string; name: string; contact_count?: number }) => ({ id: l.id, name: l.name, count: l.contact_count ?? 0 })))).catch(() => {});
    }
    if (source === "segment" && segs.length === 0) {
      void fetch("/api/admin/voice/segments").then((r) => r.json()).then((d) => setSegs(d.segments ?? [])).catch(() => {});
    }
  }, [source, lists.length, segs.length]);

  useEffect(() => {
    if (source !== "contacts") return;
    const q = query.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear results when query empties
    if (q.length < 1) { setHits([]); return; }
    const t = setTimeout(() => {
      void fetch(`/api/admin/voice/contacts/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => setHits(d.contacts ?? [])).catch(() => {});
    }, 220);
    return () => clearTimeout(t);
  }, [query, source]);

  function buildConfig(): AudienceConfig {
    if (source === "all") return { source: "all" };
    if (source === "list") { const l = lists.find((x) => x.id === listId); return { source: "list", listId: listId || null, listName: l?.name ?? null }; }
    if (source === "segment") { const [kind, ...rest] = segment.split(":"); return { source: "segment", segmentKind: kind === "status" ? "status" : "module", segmentValue: rest.join(":") }; }
    return { source: "contacts", contactIds: picked.map((p) => p.externalId) };
  }

  const summary = cfg?.source === "list" ? `Marketing list: ${cfg.listName ?? cfg.listId}` : cfg?.source === "segment" ? `Segment: ${cfg.segmentValue}` : cfg?.source === "contacts" ? `${cfg.contactIds?.length ?? 0} selected contacts` : "All eligible contacts";
  const savedCount = cfg?.contactIds?.length ?? null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Audience</h3>
        <span className="ml-auto text-[11px] text-slate-500">{summary}{cfg && cfg.source !== "all" && savedCount !== null ? ` · ${savedCount.toLocaleString()} unique contact${savedCount === 1 ? "" : "s"} to dial` : ""}</span>
      </div>

      {!canWrite ? (
        <p className="text-sm text-slate-500">{summary}</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {(["all", "list", "segment", "contacts"] as AudienceSource[]).map((s) => (
              <button key={s} type="button" onClick={() => setSource(s)} className={`rounded-lg border px-2 py-1.5 text-[12px] font-medium capitalize ${source === s ? "border-transparent text-white" : "border-slate-200 text-slate-600"}`} style={source === s ? { background: NAVY } : undefined}>
                {s === "all" ? "All eligible" : s === "list" ? "Marketing list" : s === "segment" ? "CRM segment" : "Contacts"}
              </button>
            ))}
          </div>

          {source === "list" && (
            <select value={listId} onChange={(e) => setListId(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none">
              <option value="">Select a Marketing Hub list…</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.count.toLocaleString()} contacts</option>)}
            </select>
          )}
          {source === "segment" && (
            <select value={segment} onChange={(e) => setSegment(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none">
              <option value="">Select a segment…</option>
              {segs.map((s) => <option key={`${s.kind}:${s.value}`} value={`${s.kind}:${s.value}`}>{s.label} · {s.count.toLocaleString()}</option>)}
            </select>
          )}
          {source === "contacts" && (
            <div className="mb-3">
              {picked.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {picked.map((p) => (
                    <span key={p.externalId} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                      {p.name}
                      <button type="button" onClick={() => setPicked((prev) => prev.filter((x) => x.externalId !== p.externalId))} aria-label="Remove"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts by name, email, company…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
                {hits.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {hits.filter((h) => !picked.some((p) => p.externalId === h.externalId)).map((h) => (
                      <li key={h.externalId}>
                        <button type="button" onClick={() => { setPicked((prev) => [...prev, h]); setQuery(""); setHits([]); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50">
                          <span className="text-slate-800">{h.name}</span>
                          {h.company && <span className="text-xs text-slate-400">{h.company}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void onSave(buildConfig())} disabled={busy || (source === "list" && !listId) || (source === "segment" && !segment) || (source === "contacts" && picked.length === 0)} className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
              {busy ? "Saving…" : "Save audience"}
            </button>
            <span className="text-[11px] text-slate-400">Every contact still clears the pre-dial gate — this only narrows who is in scope.</span>
          </div>
        </>
      )}
    </div>
  );
}

type Step = { channel: "voice" | "sms" | "whatsapp" | "email"; delayHours: number; body?: string | null };
const CH_LABEL: Record<Step["channel"], string> = { voice: "Voice call", sms: "SMS", whatsapp: "WhatsApp", email: "Email (Marketing Hub)" };
// Channels the cadence engine actually sends. Email is intentionally excluded:
// it's handled by the Marketing Hub, so a cadence "email" step sends nothing here.
const CADENCE_CHANNELS: Step["channel"][] = ["voice", "sms", "whatsapp"];

function CadenceEditor({ campaign, canWrite, busy, onSave, onEnroll }: {
  campaign: VoiceCampaign; canWrite: boolean; busy: boolean;
  onSave: (steps: Step[]) => Promise<boolean> | void;
  onEnroll: () => Promise<boolean> | void;
}) {
  const [steps, setSteps] = useState<Step[]>((campaign.cadenceSteps as Step[]) ?? []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync editor to the selected campaign
  useEffect(() => { setSteps((campaign.cadenceSteps as Step[]) ?? []); }, [campaign.id, campaign.cadenceSteps]);

  const setStep = (i: number, patch: Partial<Step>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addStep = () => setSteps((prev) => [...prev, { channel: prev.length === 0 ? "voice" : "sms", delayHours: prev.length === 0 ? 0 : 48, body: "" }]);
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, j) => j !== i));
  const useRecommended = () => setSteps([
    { channel: "voice", delayHours: 0, body: "" },
    { channel: "sms", delayHours: 48, body: "" },
    { channel: "whatsapp", delayHours: 72, body: "" },
  ]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cadence</h3>
        <span className="ml-auto text-[11px] text-slate-400">Voice / SMS / WhatsApp / Email over time · each step still passes its gate</span>
      </div>

      {steps.length === 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-400">No steps yet. Add a first touch (usually a voice call at 0h).</p>
          {canWrite && (
            <button type="button" onClick={useRecommended} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Use recommended · Voice 0h → SMS 48h → WhatsApp 72h
            </button>
          )}
        </div>
      )}
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="rounded-lg border border-slate-100 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Step {i + 1}</span>
              {canWrite ? (
                <>
                  <select value={s.channel} onChange={(e) => setStep(i, { channel: e.target.value as Step["channel"] })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
                    {CADENCE_CHANNELS.map((c) => <option key={c} value={c}>{CH_LABEL[c]}</option>)}
                    {s.channel === "email" && <option value="email">{CH_LABEL.email}</option>}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-slate-500">wait <input type="number" min={0} value={s.delayHours} onChange={(e) => setStep(i, { delayHours: Math.max(0, Number(e.target.value) || 0) })} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm" /> h</label>
                  <button type="button" onClick={() => removeStep(i)} aria-label="Remove step" className="ml-auto text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </>
              ) : (
                <span className="text-sm text-slate-600">{CH_LABEL[s.channel]} · wait {s.delayHours}h</span>
              )}
            </div>
            {canWrite && (s.channel === "sms" || s.channel === "whatsapp") && (
              <input value={s.body ?? ""} onChange={(e) => setStep(i, { body: e.target.value })} placeholder="Message text (STOP opt-out appended by carrier)…" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            )}
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={addStep} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> Add step</button>
          <button type="button" onClick={() => void onSave(steps)} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>{busy ? "Saving…" : "Save cadence"}</button>
          <button type="button" onClick={() => void onEnroll()} disabled={busy || steps.length === 0} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Enroll audience</button>
          <span className="text-[11px] text-slate-400">Enrolling starts the sequence for the campaign&rsquo;s audience.</span>
        </div>
      )}
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
