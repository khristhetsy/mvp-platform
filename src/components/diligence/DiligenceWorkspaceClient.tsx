"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Sparkles, Loader2, Send, Undo2, FileDown, FilePen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/ToastProvider";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { StateChip } from "./StateChip";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { VisibilityGate, type GateMap } from "./VisibilityGate";
import type { Claim, Domain, Engagement, Finding, Severity, Verification } from "@/lib/diligence/types";

type DocRequestRow = { id: string; category: string; label: string; closes_findings: string[]; due_date: string | null; status: string };
type ConditionRow = { id: string; label: string; detail: string | null; status: string };
type ConsentInfo = { envelope: { status: string; signature_request_id: string | null } | null; sealedHash: string | null };
type MemberRow = { email: string; role: string };
type CompanyCtx = { founderEmail: string | null; businessDescription: string | null };
type Detail = { engagement: Engagement; domains: Domain[]; findings: Finding[]; claims: Claim[]; gate: GateMap; docRequests: DocRequestRow[]; conditions: ConditionRow[]; consent?: ConsentInfo; members?: MemberRow[]; company?: CompanyCtx | null };

const DEFAULT_GATE: GateMap = {
  findings: { founder_visible: true, investor_visible: true },
  responses: { founder_visible: true, investor_visible: true },
  data_room: { founder_visible: true, investor_visible: false },
  candor: { founder_visible: false, investor_visible: false },
  icfo_review: { founder_visible: false, investor_visible: false },
  verdict: { founder_visible: false, investor_visible: true },
};

