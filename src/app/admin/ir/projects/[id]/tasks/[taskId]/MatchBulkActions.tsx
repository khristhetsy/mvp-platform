"use client";

/**
 * Task form › Matching tab: the Odoo selection bar ("N selected → Select all M ×") and
 * its Actions menu for the checked investors — Email (the shared mass-email dialog with a
 * rendered preview and the project's merge tags), Enroll in sequence (IR auto sequences),
 * Move to stage, Assign owner, Mark intro sent, Export CSV, Remove from project.
 * Each action reuses the per-record IR endpoints, one call per investor.
 */
import { useCallback, useEffect, useState } from "react";
import { SelectionBar, ActionResult, type SelectionAction } from "@/components/admin/sales/SelectionBar";
import { MassEmailComposer, type ShareOption } from "@/components/marketing/MassEmailComposer";
import { downloadCsv } from "@/components/admin/ToolbarGear";
import { SEQUENCE_TEMPLATES, type SequenceStep, type StopEvent } from "@/lib/ir/sequence-templates";
import { IR_STAGES, IR_STAGE_LABEL, type IrMatch, type IrProject } from "@/lib/ir/types";
import type { EntrepreneurProfile } from "@/lib/ir/db";

type Contact = { email: string | null; phone: string | null; country: string | null; membership: string | null };

