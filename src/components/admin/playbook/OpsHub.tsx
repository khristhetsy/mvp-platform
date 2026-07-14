"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HubShell, type HubTab } from "@/components/admin/hub/HubShell";
import { IrAnalyticsTab } from "@/components/admin/playbook/IrAnalyticsTab";
import { IrLifecycleCard } from "@/components/admin/IrLifecycleCard";
import { type LifecycleStage } from "@/components/admin/LifecycleStepper";
import type { HubPayload, HubSurface } from "@/lib/playbook/hub";
import type { Suggestion, AdvisoryAction } from "@/lib/playbook/advisory";
import type { HubSettings } from "@/lib/playbook/hub-settings";

const BLOCK_LABEL: Record<string, string> = { open: "Open the day", core: "Core operations", close: "Close the day" };
const BLOCK_DESC: Record<string, string> = {
  open: "Morning block — clear these before anything else. Gates are hard stops.",
  core: "The working middle of the day.",
  close: "Nothing critical carries overnight.",
};
const CADENCE_LABEL: Record<string, string> = { daily: "Daily", "2-3x_week": "2–3× / week", weekly: "Weekly", monthly: "Monthly" };

async function api(url: string, method: string, body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return res.ok;
  } catch {
    return false;
  }
}

export function OpsHub({ initial, initialTab, isAdmin }: { initial: HubPayload; initialTab: string; isAdmin: boolean }) {
  const [payload, setPayload] = useState<HubPayload>(initial);
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/playbook/hub");
      if (res.ok) setPayload(await res.json());
    } catch { /* ignore */ }
  }, []);

  function changeTab(key: string) {
    setTab(key);
    try { window.history.replaceState(null, "", `?tab=${key}`); } catch { /* ignore */ }
  }

  const corePending = useMemo(() => payload.surfaces.filter((s) => s.block === "core").reduce((a, s) => a + (s.pending ?? 0), 0), [payload.surfaces]);

  const tabs: HubTab[] = [
    { key: "dash", label: "Dashboard" },
    { key: "analytics", label: "Analytics" },
    { key: "open", label: "Open the day", badge: { count: payload.stats.openEscalations, tone: "red" } },
    { key: "core", label: "Core operations", badge: { count: corePending, tone: "amber" } },
    { key: "close", label: "Close the day" },
    { key: "settings", label: "Settings" },
  ];

  async function toggleCheck(s: HubSurface, checked: boolean) {
    if (!s.moduleId) return;
    setPayload((p) => ({ ...p, surfaces: p.surfaces.map((x) => (x.navId === s.navId ? { ...x, checkedToday: checked } : x)) }));
    await api("/api/admin/playbook/checks", "POST", { surfaceId: s.moduleId, checked });
    void refresh();
  }

  async function runAdvisoryAction(sug: Suggestion, action: AdvisoryAction) {
    if (action.kind === "link") return; // handled by <Link>
    setBusy(true);
    try {
      if (action.endpoint === "/api/admin/playbook/advisory/action") {
        const isSnooze = action.label.toLowerCase().includes("snooze");
        await api(action.endpoint, "POST", { suggestionKey: sug.key, action: isSnooze ? "snoozed" : "dismissed", snoozeHours: isSnooze ? 24 : undefined });
      } else if (action.endpoint) {
        await api(action.endpoint, "POST", action.payload ?? {});
        // For nudge etc., also dismiss so it doesn't re-suggest immediately.
        await api("/api/admin/playbook/advisory/action", "POST", { suggestionKey: sug.key, action: "snoozed", snoozeHours: 24 });
      }
      await refresh();
    } finally { setBusy(false); }
  }

  const subtitle = new Date(payload.today + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <HubShell flat title="Investor Relations Hub" subtitle={subtitle} tabs={tabs} activeTab={tab} onTabChange={changeTab}>
      {tab === "dash" && <DashboardTab payload={payload} onJump={changeTab} onToggle={toggleCheck} onAdvisory={runAdvisoryAction} busy={busy} />}
      {tab === "analytics" && <IrAnalyticsTab />}
      {(tab === "open" || tab === "core" || tab === "close") && (
        <BlockTab block={tab} surfaces={payload.surfaces.filter((s) => s.block === tab)} isAdmin={isAdmin} onToggle={toggleCheck} onRefresh={refresh} />
      )}
      {tab === "settings" && <SettingsTab settings={payload.settings} isAdmin={isAdmin} onRefresh={refresh} />}
    </HubShell>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────────── */

function DashboardTab({ payload, onJump, onToggle, onAdvisory, busy }: {
  payload: HubPayload; onJump: (k: string) => void; onToggle: (s: HubSurface, c: boolean) => void;
  onAdvisory: (s: Suggestion, a: AdvisoryAction) => void; busy: boolean;
}) {
  const { stats } = payload;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <IrJourneyCard />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <StatWidget tone="alert" label="Open escalations" value={stats.openEscalations} sub={`${stats.urgentEscalations} urgent`} onClick={() => onJump("open")} />
        <StatWidget tone="warn" label="Queue items pending" value={stats.queuePending} sub={stats.queuesClear.length ? `${stats.queuesClear.length} queue${stats.queuesClear.length === 1 ? "" : "s"} clear` : "across all queues"} onClick={() => onJump("core")} />
        <StatWidget tone="info" label="Today's run" value={`${stats.runChecked}/${stats.runTotal}`} sub={`${stats.gatesCleared}/${stats.gatesTotal} gates cleared`} onClick={() => onJump("dash")} />
        <StatWidget tone={stats.complianceCritical == null ? "info" : stats.complianceCritical > 0 ? "alert" : "ok"} label="Compliance" value={stats.complianceCritical == null ? "—" : stats.complianceCritical} sub={stats.complianceCritical == null ? "no source" : "critical flags"} onClick={() => onJump("close")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <TodaysRun surfaces={payload.surfaces.filter((s) => s.block != null).sort(orderBy)} onToggle={onToggle} onJump={onJump} />
        {payload.settings.advisoryEnabled && <AdvisoryPanel suggestions={payload.suggestions} onAction={onAdvisory} busy={busy} />}
      </div>
    </div>
  );
}

// Investor/Founder journey funnel card (numbered-stage pipeline with a toggle),
// fetched client-side. Replaces the old flat "Investor lifecycle" bar.
function IrJourneyCard() {
  const [investor, setInvestor] = useState<LifecycleStage[]>([]);
  const [founder, setFounder] = useState<LifecycleStage[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/lifecycle/investor").then((r) => r.json()).then((d) => {
      if (!alive) return;
      setInvestor((d.investor ?? d.stages ?? []) as LifecycleStage[]);
      setFounder((d.founder ?? []) as LifecycleStage[]);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (investor.length === 0 && founder.length === 0) return null;
  return <IrLifecycleCard investorStages={investor} founderStages={founder} />;
}

const BLOCK_ORDER: Record<string, number> = { open: 0, core: 1, close: 2 };
function orderBy(a: HubSurface, b: HubSurface) {
  return (BLOCK_ORDER[a.block ?? "core"] - BLOCK_ORDER[b.block ?? "core"]) || (a.sortOrder - b.sortOrder);
}

function TodaysRun({ surfaces, onToggle, onJump }: { surfaces: HubSurface[]; onToggle: (s: HubSurface, c: boolean) => void; onJump: (k: string) => void }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", fontSize: 13, fontWeight: 600 }}>Today&apos;s run <span style={{ fontWeight: 400, fontSize: 11.5, color: "var(--muted-foreground)" }}>· operating order</span></div>
      {surfaces.map((s, i) => (
        <div key={s.navId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderTop: i ? "0.5px solid #f1f5f9" : "none", background: s.checkedToday ? "#F6FBF9" : undefined }}>
          <input type="checkbox" checked={s.checkedToday} disabled={!s.moduleId} onChange={(e) => onToggle(s, e.target.checked)} style={{ width: 15, height: 15 }} aria-label={`Mark ${s.label} done`} />
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", width: 18 }}>{i + 1}</span>
          <button onClick={() => s.block && onJump(s.block)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: s.checkedToday ? "var(--muted-foreground)" : "var(--foreground)", textDecoration: s.checkedToday ? "line-through" : "none" }}>{s.label}</button>
          {s.pending != null && s.pending > 0 && <span style={{ fontSize: 10, color: "#185FA5", background: "#E6F1FB", borderRadius: 10, padding: "1px 7px" }}>{s.pending}</span>}
          {s.isGate && <span style={{ fontSize: 10, color: "#A32D2D", background: "#FCEBEB", borderRadius: 10, padding: "1px 7px" }}>Gate</span>}
          {!s.isGate && s.flags.length > 0 && <span style={{ fontSize: 10, color: "#854F0B", background: "#FAEEDA", borderRadius: 10, padding: "1px 7px" }}>Guardrail</span>}
        </div>
      ))}
      {surfaces.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: "var(--muted-foreground)" }}>No documented surfaces yet.</div>}
    </div>
  );
}

