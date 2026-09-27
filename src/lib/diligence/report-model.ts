// Diligence report model (§14 v2). Pure: turns a role-filtered ReportPayload plus
// optional staff-only extras into the exact sections the PDF draws. Keeping this
// separate from pdfkit lets tests assert what each recipient can and cannot see.

import type { ReportPayload } from "./serialize";
import type { DiligenceRole } from "./types";

type Row = Record<string, unknown>;

/** Per-company metrics from the admin Due Diligence report (company_diligence row). Staff only. */
export type CompanySnapshot = {
  company_name?: string | null;
  latest_readiness_score?: number | null;
  risk_score?: number | null;
  document_count?: number;
  pitch_deck_present?: boolean;
  documents_approved_count?: number;
  missing_required_documents?: string | string[];
  remediation_open?: number;
  remediation_completed?: number;
  remediation_high_priority_open?: number;
  open_compliance_events?: number;
  flagged_outreach_social_message_indicators?: number;
  expressed_interest_count?: number;
  indicative_pledge_total?: number;
  intro_request_count?: number;
  message_thread_count?: number;
  meetings_scheduled_count?: number;
  learning_modules_completed?: number;
};

export type ReportVersionInfo = { version: string; status: string; document_hash: string | null; created_at: string | null };
export type ConsentInfo = { status: string; signerCount: number; completed_at: string | null };
export type AuditEntry = { at: string; actor: string; action: string; target: string | null };
export type GateCell = { founder: boolean; investor: boolean };

export type ReportExtras = {
  snapshot?: CompanySnapshot | null;
  version?: ReportVersionInfo | null;
  consent?: ConsentInfo | null;
  audit?: AuditEntry[];
  gate?: Record<string, GateCell>;
  generatedBy?: string | null;
  generatedAt?: Date;
  /** True when the report is for a company with no dd_engagements row. */
  noEngagement?: boolean;
};

export type Tone = "high" | "medium" | "low" | "good" | "bad" | "neutral";
export type Cell = string | { pill: string; tone: Tone };
export type Table = { columns: { label: string; width: number; align?: "left" | "right" | "center"; mono?: boolean }[]; rows: Cell[][] };
export type Metric = { value: string; label: string; alert?: boolean };
export type Takeaway = { title: string; body: string };
export type Section = {
  key: string;
  title: string;
  internal?: boolean;
  intro?: string;
  bar?: { segments: { value: number; label: string; color: string }[]; caption?: string };
  metrics?: Metric[];
  table?: Table;
  empty?: string;
  notes?: { heading: string; lines: string[]; internal?: string }[];
  checklist?: { label: string; detail?: string; done: boolean; status: Cell }[];
  keyValues?: [string, string][];
  paragraphs?: string[];
};

export type ReportModel = {
  role: DiligenceRole;
  audienceLabel: string;
  company: string;
  reportCode: string;
  versionLabel: string;
  generatedAt: Date;
  generatedBy: string | null;
  stages: string[];
  stageIndex: number;
  verdict: { released: boolean; recommendation: string | null; posture: string | null; placeholder: string };
  confidence: number | null;
  riskLevel: number | null;
  readiness: { score: number | null } | null;
  findingCounts: { total: number; open: number; high: number; medium: number; low: number; highOpen: number };
  metrics: Metric[];
  takeaways: Takeaway[];
  sections: Section[];
};

export const STAGES: { key: string; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "sent_to_founder", label: "Sent to founder" },
  { key: "responding", label: "Founder responding" },
  { key: "admin_review", label: "iCFO review" },
  { key: "consent_requested", label: "Consent requested" },
  { key: "consented_locked", label: "Signed & locked" },
  { key: "released", label: "Released" },
];

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const title = (v: unknown) => str(v).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const dateOnly = (v: unknown) => (v ? str(v).slice(0, 10) : "—");

const SEV_TONE: Record<string, Tone> = { high: "high", medium: "medium", low: "low" };
const VERIFY_TONE: Record<string, Tone> = { verified: "good", discrepancy: "bad", submitted: "medium", requested: "medium", unverified: "neutral" };
const STATUS_TONE: Record<string, Tone> = { verified: "good", done: "good", resolved: "good", accepted: "good", submitted: "medium", in_progress: "medium", mitigating: "medium", needs_more: "medium", requested: "medium", open: "neutral", not_started: "neutral" };
const DISPOSITION_TONE: Record<string, Tone> = { agree: "low", remediating: "medium", clarify: "neutral", dispute: "high", awaiting: "neutral" };

