"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AgentChat } from "@/components/ir-agent/AgentChat";
import { useToast } from "@/components/ui/ToastProvider";
import { AGENT_TYPES, AGENT_TYPE_SPECS, DEFAULT_AGENT_TYPE, type AgentType } from "@/lib/ir-agent/agent-types";
import { COMPLIANCE_NOTICE, FIELD_LABELS, type QuestionField } from "@/lib/ir-agent/defaults";
import { AGENT_HOST, CHANNELS, CHANNEL_LABELS, agentUrl, normalizeEnding, trackedUrl, type Channel } from "@/lib/ir-agent/slug";
import type { AgentContactField, AgentPublicConfig, AgentQuestion, AgentRow, TaughtAnswer } from "@/lib/ir-agent/types";
import type { WiredData } from "@/lib/ir-agent/wired";

type Source = { id: string; file_name: string; bytes: number; status: "processing" | "trained" | "failed"; created_at: string };
type Conversation = {
  id: string;
  session_id: string;
  source: string | null;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  profile: Record<string, unknown>;
  contact: Record<string, string>;
  review_state: "new" | "needs_review" | "approved";
  booked_at: string | null;
  stopped: boolean;
  created_at: string;
  updated_at: string;
};
type Loaded = {
  agent: AgentRow;
  questions: AgentQuestion[];
  contactFields: AgentContactField[];
  answers: TaughtAnswer[];
  sources: Source[];
  config: AgentPublicConfig;
  booking: { ready: boolean; googleConnected: boolean; hostId: string };
  demo: boolean;
  wired?: WiredData;
};
type Tab = "build" | "train" | "share" | "conversations";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "build", label: "Build" },
  { id: "train", label: "Train" },
  { id: "share", label: "Share" },
  { id: "conversations", label: "Conversations" },
];

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1A6CE4] focus:ring-2 focus:ring-[#1A6CE4]/20";
const btnPrimary = "rounded-lg bg-[#1A6CE4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50";
const btnQuiet = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const card = "rounded-xl border border-slate-200 bg-white p-5";

type AgentApi = (path?: string, params?: Record<string, string>) => string;

/** Builds the agent API url. With an orgId the same routes serve an admin building for that company. */
function makeApi(orgId?: string): AgentApi {
  return (path = "", params = {}) => {
    const sp = new URLSearchParams(params);
    if (orgId) sp.set("orgId", orgId);
    const qs = sp.toString();
    return `/api/founder/ir-agent${path}${qs ? `?${qs}` : ""}`;
  };
}

const AgentApiContext = createContext<{ api: AgentApi; admin: boolean }>({ api: makeApi(), admin: false });

async function readJson<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string };
}