export function MatchBulkActions({ matches, contacts, project, entrepreneur, staff, selected, setSelected, onChange }: {
  matches: IrMatch[]; contacts: Record<string, Contact>; project: IrProject; entrepreneur: EntrepreneurProfile | null;
  staff: Array<{ id: string; name: string }>; selected: Set<string>; setSelected: (s: Set<string>) => void; onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [composer, setComposer] = useState<null | "once" | "sequence">(null);
  // The founder's published one-pager: undefined while loading, null when none is published.
  const [onePager, setOnePager] = useState<{ url: string; label: string } | null | undefined>(undefined);
  // Whether the project is linked to its company, and companies to offer when it isn't.
  const [link, setLink] = useState<{ linked: boolean; suggestions: Array<{ id: string; name: string }> } | null>(null);
  // The linked company's files, for the term sheet picker and the data room row.
  const [room, setRoom] = useState<{ companyId: string | null; companyName: string | null; documents: Array<{ id: string; name: string; type: string | null }> } | null>(null);
  const [termDoc, setTermDoc] = useState("");
  const [termUpload, setTermUpload] = useState<{ path: string; name: string } | null>(null);
  const [termBusy, setTermBusy] = useState(false);
  const [termErr, setTermErr] = useState<string | null>(null);
  const [expiresDays, setExpiresDays] = useState<number | null>(30);
  const [linking, setLinking] = useState(false);
  const loadAttachables = useCallback(() => {
    void fetch(`/api/admin/ir/projects/${project.id}/one-pager`).then((r) => (r.ok ? r.json() : { onePager: null }))
      .then((d) => { setOnePager(d.onePager ? { url: d.onePager.url, label: d.onePager.companyName ?? project.founder_name ?? project.title } : null); setLink({ linked: d.linked ?? true, suggestions: d.suggestions ?? [] }); })
      .catch(() => setOnePager(null));
    void fetch(`/api/admin/ir/projects/${project.id}/share-links`).then((r) => (r.ok ? r.json() : null)).then((d) => setRoom(d ?? { companyId: null, companyName: null, documents: [] })).catch(() => setRoom({ companyId: null, companyName: null, documents: [] }));
  }, [project.id, project.founder_name, project.title]);
  useEffect(() => {
    if (!composer || onePager !== undefined) return;
    loadAttachables();
  }, [composer, onePager, loadAttachables]);
  async function linkCompany(companyId: string) {
    setLinking(true);
    try {
      const r = await fetch(`/api/admin/ir/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
      if (r.ok) loadAttachables();
    } finally { setLinking(false); }
  }
  async function uploadTermSheet(f: File | undefined) {
    if (!f) return;
    setTermErr(null);
    if (f.size > 4 * 1024 * 1024) { setTermErr("That file is over 4 MB. Pick it from the company's files instead."); return; }
    setTermBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/email/attachments", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.attachment) { setTermErr(j.error ?? "Couldn't upload the term sheet."); return; }
      setTermUpload({ path: j.attachment.path, name: f.name }); setTermDoc("");
    } finally { setTermBusy(false); }
  }
  const picked = matches.filter((m) => selected.has(m.id));

  /** Runs one request per picked investor; returns how many succeeded. */
  async function each(run: (m: IrMatch) => Promise<Response>, list: IrMatch[] = picked): Promise<number> {
    let ok = 0;
    for (const m of list) { try { if ((await run(m)).ok) ok++; } catch { /* counted as failed */ } }
    return ok;
  }
  async function bulk(label: string, run: (m: IrMatch) => Promise<Response>, clear = false) {
    setBusy(true); setResult(null);
    try {
      const n = picked.length;
      const ok = await each(run);
      setResult(ok === n ? `${label} ${ok} investor${ok === 1 ? "" : "s"}.` : `${label} ${ok} of ${n}; ${n - ok} failed.`);
      if (clear) setSelected(new Set());
      await onChange();
    } finally { setBusy(false); }
  }
  const patch = (body: Record<string, unknown>) => (m: IrMatch) => fetch(`/api/admin/ir/matches/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const introSent = (m: IrMatch) => fetch(`/api/admin/ir/matches/${m.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "intro_sent" }) });

  function exportCsv() {
    downloadCsv(`${project.title.replace(/[^\w-]+/g, "_")}_investors.csv`, ["Name", "Company", "Email", "Phone", "Country", "Stage", "Fit tier", "Data source", "Assignee"],
      picked.map((m) => { const c = contacts[m.investor_contact_id]; return [m.investor_name, m.investor_firm, c?.email, c?.phone, c?.country, IR_STAGE_LABEL[m.stage], m.fit_tier, m.data_source, m.assignee_name]; }));
    setResult(`Exported ${picked.length} investor${picked.length === 1 ? "" : "s"}.`);
  }

  const actions: SelectionAction[] = [
    { key: "email", icon: "ti-mail", label: "Email", run: () => setComposer("once") },
    { key: "enroll", icon: "ti-send", label: "Enroll in sequence", run: () => setComposer("sequence") },
    { key: "stage", icon: "ti-arrow-right", label: "Move to stage", options: IR_STAGES.map((s) => ({ value: s, label: IR_STAGE_LABEL[s] })), runWith: (stage) => void bulk(`Moved to ${IR_STAGE_LABEL[stage as keyof typeof IR_STAGE_LABEL]}:`, patch({ stage })) },
    { key: "owner", icon: "ti-user", label: "Assign owner", options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))], runWith: (id) => void bulk("Reassigned", patch({ assigneeId: id || null })) },
    { key: "intro", icon: "ti-circle-check", label: "Mark intro sent", run: () => void bulk("Marked intro sent for", introSent) },
    { key: "export", icon: "ti-download", label: "Export CSV", run: exportCsv },
    { key: "remove", icon: "ti-x", label: "Remove from project", danger: true, run: () => {
      if (!window.confirm(`Remove ${picked.length} investor${picked.length === 1 ? "" : "s"} from ${project.title}? Their activities and stage history on this project go too.`)) return;
      void bulk("Removed", (m) => fetch(`/api/admin/ir/matches/${m.id}`, { method: "DELETE" }), true);
    } },
  ];

  // Project-level merge tags, filled in before the send; {{first_name}} / {{company}} stay per investor.
  const e = entrepreneur;
  const extraMerge: Record<string, string> = {
    founder_name: e?.founder ?? project.founder_name ?? "",
    founder_company: e?.company ?? project.title,
    raise: e?.raise ?? "",
    stage: e?.stage ?? "",
    sectors: e?.industry ?? "",
  };
  const withEmail = picked.filter((m) => contacts[m.investor_contact_id]?.email);
  const small = { fontSize: 12, padding: "4px 7px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const notice = link && !link.linked ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "7px 10px", borderRadius: 8, background: "#FAEEDA", color: "#633806", fontSize: 12, marginBottom: 6 }}>
      <i className="ti ti-link" aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 160 }}>This project isn&rsquo;t linked to a company, so its one-pager and files can&rsquo;t be attached.</span>
      {link.suggestions.length ? link.suggestions.slice(0, 2).map((c) => (
        <button key={c.id} type="button" disabled={linking} onClick={() => void linkCompany(c.id)} style={{ border: "none", background: "none", color: "#633806", fontWeight: 600, textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 12 }}>Link {c.name}</button>
      )) : <a href={`/admin/ir/projects/${project.id}`} style={{ color: "#633806", fontWeight: 600 }}>Link it on the project</a>}
    </div>
  ) : null;
  const docs = room?.documents ?? [];
  const termName = termUpload?.name ?? docs.find((d) => d.id === termDoc)?.name ?? null;
  const shares: ShareOption[] = [
    {
      key: "term_sheet", icon: "ti-file-certificate", title: "Term sheet", buttonLabel: "View the term sheet", ready: !!(termDoc || termUpload),
      detail: termName ? `${termName} · sent as a tracked view link` : "Pick one of the company's files or upload it",
      control: (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <select value={termDoc} onChange={(e) => { setTermDoc(e.target.value); if (e.target.value) setTermUpload(null); }} aria-label="Term sheet file" style={{ ...small, maxWidth: 260 }}>
            <option value="">{docs.length ? "Pick a company file…" : "No company files"}</option>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.type ? ` · ${d.type.replace(/_/g, " ").toLowerCase()}` : ""}</option>)}
          </select>
          <label style={{ fontSize: 12, color: "#185FA5", cursor: "pointer" }}>
            <input type="file" hidden accept=".pdf,.doc,.docx" onChange={(e) => { void uploadTermSheet(e.target.files?.[0]); e.target.value = ""; }} />
            {termBusy ? "Uploading…" : "or upload"}
          </label>
          {termErr ? <span style={{ fontSize: 11, color: "#A32D2D" }}>{termErr}</span> : null}
        </div>
      ),
    },
    {
      key: "data_room", icon: "ti-folder-lock", title: "Data room access", buttonLabel: "Open the data room", ready: !!room?.companyId && docs.length > 0,
      badge: room?.companyId ? `${docs.length} doc${docs.length === 1 ? "" : "s"}` : null,
      detail: !room?.companyId ? "Link the project to a company first" : docs.length ? `Private link per investor · view only · ${expiresDays ? `expires in ${expiresDays} days` : "no expiry"}` : `${room.companyName ?? "The company"} has no files yet`,
      control: room?.companyId && docs.length ? (
        <label style={{ fontSize: 12, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 6 }}>Expires
          <select value={expiresDays ?? 0} onChange={(e) => setExpiresDays(Number(e.target.value) || null)} style={small}>
            {[7, 14, 30, 90].map((n) => <option key={n} value={n}>in {n} days</option>)}
            <option value={0}>never</option>
          </select>
        </label>
      ) : undefined,
    },
  ];
  async function resolveShares(keys: string[], ctx: { testEmail?: string }) {
    const r = await fetch(`/api/admin/ir/projects/${project.id}/share-links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kinds: keys, matchIds: picked.map((m) => m.id), documentId: termDoc || null, upload: termUpload, expiresDays, testEmail: ctx.testEmail ?? null }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.error ?? "Couldn't make the links." };
    return { buttons: (j.links ?? []).map((l: { label: string; url: string }) => ({ label: l.label, url: l.url })) };
  }
  const previewAs = withEmail.map((m) => ({ label: m.investor_name ?? m.investor_firm ?? "Investor", first_name: (m.investor_name ?? "").trim().split(/\s+/)[0] || "there", company: m.investor_firm ?? "" }));

  return (
    <>
      <SelectionBar count={selected.size} total={matches.length} onSelectAll={() => setSelected(new Set(matches.map((m) => m.id)))} onClear={() => setSelected(new Set())} actions={actions} busy={busy} heading="Selected investors" />
      <ActionResult text={result} onClose={() => setResult(null)} />
      {composer ? (
        <MassEmailComposer
          source="contacts" noun="investor" initialMode={composer}
          selection={{ mode: "ids", ids: [...new Set(picked.map((m) => m.investor_contact_id))], count: picked.length }}
          extraMerge={extraMerge} previewAs={previewAs} defaultDepartment="Investor Relations" onePager={onePager} allowAttachments
          notice={notice} shares={shares} resolveShares={resolveShares}
          renderSequence={(done) => <IrSequencePanel matchIds={picked.map((m) => m.id)} staff={staff} ownerId={project.owner_id} onDone={(msg) => { done(msg); void onChange(); }} />}
          onSent={(sent) => {
            // A sent intro completes each still-Matched investor's "Send intro email" to-do.
            if (sent > 0) void each(introSent, withEmail.filter((m) => m.stage === "matched")).then(() => onChange());
          }}
          onClose={() => { setComposer(null); void onChange(); }}
        />
      ) : null}
    </>
  );
}

type SavedSequence = { id: string; name: string; steps: SequenceStep[]; stop_on: StopEvent[] };
type EmailTemplate = { id: string; name: string; subject: string; html_body: string; department: string | null };
type Draft = { name: string; steps: SequenceStep[]; stopOn: StopEvent[] };

/** An email template's HTML as a plain-text step body, with its merge tags in the sequence's {first} / {founder} form. */
function templateToStep(t: EmailTemplate): { subject: string; body: string } {
  const toSeq = (x: string) => x.replace(/\{\{\s*first_name\s*\}\}/g, "{first}").replace(/\{\{\s*founder_name\s*\}\}/g, "{founder}");
  const text = t.html_body
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { subject: toSeq(t.subject), body: toSeq(text) };
}

/** Enroll in sequence for IR: the auto sequences the matching queue starts (built-in and saved), on the picked investors. */
function IrSequencePanel({ matchIds, staff, ownerId, onDone }: { matchIds: string[]; staff: Array<{ id: string; name: string }>; ownerId: string; onDone: (msg: string) => void }) {
  const [template, setTemplate] = useState(Object.keys(SEQUENCE_TEMPLATES)[0]);
  const [saved, setSaved] = useState<SavedSequence[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [via, setVia] = useState<"icapos" | "gmail">("icapos");
  const [manager, setManager] = useState(staff.some((s) => s.id === ownerId) ? ownerId : staff[0]?.id ?? "");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sel = { fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", width: "100%", boxSizing: "border-box" as const, marginBottom: 10 };
  const small = { fontSize: 12.5, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", boxSizing: "border-box" as const, background: "var(--background)", color: "var(--foreground)" };

  useEffect(() => {
    fetch("/api/admin/ir/sequence-templates").then((r) => (r.ok ? r.json() : { templates: [] })).then((d) => setSaved(d.templates ?? [])).catch(() => {});
    fetch("/api/marketing/templates").then((r) => (r.ok ? r.json() : { templates: [] })).then((d) => setEmailTemplates(d.templates ?? [])).catch(() => {});
  }, []);

  const options: Array<{ key: string; name: string; steps: SequenceStep[] }> = [
    ...Object.entries(SEQUENCE_TEMPLATES).map(([k, t]) => ({ key: k, name: t.name, steps: t.steps })),
    ...saved.map((t) => ({ key: t.id, name: t.name, steps: t.steps })),
  ];
  const chosen = options.find((o) => o.key === template);
  const savedChosen = saved.find((t) => t.id === template);
  // Email templates for step prefill, Investor Relations first.
  const irFirst = [...emailTemplates].sort((a, b) => Number(b.department === "Investor Relations") - Number(a.department === "Investor Relations"));

  function newSequence() {
    setErr(null);
    setDraft({ name: "", steps: [{ day: 0, subject: "", body: "" }], stopOn: ["reply", "meeting"] });
  }
  const setStep = (i: number, p: Partial<SequenceStep>) => draft && setDraft({ ...draft, steps: draft.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  async function enroll(key: string, name: string, stopOn: StopEvent[]) {
    const r = await fetch("/api/admin/ir/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchIds, template: key, via, managerId: manager, notifyEmail, stopOn }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Couldn't start the sequence."); return; }
    const skipped = (j.skipped ?? []).length;
    onDone(`Started ${j.started ?? 0} on ${name}${skipped ? `, ${skipped} skipped` : ""}. The first emails go out within 15 minutes.`);
  }
  async function start() {
    if (!manager) { setErr("Pick an account manager."); return; }
    setBusy(true); setErr(null);
    try { await enroll(template, chosen?.name ?? "the sequence", savedChosen?.stop_on ?? ["reply", "meeting"]); } finally { setBusy(false); }
  }
  async function saveAndEnroll() {
    if (!draft) return;
    if (!draft.name.trim()) { setErr("Name the sequence."); return; }
    if (draft.steps.some((s) => !s.subject.trim() || !s.body.trim())) { setErr("Every step needs a subject and a body."); return; }
    if (!manager) { setErr("Pick an account manager."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/admin/ir/sequence-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: draft.name.trim(), steps: draft.steps, stopOn: draft.stopOn }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.template) { setErr(j.error ?? "Couldn't save the sequence."); return; }
      const t = j.template as SavedSequence;
      setSaved((xs) => [...xs, t]); setTemplate(t.id); setDraft(null);
      await enroll(t.id, t.name, t.stop_on);
    } finally { setBusy(false); }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", margin: "0 0 3px" }}>
        <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: 0 }}>Sequence</p>
        {!draft ? <button type="button" onClick={newSequence} style={{ marginLeft: "auto", fontSize: 11.5, border: "none", background: "none", color: "#185FA5", cursor: "pointer", padding: 0 }}><i className="ti ti-plus" aria-hidden="true" /> New sequence</button> : null}
      </div>
      {!draft ? (
        <select value={template} onChange={(e) => setTemplate(e.target.value)} style={sel}>
          {options.map((o) => <option key={o.key} value={o.key}>{o.name} · {o.steps.length} steps (days {o.steps.map((s) => s.day).join(", ")})</option>)}
        </select>
      ) : (
        <div style={{ border: "1px solid #B5D4F4", borderRadius: 9, padding: "10px 12px", marginBottom: 10 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, margin: "0 0 8px" }}>New sequence</p>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Investor thesis nudge" aria-label="Sequence name" style={{ ...small, width: "100%", marginBottom: 8 }} />
          <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 4px" }}>Steps · merge: {"{first}"} {"{founder}"}</p>
          {draft.steps.map((st, i) => (
            <div key={i} style={{ border: "0.5px solid var(--border)", borderRadius: 8, padding: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>Day <input type="number" min={0} max={365} value={st.day} onChange={(e) => setStep(i, { day: Math.max(0, Math.round(Number(e.target.value) || 0)) })} style={{ ...small, width: 60 }} /></label>
                <select value="" onChange={(e) => { const t = emailTemplates.find((x) => x.id === e.target.value); if (t) setStep(i, templateToStep(t)); }} aria-label="Fill from a template" style={{ ...small, flex: 1, minWidth: 0 }}>
                  <option value="">Fill from a template…</option>
                  {irFirst.map((t) => <option key={t.id} value={t.id}>{t.department ? `${t.department} · ` : ""}{t.name}</option>)}
                </select>
                {draft.steps.length > 1 ? <button type="button" aria-label={`Remove step ${i + 1}`} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><i className="ti ti-x" aria-hidden="true" /></button> : null}
              </div>
              <input value={st.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Subject" aria-label={`Step ${i + 1} subject`} style={{ ...small, width: "100%", marginBottom: 6 }} />
              <textarea value={st.body} onChange={(e) => setStep(i, { body: e.target.value })} rows={3} placeholder={"Hi {first},\n\n…"} aria-label={`Step ${i + 1} body`} style={{ ...small, width: "100%", resize: "vertical" }} />
            </div>
          ))}
          <button type="button" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { day: (draft.steps[draft.steps.length - 1]?.day ?? 0) + 7, subject: "", body: "" }] })} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)", marginBottom: 8 }}><i className="ti ti-plus" aria-hidden="true" /> Add step</button>
          <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 4px" }}>Stop rules</p>
          <div style={{ display: "flex", gap: 14, fontSize: 12.5 }}>
            {([["reply", "Stop on reply"], ["meeting", "Stop on meeting booked"]] as const).map(([k, l]) => (
              <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={draft.stopOn.includes(k)} onChange={(e) => setDraft({ ...draft, stopOn: e.target.checked ? [...draft.stopOn, k] : draft.stopOn.filter((x) => x !== k) })} /> {l}
              </label>
            ))}
          </div>
        </div>
      )}
      <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Account manager to alert</p>
      <select value={manager} onChange={(e) => setManager(e.target.value)} style={sel}>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div style={{ display: "flex", gap: 16, fontSize: 12.5, marginBottom: 8 }}>
        {(["icapos", "gmail"] as const).map((k) => <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" name="ir-bulk-via" checked={via === k} onChange={() => setVia(k)} /> {k === "icapos" ? "iCapOS" : "Gmail"}</label>)}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} /> Email the alerts too (always in iCapOS notifications)</label>
      <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 8, padding: "8px 11px", margin: "0 0 12px", lineHeight: 1.5 }}>
        Alerts on opens, clicks, replies and meetings; stops on a reply or meeting.{via === "gmail" ? " Opens and clicks can’t be tracked on Gmail sends." : ""}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: err ? "#A32D2D" : "var(--muted-foreground)" }}>{err ?? "Investors already on a sequence are skipped."}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {draft ? <button type="button" onClick={() => { setDraft(null); setErr(null); }} style={{ fontSize: 12.5, padding: "8px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>Cancel</button> : null}
          <button type="button" onClick={() => void (draft ? saveAndEnroll() : start())} disabled={busy || !manager} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Starting…" : draft ? `Save and enroll · ${matchIds.length}` : `Enroll · ${matchIds.length}`}
          </button>
        </div>
      </div>
    </>
  );
}