const pill = (v: unknown, map: Record<string, Tone>): Cell => (v ? { pill: title(v), tone: map[str(v)] ?? "neutral" } : "—");

export function buildReportModel(payload: ReportPayload, role: DiligenceRole, extras: ReportExtras = {}): ReportModel {
  const isAdmin = role === "admin";
  // Staff-only extras are dropped for any non-admin recipient, whatever the caller passed.
  const snapshot = isAdmin ? extras.snapshot ?? null : null;
  const audit = isAdmin ? extras.audit ?? [] : [];
  const gate = isAdmin ? extras.gate : undefined;

  const eng = payload.engagement as Row;
  const company = str(eng.company_name) || str(snapshot?.company_name) || "Company";
  const reportCode = str(eng.report_code) || "—";
  const version = extras.version ?? null;
  const versionLabel = version ? `${version.version} · ${title(version.status)}` : "Draft";
  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.key === str(eng.lifecycle_stage)));

  const findings = payload.findings as Row[];
  const domains = payload.domains as Row[];
  const isOpen = (f: Row) => str(f.status) !== "resolved";
  const counts = {
    total: findings.length,
    open: findings.filter(isOpen).length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    highOpen: findings.filter((f) => f.severity === "high" && isOpen(f)).length,
  };

  const recommendation = str(eng.recommendation) || null;
  const posture = str(eng.posture) || null;
  const released = Boolean(recommendation || posture);
  const verdict = {
    released,
    recommendation,
    posture,
    placeholder: extras.noEngagement ? "No diligence engagement opened" : isAdmin ? "Not yet recorded" : "Not released to this recipient",
  };

  // ── Metrics ────────────────────────────────────────────────────────────
  const docRequests = payload.docRequests as Row[];
  const conditions = payload.conditions as Row[];
  const conditionsDone = conditions.filter((c) => c.status === "done").length;
  const requestsOutstanding = docRequests.filter((d) => d.status !== "verified").length;
  let metrics: Metric[];
  if (snapshot) {
    const done = num(snapshot.remediation_completed);
    const total = done + num(snapshot.remediation_open);
    metrics = [
      { value: String(num(snapshot.document_count)), label: "Documents on file" },
      { value: `${done}/${total}`, label: "Remediation tasks done" },
      { value: String(num(snapshot.remediation_high_priority_open)), label: "High priority open", alert: num(snapshot.remediation_high_priority_open) > 0 },
      { value: String(num(snapshot.open_compliance_events)), label: "Compliance events", alert: num(snapshot.open_compliance_events) > 0 },
      { value: String(num(snapshot.expressed_interest_count)), label: "Investor interests" },
    ];
  } else {
    metrics = [
      { value: String(counts.total), label: "Findings" },
      { value: String(counts.highOpen), label: "High severity open", alert: counts.highOpen > 0 },
      { value: String(requestsOutstanding), label: "Requests outstanding" },
      { value: `${conditionsDone}/${conditions.length}`, label: "Conditions done" },
      { value: String((payload.responses as Row[]).length), label: "Responses filed" },
    ];
  }

  // ── Takeaways: each one derived from a stored value, never estimated ───
  const claims = isAdmin ? ((payload.claims ?? []) as Row[]) : [];
  const discrepancies = claims.filter((c) => c.verification === "discrepancy").length;
  const t: Takeaway[] = [];
  if (extras.noEngagement) t.push({ title: "No diligence engagement opened.", body: "Findings, claims and founder responses start once an engagement is created for this company." });
  if (snapshot && snapshot.latest_readiness_score == null) t.push({ title: "Readiness is unscored.", body: "Without a Capital Readiness Rating the company cannot be benchmarked or matched to investors. Completing the assessment is the gating item." });
  if (counts.highOpen > 0) t.push({ title: `${counts.highOpen} high severity finding${counts.highOpen === 1 ? "" : "s"} open.`, body: `${counts.open} of ${counts.total} findings are open in total. Each is listed in the findings register with its evidence state.` });
  if (discrepancies > 0) t.push({ title: `${discrepancies} claim${discrepancies === 1 ? "" : "s"} contradicted by evidence.`, body: "See the claim verification section; each discrepancy links to a finding." });
  if (snapshot && num(snapshot.remediation_high_priority_open) > 0) {
    const done = num(snapshot.remediation_completed);
    t.push({ title: `${num(snapshot.remediation_high_priority_open)} of ${num(snapshot.remediation_open)} open remediation tasks are high priority.`, body: `${done} of ${done + num(snapshot.remediation_open)} tasks are complete.` });
  }
  if (conditions.length && conditionsDone < conditions.length) t.push({ title: `${conditions.length - conditionsDone} of ${conditions.length} closing conditions not done.`, body: "Listed with status in the conditions section." });
  if (snapshot && num(snapshot.open_compliance_events) === 0 && num(snapshot.expressed_interest_count) === 0) t.push({ title: "Clean compliance record, no investor traction yet.", body: `${num(snapshot.flagged_outreach_social_message_indicators)} flagged outreach and 0 expressed interests, intro requests or meetings recorded.` });
  if (t.length === 0) t.push({ title: "No open issues recorded.", body: "All recorded findings and conditions are closed." });

  // ── Sections ───────────────────────────────────────────────────────────
  const sections: Section[] = [];
  const domainById = new Map(domains.map((d) => [str(d.id), d]));
  const findingCode = new Map(findings.map((f) => [str(f.id), str(f.finding_code)]));

  if (domains.length) {
    sections.push({
      key: "domains",
      title: "Risk by domain",
      intro: "One analyst rating per domain. Counts come from the findings register, so the two always agree.",
      table: {
        columns: [
          { label: "Domain", width: 0.26 },
          { label: "Rating", width: 0.12 },
          { label: "Findings", width: 0.1, align: "right" },
          { label: "Open", width: 0.08, align: "right" },
          { label: "Conclusion", width: 0.44 },
        ],
        rows: domains.map((d) => {
          const fs = findings.filter((f) => str(f.domain_id) === str(d.id));
          return [str(d.name) || str(d.code), pill(d.risk_rating, SEV_TONE), String(fs.length), String(fs.filter(isOpen).length), str(d.conclusion) || "—"];
        }),
      },
      notes: domains
        .filter((d) => d.overview || (Array.isArray(d.strengths) && d.strengths.length) || (Array.isArray(d.mitigation) && d.mitigation.length))
        .map((d) => ({
          heading: `${str(d.code)} ${str(d.name)}`.trim(),
          lines: [
            ...(d.overview ? [str(d.overview)] : []),
            ...((Array.isArray(d.strengths) ? d.strengths : []) as unknown[]).map((s) => `Strength: ${str(s)}`),
            ...((Array.isArray(d.mitigation) ? d.mitigation : []) as unknown[]).map((s) => `Mitigation: ${str(s)}`),
          ],
        })),
    });
  }

  sections.push({
    key: "findings",
    title: "Findings register",
    empty: "No findings disclosed.",
    table: findings.length
      ? {
          columns: [
            { label: "Code", width: 0.1, mono: true },
            { label: "Finding", width: 0.32 },
            { label: "Domain", width: 0.17 },
            { label: "Severity", width: 0.12 },
            { label: "Status", width: 0.12 },
            { label: "Evidence", width: 0.17 },
          ],
          rows: findings.map((f) => [
            str(f.finding_code),
            str(f.title),
            str(domainById.get(str(f.domain_id))?.name) || "—",
            pill(f.severity, SEV_TONE),
            pill(f.status, STATUS_TONE),
            pill(f.verification, VERIFY_TONE),
          ]),
        }
      : undefined,
    notes: findings
      .filter((f) => f.detail || f.source || (isAdmin && f.internal_note))
      .map((f) => ({
        heading: `${str(f.finding_code)} ${str(f.title)}`.trim(),
        lines: [...(f.detail ? [str(f.detail)] : []), ...(f.source ? [`Source: ${str(f.source)}`] : [])],
        internal: isAdmin && f.internal_note ? str(f.internal_note) : undefined,
      })),
  });

  if (isAdmin && claims.length) {
    const tally = (s: string) => claims.filter((c) => str(c.verification) === s).length;
    sections.push({
      key: "claims",
      title: "Claim verification",
      internal: true,
      intro: "Every material number the founder asserts is logged as a claim and traced to a source. Weight reflects how much the claim moves the investment case.",
      bar: {
        segments: [
          { value: tally("verified"), label: "Verified", color: "#1E4E8C" },
          { value: tally("submitted"), label: "Submitted", color: "#6F95C4" },
          { value: tally("requested"), label: "Requested", color: "#E0A33A" },
          { value: tally("unverified"), label: "Unverified", color: "#B8C0CC" },
          { value: tally("discrepancy"), label: "Discrepancy", color: "#7C2D12" },
        ],
      },
      table: {
        columns: [
          { label: "Claim", width: 0.3 },
          { label: "Claimed value", width: 0.16 },
          { label: "Source asserted", width: 0.19 },
          { label: "Weight", width: 0.09, align: "right" },
          { label: "Status", width: 0.15 },
          { label: "Finding", width: 0.11, mono: true },
        ],
        rows: claims.map((c) => [str(c.claim), str(c.claimed_value) || "—", str(c.source_asserted) || "—", String(num(c.weight)), pill(c.verification, VERIFY_TONE), findingCode.get(str(c.finding_id)) || "—"]),
      },
    });
  }

  if (docRequests.length || snapshot) {
    const missing = snapshot?.missing_required_documents;
    const missingList = Array.isArray(missing) ? missing : str(missing).split(";").map((s) => s.trim()).filter(Boolean);
    sections.push({
      key: "dataroom",
      title: "Data room and document requests",
      metrics: snapshot
        ? [
            { value: String(num(snapshot.document_count)), label: "Documents on file" },
            { value: snapshot.pitch_deck_present ? "Yes" : "No", label: "Pitch deck on file", alert: !snapshot.pitch_deck_present },
            { value: String(num(snapshot.documents_approved_count)), label: "Approved by iCFO", alert: num(snapshot.documents_approved_count) === 0 && num(snapshot.document_count) > 0 },
            { value: String(requestsOutstanding), label: "Requests outstanding" },
          ]
        : undefined,
      paragraphs: missingList.length ? [`Missing required documents: ${missingList.join(", ")}.`] : undefined,
      empty: docRequests.length ? undefined : "No document requests issued.",
      table: docRequests.length
        ? {
            columns: [
              { label: "Category", width: 0.15 },
              { label: "Request", width: 0.33 },
              { label: "Owner", width: 0.12 },
              { label: "Due", width: 0.13 },
              { label: "Closes", width: 0.12, mono: true },
              { label: "Status", width: 0.15 },
            ],
            rows: docRequests.map((d) => [
              title(d.category) || "—",
              str(d.label),
              title(d.owner_role) || "—",
              dateOnly(d.due_date),
              Array.isArray(d.closes_findings) && d.closes_findings.length ? (d.closes_findings as string[]).join(", ") : "—",
              pill(d.status, STATUS_TONE),
            ]),
          }
        : undefined,
    });
  }

  if (snapshot) {
    const done = num(snapshot.remediation_completed);
    const open = num(snapshot.remediation_open);
    const high = num(snapshot.remediation_high_priority_open);
    sections.push({
      key: "remediation",
      title: "Remediation progress",
      bar: {
        segments: [
          { value: done, label: "Completed", color: "#1E4E8C" },
          { value: high, label: "Open, high priority", color: "#9A3412" },
          { value: Math.max(0, open - high), label: "Open, other", color: "#E0A33A" },
        ],
        caption: done + open > 0 ? `${done} of ${done + open} tasks complete (${Math.round((done / (done + open)) * 100)}%)` : "No remediation tasks recorded",
      },
    });
  }

  const responses = payload.responses as Row[];
  if (responses.length) {
    sections.push({
      key: "responses",
      title: isAdmin ? "Founder responses and iCFO review" : "Founder responses",
      table: {
        columns: [
          { label: "Findings", width: 0.12, mono: true },
          { label: "Response", width: isAdmin ? 0.36 : 0.5 },
          { label: "Disposition", width: 0.15 },
          { label: "Owner", width: 0.1 },
          { label: "Due", width: 0.13 },
          ...(isAdmin ? [{ label: "iCFO review", width: 0.14 }] : []),
        ],
        rows: responses.map((r) => [
          Array.isArray(r.finding_codes) ? (r.finding_codes as string[]).join(", ") : "—",
          str(r.body),
          pill(r.disposition, DISPOSITION_TONE),
          title(r.owner_role) || "—",
          dateOnly(r.due_date),
          ...(isAdmin ? [pill(r.icfo_review, STATUS_TONE)] : []),
        ]),
      },
    });
  }

  if (conditions.length) {
    sections.push({
      key: "conditions",
      title: "Conditions to clear before investor introduction",
      checklist: conditions.map((c) => ({ label: str(c.label), detail: str(c.detail) || undefined, done: c.status === "done", status: pill(c.status, STATUS_TONE) })),
    });
  }

  if (snapshot) {
    sections.push({
      key: "investor",
      title: "Investor activity and compliance",
      metrics: [
        { value: String(num(snapshot.expressed_interest_count)), label: "Expressed interests" },
        { value: `$${num(snapshot.indicative_pledge_total).toLocaleString("en-US")}`, label: "Indicative pledges" },
        { value: String(num(snapshot.intro_request_count)), label: "Intro requests" },
        { value: String(num(snapshot.message_thread_count)), label: "Message threads" },
        { value: String(num(snapshot.meetings_scheduled_count)), label: "Meetings scheduled" },
        { value: String(num(snapshot.learning_modules_completed)), label: "Learning modules" },
      ],
      keyValues: [
        ["Open compliance events", String(num(snapshot.open_compliance_events))],
        ["Flagged outreach, social, messages", String(num(snapshot.flagged_outreach_social_message_indicators))],
        ["Risk level", snapshot.risk_score == null ? "—" : String(snapshot.risk_score)],
      ],
    });
  }

  if (gate) {
    const yn = (b: boolean) => (b ? "Yes" : "No");
    const g = (s: string) => gate[s] ?? { founder: false, investor: false };
    sections.push({
      key: "visibility",
      title: "Who sees what",
      internal: true,
      intro: "Effective visibility in exported reports. Analyst notes and iCFO review are always removed for founders and investors.",
      table: {
        columns: [
          { label: "Section", width: 0.5 },
          { label: "Founder", width: 0.25, align: "center" },
          { label: "Investor", width: 0.25, align: "center" },
        ],
        rows: [
          ["Findings, domains and conditions", yn(g("findings").founder), yn(g("findings").investor)],
          ["Founder responses", yn(g("responses").founder), yn(g("responses").investor)],
          ["Data room requests", yn(g("data_room").founder), yn(g("data_room").investor)],
          ["Verdict", yn(g("verdict").founder), yn(g("verdict").investor)],
          ["Confidence score", "Yes", "Yes"],
          ["Analyst notes", "No", "No"],
          ["iCFO review", "No", "No"],
          ["Claims ledger", "No", "No"],
        ],
      },
    });
  }

  sections.push({
    key: "seal",
    title: "Version, seal and signatures",
    keyValues: [
      ["Version", version ? `${version.version} · ${title(version.status)}` : "Draft, not sealed"],
      ["Document hash (SHA-256)", version?.document_hash ?? "Generated when the version is sealed"],
      ["Consent envelope", extras.consent ? `${title(extras.consent.status)} · ${extras.consent.signerCount} signer${extras.consent.signerCount === 1 ? "" : "s"}` : "Not yet created"],
      ["Consent completed", extras.consent?.completed_at ? dateOnly(extras.consent.completed_at) : "—"],
    ],
  });

  if (audit.length) {
    sections.push({
      key: "audit",
      title: "Audit trail (latest)",
      internal: true,
      table: {
        columns: [
          { label: "When", width: 0.22, mono: true },
          { label: "Actor", width: 0.24 },
          { label: "Action", width: 0.54 },
        ],
        rows: audit.map((a) => [str(a.at).slice(0, 16).replace("T", " "), a.actor || "—", `${title(a.action)}${a.target ? ` · ${a.target}` : ""}`]),
      },
    });
  }

  sections.push({
    key: "method",
    title: "Methodology and disclaimer",
    paragraphs: [
      "Findings are rated High, Medium or Low by an iCFO analyst and linked to claims and documents in the iCapOS data room. Evidence states run Unverified, Requested, Submitted, Verified or Discrepancy. The Capital Readiness Rating is computed by iCapOS from the founder assessment.",
      "Prepared by iCFO Capital Global, Inc. This report is not investment advice and is not an offer to sell or a solicitation to buy any security.",
    ],
  });

  return {
    role,
    audienceLabel: isAdmin ? "Internal staff use only" : role === "founder" ? "Founder copy" : "Investor copy",
    company,
    reportCode,
    versionLabel,
    generatedAt: extras.generatedAt ?? new Date(),
    generatedBy: isAdmin ? extras.generatedBy ?? null : null,
    stages: STAGES.map((s) => s.label),
    stageIndex,
    verdict,
    confidence: extras.noEngagement ? null : num(eng.confidence_pct ?? payload.confidence),
    riskLevel: snapshot?.risk_score ?? null,
    readiness: snapshot ? { score: snapshot.latest_readiness_score ?? null } : null,
    findingCounts: counts,
    metrics,
    takeaways: t.slice(0, 3),
    sections,
  };
}

/** Payload stand-in for a company that has no diligence engagement yet. */
export function emptyReportPayload(companyName: string): ReportPayload {
  return {
    engagement: { company_name: companyName, report_code: null, lifecycle_stage: "draft" },
    domains: [],
    findings: [],
    claims: [],
    responses: [],
    docRequests: [],
    conditions: [],
    confidence: 0,
  };
}