export function DiligenceWorkspaceClient({ engagementId }: { engagementId: string }) {
  const t = useTranslations("diligenceAdmin.workspace");
  const { toast } = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"findings" | "ledger" | "dataroom" | "conditions" | "activity">("findings");
  const [audit, setAudit] = useState<{ id: number; action: string; actor: string | null; target: string | null; at: string }[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [founderEmail, setFounderEmail] = useState("");
  const [sendGate, setSendGate] = useState<GateMap>(DEFAULT_GATE);
  const [acting, setActing] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [ceoName, setCeoName] = useState("");
  const [ceoEmail, setCeoEmail] = useState("");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/diligence/${engagementId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load.");
    setDetail(data);
  }, [engagementId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/diligence/${engagementId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load.");
        if (active) setDetail(data);
      } catch (err) {
        if (active) toast({ title: t("couldNotLoad"), description: err instanceof Error ? err.message : "", variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [engagementId, toast, t]);

  const saveFinding = useCallback(async (patch: Partial<Finding>) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}/findings`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast({ title: t("saveFailed"), description: d.error ?? "", variant: "error" }); return; }
    await reload();
  }, [engagementId, reload, toast, t]);

  const removeFinding = useCallback(async (findingId: string) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}/findings`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ findingId }),
    });
    if (res.ok) await reload();
  }, [engagementId, reload]);

  const saveClaim = useCallback(async (patch: Partial<Claim>) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}/claims`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast({ title: t("saveFailed"), description: d.error ?? "", variant: "error" }); return; }
    await reload();
  }, [engagementId, reload, toast, t]);

  const verifyClaimState = useCallback(async (claimId: string, state: Verification) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}/claims`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, state }),
    });
    if (res.ok) await reload();
  }, [engagementId, reload]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/diligence/${engagementId}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_text: aiText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      toast({ title: t("drafted", { count: data.count }), description: t("reviewEdit"), variant: "success" });
      setAiOpen(false);
      setAiText("");
      await reload();
    } catch (err) {
      toast({ title: t("couldNotGenerate"), description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setGenerating(false);
    }
  }, [engagementId, aiText, reload, toast, t]);

  const doSend = useCallback(async () => {
    setActing(true);
    try {
      const gateOverrides = Object.entries(sendGate).flatMap(([section, row]) => [
        { section, who: "founder" as const, visible: row.founder_visible },
        { section, who: "investor" as const, visible: row.investor_visible },
      ]);
      const res = await fetch(`/api/admin/diligence/${engagementId}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founder_email: founderEmail.trim(), gate: gateOverrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      toast({ title: data.delivered ? t("sentFounder") : t("sentEmailNotConfigured"), variant: "success" });
      setSendOpen(false); setFounderEmail("");
      await reload();
    } catch (err) {
      toast({ title: t("couldNotSend"), description: err instanceof Error ? err.message : "", variant: "error" });
    } finally { setActing(false); }
  }, [engagementId, founderEmail, sendGate, reload, toast, t]);

  const doTransition = useCallback(async (action: "mark_review" | "recall") => {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/diligence/${engagementId}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      await reload();
    } catch (err) {
      toast({ title: t("couldNotUpdate"), description: err instanceof Error ? err.message : "", variant: "error" });
    } finally { setActing(false); }
  }, [engagementId, reload, toast, t]);

  const toggleLiveGate = useCallback(async (section: string, who: "founder" | "investor", visible: boolean) => {
    setDetail((d) => d ? { ...d, gate: { ...d.gate, [section]: { ...(d.gate[section] ?? { founder_visible: false, investor_visible: false }), [who === "founder" ? "founder_visible" : "investor_visible"]: visible } } } : d);
    await fetch(`/api/admin/diligence/${engagementId}/gate`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, who, visible }),
    });
  }, [engagementId]);

  const postJson = useCallback(async (path: string, method: string, body: unknown) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Request failed."); }
    return res.json();
  }, [engagementId]);

  const generateDocs = useCallback(async () => {
    try { const d = await postJson("/doc-requests", "POST", { generate: true }); toast({ title: t("generatedRequests", { count: d.count }), variant: "success" }); await reload(); }
    catch (err) { toast({ title: t("couldNotGenerate"), description: err instanceof Error ? err.message : "", variant: "error" }); }
  }, [postJson, reload, toast, t]);

  const addDocRequest = useCallback(async (label: string) => {
    try { await postJson("/doc-requests", "POST", { label, category: "Evidence" }); await reload(); }
    catch (err) { toast({ title: t("couldNotAdd"), description: err instanceof Error ? err.message : "", variant: "error" }); }
  }, [postJson, reload, toast, t]);

  const verifyDoc = useCallback(async (requestId: string) => {
    try { await postJson("/doc-requests", "PATCH", { requestId }); await reload(); }
    catch (err) { toast({ title: t("couldNotVerify"), description: err instanceof Error ? err.message : "", variant: "error" }); }
  }, [postJson, reload, toast, t]);

  const saveCondition = useCallback(async (c: Partial<ConditionRow>) => {
    try { await postJson("/conditions", "POST", c); await reload(); }
    catch (err) { toast({ title: t("couldNotSave"), description: err instanceof Error ? err.message : "", variant: "error" }); }
  }, [postJson, reload, toast, t]);

  const removeCondition = useCallback(async (conditionId: string) => {
    try { await postJson("/conditions", "DELETE", { conditionId }); await reload(); } catch { /* ignore */ }
  }, [postJson, reload]);

  const doRequestConsent = useCallback(async () => {
    setActing(true);
    try {
      const data = await postJson("/consent", "POST", { signer_name: ceoName.trim(), signer_email: ceoEmail.trim() });
      toast({ title: data.delivered ? t("consentSent") : t("consentCreated"), description: data.delivered ? "" : t("shareLink"), variant: "success" });
      setConsentOpen(false); setCeoName(""); setCeoEmail("");
      await reload();
    } catch (err) {
      toast({ title: t("couldNotRequestConsent"), description: err instanceof Error ? err.message : "", variant: "error" });
    } finally { setActing(false); }
  }, [postJson, ceoName, ceoEmail, reload, toast, t]);

  const doRelease = useCallback(async () => {
    if (!(await confirmDialog({ message: t("releaseConfirm"), confirmLabel: t("release") }))) return;
    setActing(true);
    try {
      const data = await postJson("/release", "POST", {});
      toast({ title: t("releasedToInvestors"), description: t("notified", { count: data.notified }), variant: "success" });
      await reload();
    } catch (err) {
      toast({ title: t("couldNotRelease"), description: err instanceof Error ? err.message : "", variant: "error" });
    } finally { setActing(false); }
  }, [postJson, reload, toast, t]);

  useEffect(() => {
    if (tab !== "activity") return;
    let active = true;
    void (async () => {
      try { const res = await fetch(`/api/admin/diligence/${engagementId}/audit`); const d = await res.json(); if (active && res.ok) setAudit(d.audit ?? []); } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [tab, engagementId]);

  const addInvestor = useCallback(async (email: string) => {
    try { await postJson("/members", "POST", { email, role: "investor" }); toast({ title: t("investorAdded"), variant: "success" }); await reload(); }
    catch (err) { toast({ title: t("couldNotAdd"), description: err instanceof Error ? err.message : "", variant: "error" }); }
  }, [postJson, reload, toast, t]);

  if (loading || !detail) return <p className="text-sm text-slate-500">{t("loading")}</p>;
  const { engagement, domains, findings, claims, gate, docRequests, conditions, consent, members, company } = detail;
  const stage = engagement.lifecycle_stage;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6cb0]">{engagement.report_code}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            {engagement.company_name} <StateChip variant={engagement.lifecycle_stage} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">{[engagement.round_label, engagement.sector].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <div className="flex items-center gap-4">
          <a href={`/api/admin/diligence/${engagementId}/export`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileDown className="h-4 w-4" /> {t("pdf")}
          </a>
          {engagement.lifecycle_stage === "draft" ? (
            <button type="button" onClick={() => { if (!aiText && company?.businessDescription) setAiText(company.businessDescription); setAiOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2f6cb0]/30 bg-[#eaf1f9] px-3 py-2 text-sm font-semibold text-[#234f86] hover:bg-[#dceaf7]">
              <Sparkles className="h-4 w-4" /> {t("aiDraft")}
            </button>
          ) : null}
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500">{t("confidence")}</p>
            <ConfidenceMeter pct={engagement.confidence_pct} />
          </div>
        </div>
      </div>

      {aiOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Sparkles className="h-5 w-5 text-[#2f6cb0]" /> {t("aiModalTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("aiModalDesc")}</p>
            <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={10} placeholder={t("aiPlaceholder")} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setAiOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">{t("cancel")}</button>
              <button type="button" onClick={() => void generate()} disabled={generating || aiText.trim().length < 40} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {generating ? t("drafting") : t("generateDraft")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sendOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Send className="h-5 w-5 text-[#2f6cb0]" /> {t("sendModalTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("sendModalDesc")}</p>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">{t("founderEmail")}</span>
              <input type="email" value={founderEmail} onChange={(e) => setFounderEmail(e.target.value)} placeholder="founder@company.com" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              {company?.founderEmail ? <span className="mt-1 block text-xs text-[#1d7a4d]">{t("linkedFounder")}</span> : null}
            </label>
            <div className="mt-3">
              <p className="mb-1.5 text-sm font-medium text-slate-700">{t("visibility")}</p>
              <VisibilityGate gate={sendGate} onToggle={(s, w, v) => setSendGate((g) => ({ ...g, [s]: { ...g[s], [w === "founder" ? "founder_visible" : "investor_visible"]: v } }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSendOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">{t("cancel")}</button>
              <button type="button" onClick={() => void doSend()} disabled={acting || !founderEmail.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("send")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {consentOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><FilePen className="h-5 w-5 text-[#2f6cb0]" /> {t("consentModalTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("consentModalDesc")}</p>
            <label className="mt-3 block"><span className="mb-1 block text-sm font-medium text-slate-700">{t("signerName")}</span>
              <input value={ceoName} onChange={(e) => setCeoName(e.target.value)} placeholder={t("signerNamePh")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="mt-3 block"><span className="mb-1 block text-sm font-medium text-slate-700">{t("signerEmail")}</span>
              <input type="email" value={ceoEmail} onChange={(e) => setCeoEmail(e.target.value)} placeholder="founder@company.com" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConsentOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">{t("cancel")}</button>
              <button type="button" onClick={() => void doRequestConsent()} disabled={acting || !ceoName.trim() || !ceoEmail.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePen className="h-4 w-4" />} {t("sendForSignature")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
        <span className="text-xs font-medium text-slate-500">{t("lifecycle")}</span>
        {stage === "draft" ? (
          <button type="button" onClick={() => { setSendGate(DEFAULT_GATE); setFounderEmail(company?.founderEmail ?? ""); setSendOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-3 py-1.5 text-sm font-semibold text-white">
            <Send className="h-4 w-4" /> {t("sendToFounder")}
          </button>
        ) : null}
        {stage === "responding" ? (
          <button type="button" disabled={acting} onClick={() => void doTransition("mark_review")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {t("markReady")}
          </button>
        ) : null}
        {stage === "admin_review" ? (
          <button type="button" onClick={() => setConsentOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-3 py-1.5 text-sm font-semibold text-white">
            <FilePen className="h-4 w-4" /> {t("requestConsent")}
          </button>
        ) : null}
        {stage === "consent_requested" ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800"><Loader2 className="h-4 w-4 animate-spin" /> {t("awaitingSignature")}</span>
        ) : null}
        {stage === "consented_locked" ? (
          <button type="button" disabled={acting} onClick={() => void doRelease()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d7a4d] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="h-4 w-4" /> {t("lockRelease")}
          </button>
        ) : null}
        {stage !== "draft" && stage !== "consented_locked" && stage !== "released" && stage !== "consent_requested" ? (
          <button type="button" disabled={acting} onClick={() => void doTransition("recall")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Undo2 className="h-4 w-4" /> {t("recall")}
          </button>
        ) : null}
        {consent?.sealedHash ? <span className="ml-auto font-mono text-[11px] text-slate-400" title={t("sealedTitle")}>{t("sealed", { hash: consent.sealedHash.slice(0, 12) })}</span> : null}
      </div>

      {stage !== "draft" ? (
        <details className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">{t("visibilityGate")}</summary>
          <div className="mt-3"><VisibilityGate gate={gate} onToggle={(s, w, v) => void toggleLiveGate(s, w, v)} /></div>
        </details>
      ) : null}

      <details className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">{t("people")} {members?.length ? `(${members.length})` : ""}</summary>
        <InvestorAdder members={members ?? []} onAdd={addInvestor} />
      </details>

      <div className="flex gap-1 border-b border-slate-200">
        {([["findings", "tabFindings"], ["ledger", "tabLedger"], ["dataroom", "tabDataroom"], ["conditions", "tabConditions"], ["activity", "tabActivity"]] as const).map(([tabKey, labelKey]) => (
          <button key={tabKey} type="button" onClick={() => setTab(tabKey)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === tabKey ? "border-[#2f6cb0] text-[#2f6cb0]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === "findings" ? (
        <FindingsRegister findings={findings} domains={domains} onSave={saveFinding} onDelete={removeFinding} />
      ) : tab === "ledger" ? (
        <VerificationLedger claims={claims} findings={findings} onSave={saveClaim} onVerify={verifyClaimState} />
      ) : tab === "dataroom" ? (
        <DataRoom rows={docRequests} onGenerate={generateDocs} onAdd={addDocRequest} onVerify={verifyDoc} />
      ) : tab === "conditions" ? (
        <Conditions rows={conditions} onSave={saveCondition} onDelete={removeCondition} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          {audit.length === 0 ? <p className="p-4 text-sm text-slate-500">{t("noActivity")}</p> : (
            <ol className="divide-y divide-slate-50">
              {audit.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-2 px-4 py-2 text-xs">
                  <span className="w-44 font-mono text-slate-700">{e.action}</span>
                  <span className="text-slate-500">{new Date(e.at).toLocaleString()}</span>
                  <span className="text-slate-400">· {e.actor ?? t("system")}</span>
                  {e.target ? <span className="truncate text-slate-400">· {e.target}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

// ── Findings register ─────────────────────────────────────────────────────────
function FindingsRegister({
  findings, domains, onSave, onDelete,
}: {
  findings: Finding[];
  domains: Domain[];
  onSave: (p: Partial<Finding>) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("diligenceAdmin.workspace");
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-semibold">{t("colCode")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colTitle")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colDomain")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colSeverity")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colStatus")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colVerification")}</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.id} className="border-b border-slate-50 last:border-0 align-top">
              <td className="px-3 py-2 font-mono text-xs text-slate-500">{f.finding_code}</td>
              <td className="px-3 py-2">
                <input defaultValue={f.title} onBlur={(e) => { if (e.target.value !== f.title) onSave({ id: f.id, title: e.target.value }); }}
                  className="w-full rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-300" />
              </td>
              <td className="px-3 py-2">
                <select value={f.domain_id ?? ""} onChange={(e) => onSave({ id: f.id, domain_id: e.target.value || null })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="">—</option>
                  {domains.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
                </select>
              </td>
              <td className="px-3 py-2">
                <select value={f.severity} onChange={(e) => onSave({ id: f.id, severity: e.target.value as Severity })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="high">{t("sevHigh")}</option><option value="medium">{t("sevMedium")}</option><option value="low">{t("sevLow")}</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <select value={f.status} onChange={(e) => onSave({ id: f.id, status: e.target.value as Finding["status"] })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="open">{t("statOpen")}</option><option value="mitigating">{t("statMitigating")}</option><option value="resolved">{t("statResolved")}</option>
                </select>
              </td>
              <td className="px-3 py-2"><StateChip variant={f.verification} /></td>
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={() => onDelete(f.id)} aria-label={t("deleteFinding")} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-3 py-2 text-xs text-slate-400">{t("newRow")}</td>
            <td className="px-3 py-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("newFindingPh")} className="w-full rounded border border-slate-200 px-2 py-1" /></td>
            <td className="px-3 py-2 text-slate-300">—</td>
            <td className="px-3 py-2">
              <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                <option value="high">{t("sevHigh")}</option><option value="medium">{t("sevMedium")}</option><option value="low">{t("sevLow")}</option>
              </select>
            </td>
            <td colSpan={2} />
            <td className="px-3 py-2 text-right">
              <button type="button" disabled={!title.trim()} onClick={() => { onSave({ title: title.trim(), severity }); setTitle(""); setSeverity("medium"); }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2f6cb0] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> {t("add")}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Verification ledger ───────────────────────────────────────────────────────
function VerificationLedger({
  claims, findings, onSave, onVerify,
}: {
  claims: Claim[];
  findings: Finding[];
  onSave: (p: Partial<Claim>) => void;
  onVerify: (id: string, state: Verification) => void;
}) {
  const t = useTranslations("diligenceAdmin.workspace");
  const [text, setText] = useState("");
  const codeOf = (fid: string | null) => findings.find((f) => f.id === fid)?.finding_code ?? "—";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-semibold">{t("colClaim")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colClaimedValue")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colLinked")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colWeight")}</th>
            <th className="px-3 py-2.5 font-semibold">{t("colVerification")}</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-2">{c.claim}</td>
              <td className="px-3 py-2 text-slate-600">{c.claimed_value ?? "—"}</td>
              <td className="px-3 py-2">
                <select value={c.finding_id ?? ""} onChange={(e) => onSave({ id: c.id, finding_id: e.target.value || null })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="">—</option>
                  {findings.map((f) => <option key={f.id} value={f.id}>{f.finding_code}</option>)}
                </select>
              </td>
              <td className="px-3 py-2 text-slate-600">{codeOf(c.finding_id) !== "—" ? `${c.weight}` : c.weight}</td>
              <td className="px-3 py-2">
                <select value={c.verification} onChange={(e) => onVerify(c.id, e.target.value as Verification)} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="unverified">{t("verUnverified")}</option>
                  <option value="requested">{t("verRequested")}</option>
                  <option value="submitted">{t("verSubmitted")}</option>
                  <option value="verified">{t("verVerified")}</option>
                  <option value="discrepancy">{t("verDiscrepancy")}</option>
                </select>
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-3 py-2"><input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("newClaimPh")} className="w-full rounded border border-slate-200 px-2 py-1" /></td>
            <td colSpan={3} />
            <td className="px-3 py-2 text-right">
              <button type="button" disabled={!text.trim()} onClick={() => { onSave({ claim: text.trim() }); setText(""); }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2f6cb0] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> {t("add")}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Data room ─────────────────────────────────────────────────────────────────
function DataRoom({
  rows, onGenerate, onAdd, onVerify,
}: {
  rows: DocRequestRow[];
  onGenerate: () => void;
  onAdd: (label: string) => void;
  onVerify: (id: string) => void;
}) {
  const t = useTranslations("diligenceAdmin.workspace");
  const [label, setLabel] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onGenerate} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2f6cb0]/30 bg-[#eaf1f9] px-3 py-1.5 text-sm font-semibold text-[#234f86] hover:bg-[#dceaf7]">
          <Sparkles className="h-4 w-4" /> {t("generateFromFindings")}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("newRequestPh")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button type="button" disabled={!label.trim()} onClick={() => { onAdd(label.trim()); setLabel(""); }} className="inline-flex items-center gap-1 rounded-lg bg-[#2f6cb0] px-2.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {t("add")}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {rows.length === 0 ? <p className="p-4 text-sm text-slate-500">{t("noRequests")}</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2.5 font-semibold">{t("colRequest")}</th><th className="px-3 py-2.5 font-semibold">{t("colCloses")}</th><th className="px-3 py-2.5 font-semibold">{t("colStatus")}</th><th className="px-3 py-2.5" />
            </tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2"><p className="font-medium text-slate-900">{d.label}</p><p className="text-xs text-slate-500">{d.category}{d.due_date ? ` · ${t("due", { date: d.due_date })}` : ""}</p></td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{d.closes_findings.join(", ") || "—"}</td>
                  <td className="px-3 py-2"><StateChip variant={d.status === "verified" ? "verified" : d.status === "submitted" ? "submitted" : "requested"} /></td>
                  <td className="px-3 py-2 text-right">
                    {d.status !== "verified" ? <button type="button" onClick={() => onVerify(d.id)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-[#1d7a4d] hover:bg-emerald-50">{t("verify")}</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── People ────────────────────────────────────────────────────────────────────
function InvestorAdder({ members, onAdd }: { members: MemberRow[]; onAdd: (email: string) => void }) {
  const t = useTranslations("diligenceAdmin.workspace");
  const [email, setEmail] = useState("");
  return (
    <div className="mt-3 space-y-2">
      {members.length ? (
        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.email} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{m.email}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs capitalize text-slate-600">{m.role}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">{t("noMembers")}</p>}
      <div className="flex items-center gap-2 pt-1">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="investor@fund.com" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        <button type="button" disabled={!email.trim()} onClick={() => { onAdd(email.trim()); setEmail(""); }} className="inline-flex items-center gap-1 rounded-lg bg-[#2f6cb0] px-2.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {t("addInvestor")}</button>
      </div>
      <p className="text-xs text-slate-400">{t("investorNote")}</p>
    </div>
  );
}

// ── Conditions ────────────────────────────────────────────────────────────────
function Conditions({
  rows, onSave, onDelete,
}: {
  rows: ConditionRow[];
  onSave: (c: Partial<ConditionRow>) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("diligenceAdmin.workspace");
  const [label, setLabel] = useState("");
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
          <th className="px-3 py-2.5 font-semibold">{t("colCondition")}</th><th className="px-3 py-2.5 font-semibold">{t("colStatus")}</th><th className="px-3 py-2.5" />
        </tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-2"><input defaultValue={c.label} onBlur={(e) => { if (e.target.value !== c.label) onSave({ id: c.id, label: e.target.value }); }} className="w-full rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-300" /></td>
              <td className="px-3 py-2">
                <select value={c.status} onChange={(e) => onSave({ id: c.id, status: e.target.value })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="not_started">{t("condNotStarted")}</option><option value="in_progress">{t("condInProgress")}</option><option value="done">{t("condDone")}</option>
                </select>
              </td>
              <td className="px-3 py-2 text-right"><button type="button" onClick={() => onDelete(c.id)} aria-label={t("deleteCondition")} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}
          <tr>
            <td className="px-3 py-2"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("newConditionPh")} className="w-full rounded border border-slate-200 px-2 py-1" /></td>
            <td />
            <td className="px-3 py-2 text-right"><button type="button" disabled={!label.trim()} onClick={() => { onSave({ label: label.trim() }); setLabel(""); }} className="inline-flex items-center gap-1 rounded-lg bg-[#2f6cb0] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> {t("add")}</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