const TONE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  alert: { bg: "#FCEBEB", border: "#F09595", color: "#A32D2D", label: "#A32D2D" },
  warn: { bg: "#FAEEDA", border: "#F4D9A0", color: "#854F0B", label: "#854F0B" },
  info: { bg: "#E6F1FB", border: "#B5D4F4", color: "#185FA5", label: "#185FA5" },
  ok: { bg: "#E1F5EE", border: "#9FE1CB", color: "#0F6E56", label: "#0F6E56" },
};

function StatWidget({ tone, label, value, sub, onClick }: { tone: "alert" | "warn" | "info" | "ok"; label: string; value: string | number; sub: string; onClick: () => void }) {
  const t = TONE[tone];
  return (
    <button onClick={onClick} style={{ textAlign: "left", background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
      <div style={{ fontSize: 11.5, color: t.label, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: t.color, margin: "4px 0 2px" }}>{value}</div>
      <div style={{ fontSize: 11, color: t.color, opacity: 0.85 }}>{sub}</div>
    </button>
  );
}

function AdvisoryPanel({ suggestions, onAction, busy }: { suggestions: Suggestion[]; onAction: (s: Suggestion, a: AdvisoryAction) => void; busy: boolean }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "#EEF2FF", color: "#4338CA", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-sparkles" aria-hidden="true" /></span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>AI Ops Advisory</span>
        <span style={{ fontSize: 10.5, color: "#0F6E56", background: "#E1F5EE", borderRadius: 8, padding: "1px 8px" }}>Suggests · you decide</span>
      </div>
      {suggestions.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12.5, color: "var(--muted-foreground)" }}>Nothing needs attention right now.</div>
      ) : suggestions.map((s) => (
        <div key={s.key} style={{ padding: "11px 16px", borderTop: "0.5px solid #f1f5f9" }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.title}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "2px 0 8px", lineHeight: 1.5 }}>{s.detail}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {s.actions.map((a) => a.kind === "link" && a.href ? (
              <Link key={a.label} href={a.href} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", borderRadius: 7, padding: "5px 11px", textDecoration: "none" }}>{a.label}</Link>
            ) : (
              <button key={a.label} disabled={busy} onClick={() => onAction(s, a)} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 7, padding: "5px 11px", cursor: "pointer" }}>{a.label}</button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ padding: "9px 16px", borderTop: "0.5px solid #f1f5f9", fontSize: 10.5, color: "var(--muted-foreground)" }}>Suggests — you decide. Nothing here changes data on its own; every action is an explicit click.</div>
    </div>
  );
}

