"use client";

import { useEffect, useState } from "react";
import { BotMessageSquare } from "lucide-react";
import { FIELD_LABELS, type AgentTemplate, type QuestionField } from "@/lib/ir-agent/defaults";

type Founder = {
  id: string;
  name: string;
  purpose: string | null;
  override: "allow" | "deny" | null;
  agent: { company_slug: string; ending: string; status: string; updated_at: string; compliance_acknowledged_at: string | null } | null;
};
type Loaded = {
  enabled: boolean;
  demoSlug: string | null;
  liveAgents: Array<{ slug: string; label: string }>;
  plans: Array<{ plan_type: string; label: string; enabled: boolean }>;
  template: AgentTemplate;
  founders: Founder[];
};

const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

/**
 * Feature Controls card for the founder IR agent: the master toggle, which
 * plans include it, per founder overrides, and the master template new agents
 * are copied from. Template changes reach new agents only.
 */
export function IrAgentControls() {
  const [data, setData] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [filter, setFilter] = useState("");
  const [template, setTemplate] = useState<AgentTemplate | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/ir-agent");
      if (!res.ok) return;
      const j = (await res.json()) as Loaded;
      setData(j);
      setTemplate(j.template);
    })();
  }, []);

  async function put(body: Record<string, unknown>, success: string) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ir-agent", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      setMsg({ text: res.ok ? success : (j.error ?? "Could not save."), ok: res.ok });
      return res.ok;
    } catch {
      setMsg({ text: "Could not save.", ok: false });
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (!data || !template) return null;

  const toggle = async () => {
    const enabled = !data.enabled;
    if (await put({ enabled }, enabled ? "Founder IR Agent is on." : "Founder IR Agent is off for every founder.")) setData({ ...data, enabled });
  };
  const togglePlan = async (plan_type: string) => {
    const plans = data.plans.map((p) => (p.plan_type === plan_type ? { ...p, enabled: !p.enabled } : p));
    if (await put({ plans: plans.map(({ plan_type, enabled }) => ({ plan_type, enabled })) }, "Plan access saved.")) setData({ ...data, plans });
  };
  const setOverride = async (orgId: string, override: "allow" | "deny" | null) => {
    if (await put({ overrides: [{ orgId, override }] }, "Override saved.")) setData({ ...data, founders: data.founders.map((f) => (f.id === orgId ? { ...f, override } : f)) });
  };
  const saveTemplate = async () => {
    if (await put({ template }, "Template saved. New agents start from it; existing agents keep their own copy.")) setData({ ...data, template });
  };

  const founders = data.founders.filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));
  const qFields: QuestionField[] = ["investor_type", "preferred_sectors", "check_size", "preferred_stages", "capital_types", "custom"];

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <BotMessageSquare className="h-5 w-5 text-[var(--gold,#B8860B)]" strokeWidth={1.75} aria-hidden /> Founder IR Agent (Build Your Agent)
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Each founder builds an investor relations agent at icapos.com/[company]/[ending], modeled on Johnny. Turn it on for plans, override per founder, and edit the template new agents start from.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <span className="text-sm font-medium text-slate-900">Master switch</span>
            <p className="text-xs text-slate-500">Off hides the page and the nav item for every founder, whatever their plan.</p>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
            <button
              type="button"
              role="switch"
              aria-checked={data.enabled}
              onClick={() => void toggle()}
              disabled={saving}
              className={`relative h-6 w-11 rounded-full transition ${data.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${data.enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Plans that include it</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Reflected on the pricing page and the signup plan picker: a ticked plan shows &quot;Investor Relations Agent, raising capital 24/7&quot;, an unticked one shows it crossed out.</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {data.plans.map((p) => (
              <label key={p.plan_type} className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" checked={p.enabled} disabled={saving} onChange={() => void togglePlan(p.plan_type)} />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Per founder</p>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by company" className="w-48 rounded-md border border-slate-300 px-2 py-1 text-xs" />
          </div>
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Notice</th>
                  <th className="px-3 py-2 font-medium">Access</th>
                </tr>
              </thead>
              <tbody>
                {founders.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="text-slate-900">{f.name}</span>
                      {f.purpose ? <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">{f.purpose}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {f.agent ? (
                        <a href={`/${f.agent.company_slug}/${f.agent.ending}`} target="_blank" rel="noopener noreferrer" className="font-mono underline">
                          /{f.agent.company_slug}/{f.agent.ending}
                        </a>
                      ) : (
                        "Not built"
                      )}
                      {f.agent ? <span className="ml-2">{f.agent.status}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {f.agent?.compliance_acknowledged_at ? `Confirmed ${new Date(f.agent.compliance_acknowledged_at).toLocaleDateString()}` : f.agent ? "Not confirmed" : ""}
                    </td>
                    <td className="px-3 py-2">
                      <select value={f.override ?? ""} onChange={(e) => void setOverride(f.id, (e.target.value || null) as "allow" | "deny" | null)} className="rounded border border-slate-300 px-1.5 py-1 text-xs" disabled={saving}>
                        <option value="">Follow plan</option>
                        <option value="allow">Always on</option>
                        <option value="deny">Always off</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!founders.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-xs text-slate-500">
                      No founder accounts match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Demo and internal accounts record conversations but never send email or book real meetings.</p>
        </div>

        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Demo agent for the website</p>
          <p className="mt-0.5 text-[11px] text-slate-500">The pricing page shows &quot;Talk to a demo agent&quot; linking to this live agent. Pick one on a demo or internal account so nothing real is booked.</p>
          <select
            value={data.demoSlug ?? ""}
            disabled={saving}
            onChange={(e) => void (async () => {
              const demoSlug = e.target.value || null;
              if (await put({ demoSlug }, demoSlug ? "Demo agent saved. The pricing page links to it." : "Demo strip removed from the pricing page.")) setData({ ...data, demoSlug });
            })()}
            className="mt-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">None (hide the strip)</option>
            {data.liveAgents.map((a) => (
              <option key={a.slug} value={a.slug}>{a.label} · /{a.slug}</option>
            ))}
          </select>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Master template</p>
              <p className="text-xs text-slate-500">Copied from the Johnny IR agent. Changes reach new agents only.</p>
            </div>
            <button type="button" onClick={() => setShowTemplate((s) => !s)} className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
              {showTemplate ? "Hide" : "Edit template"}
            </button>
          </div>
          {showTemplate ? (
            <div className="mt-3 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-slate-500">Default agent name</span>
                <input value={template.displayName} onChange={(e) => setTemplate({ ...template, displayName: e.target.value })} className={input} maxLength={60} />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <label key={i} className="block text-sm">
                    <span className="mb-1 block text-xs text-slate-500">Welcome line {i + 1}</span>
                    <input
                      value={template.welcome[i]}
                      onChange={(e) => setTemplate({ ...template, welcome: (i === 0 ? [e.target.value, template.welcome[1]] : [template.welcome[0], e.target.value]) as [string, string] })}
                      className={input}
                      maxLength={200}
                    />
                  </label>
                ))}
              </div>
              <div>
                <p className="text-xs text-slate-500">Questions</p>
                <ol className="mt-1 space-y-2">
                  {template.questions.map((q, i) => (
                    <li key={i} className="grid gap-1 rounded-lg border border-slate-200 p-2 sm:grid-cols-[150px_1fr_1fr_auto]">
                      <select value={q.field} onChange={(e) => setTemplate({ ...template, questions: template.questions.map((x, k) => (k === i ? { ...x, field: e.target.value as QuestionField } : x)) })} className={input}>
                        {qFields.map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABELS[f]}
                          </option>
                        ))}
                      </select>
                      <input value={q.prompt} onChange={(e) => setTemplate({ ...template, questions: template.questions.map((x, k) => (k === i ? { ...x, prompt: e.target.value } : x)) })} className={input} maxLength={200} placeholder="Wording" />
                      <input
                        value={q.options.join(", ")}
                        onChange={(e) => setTemplate({ ...template, questions: template.questions.map((x, k) => (k === i ? { ...x, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)) })}
                        className={input}
                        placeholder="Tap options, comma separated"
                      />
                      <button type="button" onClick={() => setTemplate({ ...template, questions: template.questions.filter((_, k) => k !== i) })} className="text-xs text-slate-500 hover:text-red-700">
                        Remove
                      </button>
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={() => setTemplate({ ...template, questions: [...template.questions, { field: "custom", prompt: "", options: [], enabled: true }] })} className="mt-2 text-xs font-medium text-indigo-600">
                  Add question
                </button>
              </div>
              <div>
                <p className="text-xs text-slate-500">Contact questions</p>
                <ul className="mt-1 space-y-2">
                  {template.contactFields.map((c, i) => (
                    <li key={i} className="grid gap-1 rounded-lg border border-slate-200 p-2 sm:grid-cols-[120px_1fr_120px_auto_auto]">
                      <input value={c.key} onChange={(e) => setTemplate({ ...template, contactFields: template.contactFields.map((x, k) => (k === i ? { ...x, key: e.target.value } : x)) })} className={input} placeholder="key" />
                      <input value={c.label} onChange={(e) => setTemplate({ ...template, contactFields: template.contactFields.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} className={input} placeholder="Label" />
                      <select value={c.kind} onChange={(e) => setTemplate({ ...template, contactFields: template.contactFields.map((x, k) => (k === i ? { ...x, kind: e.target.value as "short_text" | "email" | "phone" } : x)) })} className={input}>
                        <option value="short_text">Short text</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={c.required} onChange={(e) => setTemplate({ ...template, contactFields: template.contactFields.map((x, k) => (k === i ? { ...x, required: e.target.checked } : x)) })} /> Required
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={c.enabled} onChange={(e) => setTemplate({ ...template, contactFields: template.contactFields.map((x, k) => (k === i ? { ...x, enabled: e.target.checked } : x)) })} /> On
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <button type="button" onClick={() => void saveTemplate()} disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {saving ? "Saving…" : "Save template"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