export function IrAgentStudio({ orgId }: { orgId?: string } = {}) {
  const { toast } = useToast();
  const api = useMemo(() => makeApi(orgId), [orgId]);
  const ctxValue = useMemo(() => ({ api, admin: Boolean(orgId) }), [api, orgId]);
  const [data, setData] = useState<Loaded | null>(null);
  const [tab, setTab] = useState<Tab>("build");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(api(), { cache: "no-store" });
    const j = await readJson<Loaded>(res);
    if (!res.ok) {
      setError(j.error ?? "Could not load your agent.");
      return;
    }
    setData(j);
  }, [api]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch(api(), { cache: "no-store" });
      const j = await readJson<Loaded>(res);
      if (!active) return;
      if (!res.ok) setError(j.error ?? "Could not load your agent.");
      else setData(j);
    })();
    return () => {
      active = false;
    };
  }, [api]);

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>;
  if (!data) return <div className="py-10 text-sm text-slate-500">Loading your agent…</div>;

  const live = data.agent.status === "live";

  return (
    <AgentApiContext.Provider value={ctxValue}>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Agent sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t.id ? "bg-white text-[#0A1A40] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-slate-400"}`} />
            {live ? "Live" : data.agent.status === "paused" ? "Paused" : "Draft"}
          </span>
          <a href={agentUrl(data.agent.company_slug, data.agent.ending)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#1A6CE4] underline">
            {agentUrl(data.agent.company_slug, data.agent.ending).replace("https://", "")}
          </a>
        </div>
      </div>

      {data.demo ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Demo account: conversations are recorded, but the agent never sends email or books a real meeting.
        </p>
      ) : null}

      {tab === "build" ? <BuildTab key={data.agent.agent_type ?? DEFAULT_AGENT_TYPE} data={data} onChange={setData} reload={load} toast={toast} /> : null}
      {tab === "train" ? <TrainTab data={data} onChange={setData} toast={toast} /> : null}
      {tab === "share" ? <ShareTab data={data} toast={toast} /> : null}
      {tab === "conversations" ? <ConversationsTab /> : null}
    </div>
    </AgentApiContext.Provider>
  );
}

/* ================================================================== Build */

function BuildTab({ data, onChange, reload, toast }: { data: Loaded; onChange: (d: Loaded) => void; reload: () => Promise<void>; toast: ReturnType<typeof useToast>["toast"] }) {
  const { api, admin } = useContext(AgentApiContext);
  const a = data.agent;
  const [ending, setEnding] = useState(a.ending);
  const [endingState, setEndingState] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [displayName, setDisplayName] = useState(a.display_name);
  const [companyName, setCompanyName] = useState(a.company_name);
  const [welcome, setWelcome] = useState(a.welcome_message ?? "");
  const [about, setAbout] = useState(a.about ?? "");
  const [excluded, setExcluded] = useState<string[]>(a.wired_excluded ?? []);
  const [questions, setQuestions] = useState<Array<Pick<AgentQuestion, "field" | "prompt" | "options" | "enabled">>>(() =>
    data.questions.map(({ field, prompt, options, enabled }) => ({ field, prompt, options, enabled })),
  );
  const [contactFields, setContactFields] = useState<Array<Pick<AgentContactField, "key" | "label" | "kind" | "required" | "enabled">>>(() =>
    data.contactFields.map(({ key, label, kind, required, enabled }) => ({ key, label, kind, required, enabled })),
  );
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [ackChecked, setAckChecked] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const acknowledged = Boolean(a.compliance_acknowledged_at);
  const fileRef = useRef<HTMLInputElement>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Uploads happen in another module: pick up the change when the user comes back to this tab.
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const agentType: AgentType = a.agent_type ?? DEFAULT_AGENT_TYPE;
  const typeSpec = AGENT_TYPE_SPECS[agentType];

  const switchType = async (next: AgentType) => {
    if (next === agentType) return;
    const warn = `Switch to the ${AGENT_TYPE_SPECS[next].label} agent? Its question set, agent name and welcome replace the current ones. Your address, photo, contact questions and Train answers stay.`;
    if (!window.confirm(warn)) return;
    setSwitching(true);
    try {
      const res = await fetch(api("/type"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_type: next }) });
      const j = await readJson<{ agent: AgentRow; questions: AgentQuestion[]; config: AgentPublicConfig }>(res);
      if (!res.ok) throw new Error(j.error ?? "Could not switch type.");
      await reload();
      toast({ title: `${AGENT_TYPE_SPECS[next].label} agent loaded`, description: "Its question set is ready to edit.", variant: "success" });
    } catch (e) {
      toast({ title: "Not switched", description: e instanceof Error ? e.message : "Could not switch type.", variant: "error" });
    } finally {
      setSwitching(false);
    }
  };

  const wiredFields = data.wired?.fields ?? [];
  const wiredOn = wiredFields.filter((f) => f.present && !excluded.includes(f.key));
  const wiredMissing = wiredFields.filter((f) => !f.present).length;
  const profileHref = admin ? (data.wired?.companyId ? `/admin/companies/${data.wired.companyId}` : "/admin/companies") : "/founder/settings";
  const toggleWired = (key: string) => setExcluded((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const setAllWired = (on: boolean) => setExcluded(on ? [] : wiredFields.filter((f) => f.present).map((f) => f.key));

  const dirty =
    ending !== a.ending ||
    displayName !== a.display_name ||
    companyName !== a.company_name ||
    welcome !== (a.welcome_message ?? "") ||
    about !== (a.about ?? "") ||
    JSON.stringify([...excluded].sort()) !== JSON.stringify([...(a.wired_excluded ?? [])].sort()) ||
    JSON.stringify(questions) !== JSON.stringify(data.questions.map(({ field, prompt, options, enabled }) => ({ field, prompt, options, enabled }))) ||
    JSON.stringify(contactFields) !== JSON.stringify(data.contactFields.map(({ key, label, kind, required, enabled }) => ({ key, label, kind, required, enabled })));

  const onEnding = (raw: string) => {
    const e = normalizeEnding(raw);
    setEnding(e);
    setEndingState(null);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (e === a.ending) return;
    checkTimer.current = setTimeout(async () => {
      const res = await fetch(api("/ending", { ending: e }));
      const j = await readJson<{ ok: boolean; reason?: string }>(res);
      setEndingState({ ok: Boolean(j.ok), reason: j.reason });
    }, 400);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(api(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ending, display_name: displayName, company_name: companyName, welcome_message: welcome, about, wired_excluded: excluded }),
      });
      const j = await readJson<{ agent: AgentRow }>(res);
      if (!res.ok) throw new Error(j.error ?? "Could not save.");
      const q = await fetch(api("/questions"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions }) });
      const qj = await readJson<{ questions: AgentQuestion[] }>(q);
      if (!q.ok) throw new Error(qj.error ?? "Could not save questions.");
      const c = await fetch(api("/contact-fields"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: contactFields }) });
      const cj = await readJson<{ contactFields: AgentContactField[] }>(c);
      if (!c.ok) throw new Error(cj.error ?? "Could not save contact questions.");
      setQuestions(qj.questions.map(({ field, prompt, options, enabled }) => ({ field, prompt, options, enabled })));
      setContactFields(cj.contactFields.map(({ key, label, kind, required, enabled }) => ({ key, label, kind, required, enabled })));
      await reload();
      setPreviewKey((k) => k + 1);
      toast({ title: "Saved", description: "Your agent is updated. The preview restarted.", variant: "success" });
    } catch (e) {
      toast({ title: "Not saved", description: e instanceof Error ? e.message : "Could not save.", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: "live" | "paused") => {
    const body: Record<string, unknown> = { status };
    if (status === "live" && !acknowledged) {
      if (!ackChecked) {
        toast({ title: "Confirm the compliance notice first", variant: "error" });
        return;
      }
      body.compliance_acknowledged = true;
    }
    const res = await fetch(api(), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await readJson<{ agent: AgentRow; config: AgentPublicConfig }>(res);
    if (!res.ok) {
      toast({ title: "Could not change status", description: j.error, variant: "error" });
      return;
    }
    onChange({ ...data, agent: j.agent, config: j.config });
    toast({ title: status === "live" ? "Your agent is live" : "Your agent is paused", variant: "success" });
  };

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(api("/image"), { method: "POST", body: fd });
    const j = await readJson<{ image_url: string }>(res);
    if (!res.ok) {
      toast({ title: "Image not uploaded", description: j.error, variant: "error" });
      return;
    }
    await reload();
    setPreviewKey((k) => k + 1);
  };

  // Questions helpers
  const moveQ = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next);
  };
  const updateQ = (i: number, patch: Partial<(typeof questions)[number]>) => setQuestions(questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const removeQ = (i: number) => setQuestions(questions.filter((_, k) => k !== i));
  const addCustom = () => setQuestions([...questions, { field: "custom", prompt: "", options: [], enabled: true }]);
  const missingDefaults = (agentType !== "founder" ? [] : ["investor_type", "preferred_sectors", "check_size", "preferred_stages", "capital_types"] as QuestionField[]).filter((f) => !questions.some((q) => q.field === f));
  const restoreDefault = (f: QuestionField) => {
    const d = data.config.questions.find((q) => q.field === f);
    setQuestions([...questions, { field: f, prompt: d?.prompt ?? FIELD_LABELS[f], options: d?.options ?? [], enabled: true }]);
  };

  const updateC = (i: number, patch: Partial<(typeof contactFields)[number]>) => setContactFields(contactFields.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const moveC = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= contactFields.length) return;
    const next = [...contactFields];
    [next[i], next[j]] = [next[j], next[i]];
    setContactFields(next);
  };
  const addContact = () => setContactFields([...contactFields, { key: `field_${contactFields.length + 1}`, label: "", kind: "short_text", required: false, enabled: true }]);
  const removeC = (i: number) => setContactFields(contactFields.filter((_, k) => k !== i));

  // Remount the preview only when the saved config really changes, not on every data reload.
  const previewSignature = JSON.stringify(data.config);
  const previewConfig = useMemo(() => JSON.parse(previewSignature) as AgentPublicConfig, [previewSignature]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_min(100%,520px)]">
      <div className="space-y-5">
        {/* AI Agent Type */}
        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">AI Agent Type</h2>
          <p className="mt-1 text-sm text-slate-600">Each type loads its own question set. Switching replaces the questions, agent name and welcome.</p>
          <div role="radiogroup" aria-label="AI Agent Type" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {AGENT_TYPES.map((t) => {
              const s = AGENT_TYPE_SPECS[t];
              const on = t === agentType;
              return (
                <label key={t} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${on ? "border-[#1A6CE4] bg-[#F4F8FF]" : "border-slate-300 bg-white hover:bg-slate-50"} ${switching ? "opacity-60" : ""}`}>
                  <input type="radio" name="agent-type" checked={on} disabled={switching} onChange={() => void switchType(t)} className="mt-1 h-4 w-4 accent-[#1A6CE4]" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{s.label}</span>
                    <span className="block text-xs text-slate-600">{s.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {/* Address */}
        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">Address</h2>
          <p className="mt-1 text-sm text-slate-600">The company part is yours and locked. You choose the ending.</p>
          <div className="mt-3 flex flex-wrap items-stretch overflow-hidden rounded-lg border border-slate-300 font-mono text-sm">
            <span className="flex items-center bg-slate-100 px-3 py-2 text-slate-600">{AGENT_HOST.replace("https://", "")}/{a.company_slug}/</span>
            <input
              aria-label="Address ending"
              value={ending}
              onChange={(e) => onEnding(e.target.value)}
              className="min-w-[120px] flex-1 px-3 py-2 text-slate-900 outline-none"
              maxLength={30}
            />
          </div>
          {endingState && ending !== a.ending ? (
            <p className={`mt-2 text-xs ${endingState.ok ? "text-emerald-700" : "text-red-700"}`}>{endingState.ok ? "Available" : endingState.reason}</p>
          ) : null}
        </section>

        {/* Branding */}
        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">Branding</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-[96px_1fr]">
            <div>
              {a.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt="" className="h-24 w-24 rounded-full border border-slate-200 object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0A1A40] text-xl font-semibold text-white">
                  {displayName
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} className={`${btnQuiet} mt-2 w-24`}>
                Upload
              </button>
              <p className="mt-1 text-[11px] text-slate-500">PNG, JPG or SVG. Under 2 MB.</p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Agent name</span>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} maxLength={60} placeholder={typeSpec.displayName} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Company name as the agent says it</span>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={input} maxLength={120} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Welcome, one line per message (up to 3)</span>
                <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} className={`${input} min-h-[72px]`} maxLength={600} />
                <span className="mt-1 block text-[11px] text-slate-500">{"{{name}} and {{company}} are replaced. The first question follows automatically. The time of day greeting is added for you."}</span>
              </label>
            </div>
          </div>
        </section>

        {/* Fact sheet */}
        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">What the agent knows</h2>
          <p className="mt-1 text-sm text-slate-600">
            Plain facts about the company, in your words. The agent answers only from this, from what you teach it in Train, and from your PDFs. No prices, percentages or promises: the agent will not say them, and the reply is checked on the server.
            {typeSpec.fromProfile ? " Add only what the Company profile does not already say: the selected profile fields are included automatically." : ""}
          </p>
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} className={`${input} mt-3 min-h-[140px]`} maxLength={6000} placeholder="What the company does, who it serves, where it is based, who leads it, what the round is for (without figures)…" />
        </section>

        {/* Questions */}
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{typeSpec.label} questions</h2>
              <p className="mt-1 text-sm text-slate-600">
                The {typeSpec.label} question set is loaded. Reword, reorder, turn off, or add your own. Visitors can tap or type.
                {typeSpec.fromProfile ? " Company details come from the Company profile (Selected fields below), so nobody enters them again." : ""}
              </p>
            </div>
            <button type="button" onClick={addCustom} className={btnQuiet}>
              Add question
            </button>
          </div>
          <ol className="mt-4 space-y-3">
            {questions.map((q, i) => (
              <li key={i} className={`rounded-lg border p-3 ${q.enabled ? "border-slate-200" : "border-dashed border-slate-200 opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-1">
                    <button type="button" aria-label="Move up" onClick={() => moveQ(i, -1)} className="text-slate-400 hover:text-slate-700" disabled={i === 0}>
                      ▲
                    </button>
                    <button type="button" aria-label="Move down" onClick={() => moveQ(i, 1)} className="text-slate-400 hover:text-slate-700" disabled={i === questions.length - 1}>
                      ▼
                    </button>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{FIELD_LABELS[q.field]}</span>
                      {q.field !== "custom" ? <span className="text-[11px] text-slate-500">Read into the investor profile</span> : null}
                    </div>
                    <input value={q.prompt} onChange={(e) => updateQ(i, { prompt: e.target.value })} className={input} maxLength={200} placeholder="How the agent asks it" />
                    <input
                      value={q.options.join(", ")}
                      onChange={(e) => updateQ(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12) })}
                      className={input}
                      placeholder="Tap options, comma separated (leave empty for type only)"
                    />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={q.enabled} onChange={(e) => updateQ(i, { enabled: e.target.checked })} /> On
                    </label>
                    <button type="button" onClick={() => removeQ(i)} className="text-xs text-slate-500 hover:text-red-700">
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {missingDefaults.length ? (
            <p className="mt-3 text-xs text-slate-500">
              Removed from Johnny&apos;s set:{" "}
              {missingDefaults.map((f) => (
                <button key={f} type="button" onClick={() => restoreDefault(f)} className="mr-2 underline">
                  restore {FIELD_LABELS[f]}
                </button>
              ))}
            </p>
          ) : null}
        </section>

        {/* Contact */}
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Contact questions</h2>
              <p className="mt-1 text-sm text-slate-600">Asked before the booking. Name and email are always required for the invitation.</p>
            </div>
            <button type="button" onClick={addContact} className={btnQuiet}>
              Add field
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {contactFields.map((c, i) => {
              const locked = c.key === "name" || c.key === "email";
              return (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
                  <div className="flex flex-col">
                    <button type="button" aria-label="Move up" onClick={() => moveC(i, -1)} className="text-slate-400 hover:text-slate-700" disabled={i === 0}>
                      ▲
                    </button>
                    <button type="button" aria-label="Move down" onClick={() => moveC(i, 1)} className="text-slate-400 hover:text-slate-700" disabled={i === contactFields.length - 1}>
                      ▼
                    </button>
                  </div>
                  <input value={c.label} onChange={(e) => updateC(i, { label: e.target.value })} className={`${input} max-w-[200px]`} maxLength={40} placeholder="Label" />
                  <select value={c.kind} onChange={(e) => updateC(i, { kind: e.target.value as "short_text" | "email" | "phone" })} className={`${input} max-w-[140px]`} disabled={locked}>
                    <option value="short_text">Short text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={c.required} disabled={locked} onChange={(e) => updateC(i, { required: e.target.checked })} /> Required
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={c.enabled} disabled={locked} onChange={(e) => updateC(i, { enabled: e.target.checked })} /> On
                  </label>
                  {!locked ? (
                    <button type="button" onClick={() => removeC(i)} className="ml-auto text-xs text-slate-500 hover:text-red-700">
                      Remove
                    </button>
                  ) : (
                    <span className="ml-auto text-[11px] text-slate-400">Locked</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Data wired from the company profile */}
        {data.wired ? (
          <section className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Selected fields</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Wired from {companyName}. {wiredOn.length} of {wiredFields.length} fields selected, {wiredMissing} missing. Untick a field to keep it out of the agent. The agent never states the raise amount, revenue figures or cap table.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAllWired(true)} className={btnQuiet}>
                  Select all
                </button>
                <button type="button" onClick={() => setAllWired(false)} className={btnQuiet}>
                  Deselect all
                </button>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {wiredFields.map((f) => {
                const on = f.present && !excluded.includes(f.key);
                return (
                  <li key={f.key} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm ${f.present ? "bg-white" : "bg-amber-50/60"}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!f.present}
                      onChange={() => toggleWired(f.key)}
                      aria-label={`${on ? "Deselect" : "Select"} ${f.label}`}
                      className="h-5 w-5 shrink-0 accent-[#1A6CE4]"
                    />
                    <div className="min-w-[150px] flex-1">
                      <p className="font-medium text-slate-900">{f.label}</p>
                      <p className="truncate text-xs text-slate-500">{f.present ? f.preview : f.source}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${!f.present ? "bg-amber-100 text-amber-800" : on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {!f.present ? "Missing" : on ? "Wired" : "Off"}
                    </span>
                    <a
                      href={profileHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={f.present ? btnQuiet : "rounded-lg border border-[#1A6CE4] bg-[#1A6CE4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2E78F5]"}
                    >
                      {f.present ? "Replace" : "Upload"} in Company profile ↗
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Upload and replace open the Company profile in a new tab. Come back to this tab and the list refreshes.</p>
          </section>
        ) : null}

        {/* Booking */}
        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">Booking</h2>
          {data.booking.ready ? (
            <p className="mt-1 text-sm text-emerald-700">Your hours are set. The agent offers real open times and books on your calendar{data.booking.googleConnected ? " with a Google Meet link" : ""}.</p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              No hours set yet, so the agent collects the investor&apos;s details and you set up the call yourself. Set your hours in{" "}
              <Link href="/founder/schedule" className="font-semibold text-[#1A6CE4] underline">
                Scheduling
              </Link>
              {data.booking.googleConnected ? "." : ", and connect Google Calendar in Integrations for Meet links."}
            </p>
          )}
        </section>

        {/* Compliance notice: confirmed once before going live */}
        {!acknowledged || noticeOpen ? (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-950">Compliance notice</h2>
              {acknowledged ? (
                <button type="button" onClick={() => setNoticeOpen(false)} className="text-xs text-[#1A6CE4] underline">
                  Close
                </button>
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Required before Go live</span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-800">{COMPLIANCE_NOTICE.title}</p>
            <ol className="mt-4 space-y-4">
              {COMPLIANCE_NOTICE.points.map((pt, i) => (
                <li key={pt.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A1A40] text-xs font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{pt.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{pt.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {!acknowledged ? (
              <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-amber-200 pt-4 text-sm leading-relaxed text-slate-800">
                <input type="checkbox" checked={ackChecked} onChange={(e) => setAckChecked(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
                <span>{COMPLIANCE_NOTICE.acknowledgement}</span>
              </label>
            ) : null}
          </section>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <span>
              <span className="font-bold text-emerald-700">✓</span> Compliance notice confirmed on {new Date(a.compliance_acknowledged_at as string).toLocaleString()}
            </span>
            <button type="button" onClick={() => setNoticeOpen(true)} className="text-xs text-[#1A6CE4] underline">
              Read again
            </button>
          </div>
        )}

        {/* Locked rules */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Always on, cannot be changed</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>The AI disclosure and disclaimer line under every conversation.</li>
            <li>Hard stop on remove me, unsubscribe, stop contacting me.</li>
            <li>No prices, percentages or funding promises in any reply.</li>
            <li>The address starts with {AGENT_HOST.replace("https://", "")}/{a.company_slug}/.</li>
          </ul>
        </section>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
          <button type="button" onClick={() => void save()} disabled={saving || !dirty || (endingState ? !endingState.ok : false)} className={btnPrimary}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {a.status === "live" ? (
            <button type="button" onClick={() => void setStatus("paused")} className={btnQuiet}>
              Pause agent
            </button>
          ) : (
            <button type="button" onClick={() => void setStatus("live")} className={btnQuiet} disabled={dirty || (!acknowledged && !ackChecked)}>
              {a.status === "paused" ? "Resume agent" : "Go live"}
            </button>
          )}
          {dirty ? <span className="text-xs text-slate-500">Save before going live.</span> : !acknowledged && !ackChecked ? <span className="text-xs text-slate-500">Confirm the compliance notice to unlock Go live.</span> : null}
        </div>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-950">Live preview</h2>
          <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className="text-xs text-[#1A6CE4] underline">
            Restart
          </button>
        </div>
        <AgentChat key={previewKey} config={previewConfig} sourceTag="preview" preview />
        <p className="mt-2 text-[11px] text-slate-500">The preview uses your saved settings. Replies cost AI credit like the real page. Nothing is booked or recorded from here.</p>
      </aside>
    </div>
  );
}

/* ================================================================== Train */

function TrainTab({ data, onChange, toast }: { data: Loaded; onChange: (d: Loaded) => void; toast: ReturnType<typeof useToast>["toast"] }) {
  const { api } = useContext(AgentApiContext);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [busy, setBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);

  const teach = async () => {
    setBusy(true);
    try {
      const res = await fetch(api("/answers"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, answer: a }) });
      const j = await readJson<{ answer: TaughtAnswer }>(res);
      if (!res.ok) throw new Error(j.error ?? "Could not save.");
      onChange({ ...data, answers: [...data.answers, j.answer], config: { ...data.config, taughtAnswers: [...data.config.taughtAnswers, j.answer] } });
      setQ("");
      setA("");
      toast({ title: "Taught", description: "The agent uses this answer from now on.", variant: "success" });
    } catch (e) {
      toast({ title: "Not saved", description: e instanceof Error ? e.message : "Could not save.", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const forget = async (id: string) => {
    await fetch(api("/answers", { id }), { method: "DELETE" });
    onChange({ ...data, answers: data.answers.filter((x) => x.id !== id), config: { ...data.config, taughtAnswers: data.config.taughtAnswers.filter((x) => x.id !== id) } });
  };

  const uploadPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Only PDF files can be uploaded. Please convert this document to PDF and try again.", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(api("/sources"), { method: "POST", body: fd });
      const j = await readJson<{ source: Source; message: string }>(res);
      if (!res.ok) throw new Error(j.error ?? "Upload failed.");
      onChange({ ...data, sources: [j.source, ...data.sources] });
      toast({ title: j.source.status === "trained" ? "Trained" : "Could not read", description: j.message, variant: j.source.status === "trained" ? "success" : "error" });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Upload failed.", variant: "error" });
    } finally {
      setBusy(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  const removePdf = async (id: string) => {
    await fetch(api("/sources", { id }), { method: "DELETE" });
    onChange({ ...data, sources: data.sources.filter((s) => s.id !== id) });
  };

  const checklist = [
    { done: Boolean(data.agent.about?.trim()), label: "Fact sheet written (Build)" },
    { done: data.answers.length >= 3, label: "At least three taught answers" },
    { done: data.sources.some((s) => s.status === "trained"), label: "One PDF trained" },
    { done: data.booking.ready, label: "Booking hours set" },
    { done: Boolean(data.agent.image_url), label: "Photo or logo uploaded" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={card}>
        <h2 className="text-base font-semibold text-slate-950">Teach an answer</h2>
        <p className="mt-1 text-sm text-slate-600">When an investor asks something close to this question, the agent replies with your answer, word for word, before the AI runs.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} className={`${input} mt-3`} maxLength={200} placeholder="Question investors ask, e.g. Where is the company based?" />
        <textarea value={a} onChange={(e) => setA(e.target.value)} className={`${input} mt-2 min-h-[80px]`} maxLength={500} placeholder="Your answer, one or two short lines. No figures, no promises." />
        <button type="button" onClick={() => void teach()} disabled={busy || q.trim().length < 3 || a.trim().length < 2} className={`${btnPrimary} mt-3`}>
          Teach
        </button>
        <ul className="mt-5 divide-y divide-slate-100">
          {data.answers.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{t.question}</p>
                <p className="mt-0.5 text-slate-600">{t.answer}</p>
              </div>
              <button type="button" onClick={() => void forget(t.id)} className="shrink-0 text-xs text-slate-500 hover:text-red-700">
                Forget
              </button>
            </li>
          ))}
          {!data.answers.length ? <li className="py-3 text-sm text-slate-500">Nothing taught yet.</li> : null}
        </ul>
      </section>

      <div className="space-y-5">
        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">Knowledge sources</h2>
          <p className="mt-1 text-sm text-slate-600">PDF only. Pitch deck, one pager, FAQ. The text is read once and the agent answers from it.</p>
          <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadPdf(e.target.files[0])} />
          <button type="button" onClick={() => pdfRef.current?.click()} disabled={busy} className={`${btnPrimary} mt-3`}>
            {busy ? "Working…" : "Upload PDF"}
          </button>
          <ul className="mt-4 divide-y divide-slate-100">
            {data.sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{s.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {(s.bytes / 1024 / 1024).toFixed(1)} MB ·{" "}
                    <span className={s.status === "trained" ? "text-emerald-700" : s.status === "failed" ? "text-red-700" : ""}>{s.status === "trained" ? "Trained" : s.status === "failed" ? "No readable text" : "Processing"}</span>
                  </p>
                </div>
                <button type="button" onClick={() => void removePdf(s.id)} className="shrink-0 text-xs text-slate-500 hover:text-red-700">
                  Remove
                </button>
              </li>
            ))}
            {!data.sources.length ? <li className="py-2.5 text-sm text-slate-500">No PDFs yet.</li> : null}
          </ul>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">Training checklist</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${c.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{c.done ? "✓" : "·"}</span>
                <span className={c.done ? "text-slate-900" : "text-slate-600"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ================================================================== Share */

function ShareTab({ data, toast }: { data: Loaded; toast: ReturnType<typeof useToast>["toast"] }) {
  const { api } = useContext(AgentApiContext);
  const a = data.agent;
  const url = agentUrl(a.company_slug, a.ending);
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: label, variant: "success" });
    } catch {
      toast({ title: "Could not copy", description: text, variant: "error" });
    }
  };
  const linkedin = `I opened a direct line for investors looking at ${a.company_name}. Our investor relations agent answers questions and books a call with me, any hour. ${trackedUrl(a.company_slug, a.ending, "linkedin")}`;
  const emailBlock = `Talk to ${a.display_name}, our investor relations agent, any time: ${trackedUrl(a.company_slug, a.ending, "email")}`;
  const social = (ch: Channel) => `Investors: ask ${a.company_name} anything and book a call, 24/7. ${trackedUrl(a.company_slug, a.ending, ch)}`;

  if (a.status !== "live") {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Go live in Build first. Links only work for a live agent.</div>;
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <h2 className="text-base font-semibold text-slate-950">Your agent&apos;s link</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-slate-100 px-3 py-2 text-sm">{url}</code>
          <button type="button" onClick={() => void copy(url, "Plain link")} className={btnQuiet}>
            Copy
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className={btnQuiet}>
            Open
          </a>
        </div>
        <p className="mt-3 text-sm text-slate-600">Use the tracked link for each channel below, so Conversations shows where each investor came from.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((ch) => (
            <li key={ch} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{CHANNEL_LABELS[ch]}</span>
              <button type="button" onClick={() => void copy(trackedUrl(a.company_slug, a.ending, ch), `${CHANNEL_LABELS[ch]} link`)} className="text-xs text-[#1A6CE4] underline">
                Copy tracked link
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">Email</h2>
          <p className="mt-1 text-sm text-slate-600">
            In Outreach, the composer has an &quot;Agent link&quot; toggle and a {"{{ir_agent}}"} merge field. Or paste this line into any email.
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{emailBlock}</pre>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void copy(emailBlock, "Email line")} className={btnQuiet}>
              Copy
            </button>
            <Link href="/founder/deploy" className={btnQuiet}>
              Open Outreach
            </Link>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">LinkedIn</h2>
          <p className="mt-1 text-sm text-slate-600">Post it, or add the link to your profile&apos;s Featured section and your headline.</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{linkedin}</pre>
          <button type="button" onClick={() => void copy(linkedin, "LinkedIn post")} className={`${btnQuiet} mt-2`}>
            Copy post
          </button>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">Instagram, Facebook, X</h2>
          <p className="mt-1 text-sm text-slate-600">Put the link in your bio and in the post text. Each copy uses its own tracked link.</p>
          <div className="mt-3 space-y-2">
            {(["instagram", "facebook", "x"] as Channel[]).map((ch) => (
              <div key={ch} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="truncate text-slate-700">{social(ch)}</span>
                <button type="button" onClick={() => void copy(social(ch), `${CHANNEL_LABELS[ch]} post`)} className="shrink-0 text-xs text-[#1A6CE4] underline">
                  Copy
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold text-slate-950">QR code</h2>
          <p className="mt-1 text-sm text-slate-600">For slides, one pagers and event booths. Scans go to the tracked QR link.</p>
          <div className="mt-3 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={api("/qr")} alt="QR code for your agent" className="h-36 w-36 rounded-lg border border-slate-200" />
            <a href={api("/qr")} download={`${a.company_slug}-ir-agent-qr.png`} className={btnQuiet}>
              Download PNG
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ========================================================== Conversations */

function ConversationsTab() {
  const { api } = useContext(AgentApiContext);
  const [rows, setRows] = useState<Conversation[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch(api("/conversations"), { cache: "no-store" });
      const j = await readJson<{ conversations: Conversation[] }>(res);
      if (active) setRows(j.conversations ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setState = async (id: string, review_state: Conversation["review_state"]) => {
    await fetch(api("/conversations"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, review_state }) });
    setRows((r) => (r ? r.map((c) => (c.id === id ? { ...c, review_state } : c)) : r));
  };

  if (!rows) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!rows.length) return <div className={`${card} text-sm text-slate-600`}>No conversations yet. Share your link and they will show up here.</div>;

  const booked = rows.filter((r) => r.booked_at).length;
  const withContact = rows.filter((r) => Object.values(r.contact).some(Boolean)).length;
  const bySource = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.source ?? "direct"]: (m[r.source ?? "direct"] ?? 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Conversations", rows.length],
          ["Left contact details", withContact],
          ["Booked calls", booked],
          ["Opted out", rows.filter((r) => r.stopped).length],
        ].map(([label, n]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{n}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        By source:{" "}
        {Object.entries(bySource)
          .sort((x, y) => y[1] - x[1])
          .map(([s, n]) => `${s} ${n}`)
          .join(" · ")}
      </p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {rows.map((c) => {
          const p = c.profile as { type?: string; sect?: string[]; cmin?: number; cmax?: number };
          const summary = [p.type, p.sect?.join(", ")].filter(Boolean).join(" · ") || "No profile yet";
          return (
            <li key={c.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="text-left">
                  <span className="font-medium text-slate-900">{c.contact.name || "Anonymous investor"}</span>
                  <span className="ml-2 text-slate-500">{summary}</span>
                </button>
                <div className="flex items-center gap-2 text-xs">
                  {c.booked_at ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Booked</span> : null}
                  {c.stopped ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">Opted out</span> : null}
                  <span className="text-slate-500">{c.source ?? "direct"}</span>
                  <select value={c.review_state} onChange={(e) => void setState(c.id, e.target.value as Conversation["review_state"])} className="rounded border border-slate-300 px-1.5 py-0.5">
                    <option value="new">New</option>
                    <option value="needs_review">Needs review</option>
                    <option value="approved">Reviewed</option>
                  </select>
                  <span className="text-slate-400">{new Date(c.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              {open === c.id ? (
                <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3">
                  {Object.entries(c.contact).filter(([, v]) => v).length ? (
                    <p className="text-xs text-slate-600">
                      {Object.entries(c.contact)
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {c.transcript.map((t, i) => (
                    <p key={i} className={t.role === "user" ? "text-slate-900" : "text-slate-600"}>
                      <span className="mr-1 text-[11px] font-semibold uppercase text-slate-400">{t.role === "user" ? "Investor" : "Agent"}</span>
                      {t.content}
                    </p>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