/* ── Block tabs ────────────────────────────────────────────────────────────── */

function BlockTab({ block, surfaces, isAdmin, onToggle, onRefresh }: { block: string; surfaces: HubSurface[]; isAdmin: boolean; onToggle: (s: HubSurface, c: boolean) => void; onRefresh: () => void }) {
  const sorted = [...surfaces].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{BLOCK_LABEL[block]} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)" }}>· {sorted.length} surface{sorted.length === 1 ? "" : "s"}</span></div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{BLOCK_DESC[block]}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12 }}>
        {sorted.map((s) => <SurfaceCard key={s.navId} surface={s} isAdmin={isAdmin} onToggle={onToggle} onRefresh={onRefresh} />)}
        {sorted.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>No surfaces in this block.</div>}
      </div>
    </div>
  );
}

function SurfaceCard({ surface: s, isAdmin, onToggle, onRefresh }: { surface: HubSurface; isAdmin: boolean; onToggle: (s: HubSurface, c: boolean) => void; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [roleNote, setRoleNote] = useState(s.roleNote ?? "");
  const [cadence, setCadence] = useState(s.cadence ?? "daily");
  const [stepsText, setStepsText] = useState(s.steps.map((st) => st.body).join("\n"));
  const [saving, setSaving] = useState(false);
  const gate = s.flags.find((f) => f.kind === "hard_gate");
  const guard = s.flags.find((f) => f.kind === "guardrail");

  async function save() {
    setSaving(true);
    const steps = stepsText.split("\n").map((b, i) => ({ step_no: i + 1, body: b.trim() })).filter((x) => x.body);
    const ok = await api("/api/admin/playbook/module", "PATCH", { navId: s.navId, role_note: roleNote || null, cadence, steps });
    setSaving(false);
    if (ok) { setEditing(false); onRefresh(); }
  }

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderLeft: gate ? "3px solid #A32D2D" : guard ? "3px solid #EF9F27" : "0.5px solid #e2e6ed", borderRadius: 10, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={s.checkedToday} disabled={!s.moduleId} onChange={(e) => onToggle(s, e.target.checked)} style={{ width: 15, height: 15 }} aria-label={`Mark ${s.label} done`} />
        <Link href={s.href} style={{ fontSize: 13.5, fontWeight: 600, color: "#185FA5", textDecoration: "none" }}>{s.label}</Link>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          {s.pending != null && s.pending > 0 && <span style={{ fontSize: 10, color: "#185FA5", background: "#E6F1FB", borderRadius: 10, padding: "1px 8px" }}>{s.pending} pending</span>}
          {s.cadence && <span style={{ fontSize: 10, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 10, padding: "1px 8px" }}>{CADENCE_LABEL[s.cadence] ?? s.cadence}</span>}
        </div>
      </div>
      <code style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.href}</code>
      {s.roleNote && !editing && <div style={{ fontSize: 12, color: "var(--foreground)", marginTop: 6, lineHeight: 1.5 }}>{s.roleNote}</div>}

      {(gate || guard) && !editing && (
        <div style={{ marginTop: 8, fontSize: 11, color: gate ? "#A32D2D" : "#854F0B", background: gate ? "#FCEBEB" : "#FAEEDA", borderRadius: 7, padding: "5px 9px" }}>
          <strong>{gate ? "Hard gate" : "Guardrail"}:</strong> {(gate ?? guard)!.label}
        </div>
      )}

      {!editing ? (
        <>
          {s.steps.length > 0 && (
            <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--foreground)", lineHeight: 1.6 }}>
              {s.steps.map((st) => <li key={st.step_no}>{st.body}</li>)}
            </ol>
          )}
          {s.state === "undocumented" && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 6, fontStyle: "italic" }}>Not documented yet.</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #f1f5f9" }}>
            <Link href={s.href} style={{ fontSize: 11.5, fontWeight: 600, color: "#185FA5", textDecoration: "none" }}>Open →</Link>
            {isAdmin && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={async () => { if (await api("/api/admin/playbook/drift/ignore", "POST", { navIds: [s.navId], ignored: true })) onRefresh(); }} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }} title="Hide this surface from the hub (reversible)">Remove</button>
                <button onClick={() => setEditing(true)} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Role note</label><input value={roleNote} onChange={(e) => setRoleNote(e.target.value)} style={inp} /></div>
          <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Cadence</label><select value={cadence} onChange={(e) => setCadence(e.target.value)} style={inp}>{Object.entries(CADENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Steps (one per line)</label><textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} style={{ ...inp, minHeight: 90, resize: "vertical", lineHeight: 1.5 }} /></div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={save} disabled={saving} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "6px 13px", cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => setEditing(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 7, padding: "6px 13px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Settings ──────────────────────────────────────────────────────────────── */

const TZ_OPTIONS = ["Europe/Paris", "UTC", "America/New_York", "America/Los_Angeles", "America/Chicago", "Asia/Singapore"];

function SettingsTab({ settings, isAdmin, onRefresh }: { settings: HubSettings; isAdmin: boolean; onRefresh: () => void }) {
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(partial: Partial<HubSettings>) {
    const next = { ...s, ...partial };
    setS(next); setMsg(null);
    const res = await fetch("/api/admin/playbook/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(partial) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Save failed.");
      setS(settings); // revert
    } else { setMsg("Saved."); onRefresh(); }
  }

  const rows: { label: string; desc: string; control: React.ReactNode }[] = [
    { label: "Menu drift detection", desc: "Flag surfaces that fall out of sync with the live menu.", control: <Toggle on={s.driftDetection} disabled={!isAdmin} onChange={(v) => patch({ driftDetection: v })} /> },
    { label: "Drift auto-add → Core", desc: "New menu items are added to the Core block automatically.", control: <Toggle on={s.driftAutoAdd} disabled={!isAdmin} onChange={(v) => patch({ driftAutoAdd: v })} /> },
    { label: "AI Ops Advisory", desc: "Show the rule-based suggestion panel on the dashboard.", control: <Toggle on={s.advisoryEnabled} disabled={!isAdmin} onChange={(v) => patch({ advisoryEnabled: v })} /> },
    { label: "Daily run reset", desc: "Timezone whose midnight resets each admin's daily run.", control: <select value={s.runResetTz} disabled={!isAdmin} onChange={(e) => patch({ runResetTz: e.target.value })} style={inp}>{TZ_OPTIONS.map((z) => <option key={z} value={z}>{z}</option>)}</select> },
    { label: "Escalation past-due threshold", desc: "Days before an item is treated as past-due by the escalation scan.", control: <select value={String(s.escalationPastDueDays)} disabled={!isAdmin} onChange={(e) => patch({ escalationPastDueDays: Number(e.target.value) })} style={inp}>{[14, 21, 30].map((d) => <option key={d} value={d}>{d} days</option>)}</select> },
    { label: "Playbook editing scope", desc: "Who may edit surfaces and these settings.", control: <select value={s.playbookEditScope} disabled={!isAdmin} onChange={(e) => patch({ playbookEditScope: e.target.value as HubSettings["playbookEditScope"] })} style={inp}><option value="all_admins">All admins</option><option value="owner_only">Owner only</option></select> },
  ];

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 16, padding: "13px 16px", borderTop: i ? "0.5px solid #f1f5f9" : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{r.desc}</div>
            </div>
            {r.control}
          </div>
        ))}
      </div>
      {msg && <div style={{ fontSize: 11.5, color: msg === "Saved." ? "#0F6E56" : "#A32D2D", marginTop: 8 }}>{msg}</div>}
      {!isAdmin && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 8 }}>Read-only role — settings can only be changed by an admin.</div>}

      {s.driftIgnored.length > 0 && (
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", marginTop: 16 }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f1f5f9", fontSize: 13, fontWeight: 500 }}>Hidden surfaces <span style={{ fontWeight: 400, fontSize: 11.5, color: "var(--muted-foreground)" }}>· removed from the hub</span></div>
          {s.driftIgnored.map((navId) => (
            <div key={navId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "0.5px solid #f1f5f9" }}>
              <code style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{navId}</code>
              {isAdmin && (
                <button onClick={async () => { if (await api("/api/admin/playbook/drift/ignore", "POST", { navIds: [navId], ignored: false })) { setS({ ...s, driftIgnored: s.driftIgnored.filter((x) => x !== navId) }); onRefresh(); } }} style={{ marginLeft: "auto", fontSize: 11.5, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>Restore</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} disabled={disabled} aria-pressed={on} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: on ? "#2E78F5" : "#cbd5e1", position: "relative", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </button>
  );
}

const inp: React.CSSProperties = { fontSize: 12.5, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", width: "100%", boxSizing: "border-box" };
