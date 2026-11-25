// System dashboard: integrations, deliveries, queues, automation, scheduled jobs, system health and
// the import, export, page builder and beta pages in one read. buildSystemDashboard() is pure so it
// can be tested; loadSystemDashboard() does the reads through the loaders those pages already use.
// Where no real count exists the figure is "live". A failed read is "Not available". Nothing is estimated.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricRecord } from "@/components/ui/MetricDetailDrawer";
import { recordsFor, type Popup } from "@/lib/dashboard/administration-dashboard";
import type { DepartmentMetric } from "@/lib/dashboard/department-metrics";
import { loadAutomationConsole, parseAutomationConsoleFilters } from "@/lib/automation/admin-console";
import { loadLatestCronRuns, loadPausedCrons } from "@/lib/cron/gate";
import { listCronJobs } from "@/lib/cron/jobs";
import { KILLED_AFTER_MS } from "@/lib/cron/run-history";
import { computeExecutionReadinessBySpvMap } from "@/lib/document-execution/readiness";
import { getGmailFoundationStatus } from "@/lib/email/preferences";
import { listImportBatches } from "@/lib/imports/batches";
import { loadIntegrationsAdminConsole } from "@/lib/integrations/admin-console";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { listRecentDeliveryLogs, type IntegrationDeliveryLogView } from "@/lib/integrations/health";
import type { IntegrationProvider } from "@/lib/integrations/types";
import { buildLaunchReadinessSnapshot } from "@/lib/operations/launch-readiness";
import { getAllAdminQueuesSnapshot } from "@/lib/queues/admin-queues";
import { countCriticalOpenComplianceForCompany, listAdminClosingReviewsBySpv } from "@/lib/spv/closing-reviews";
import { listAdminPackagesGrouped } from "@/lib/spv/document-packages";
import { listAdminRequirementsGrouped } from "@/lib/spv/participation-requirements";
import { listAdminSpvOpportunities, listSpvParticipationsForOpportunity } from "@/lib/spv/spv-workflow";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;
type AuditEntry = { at: string; text: string };

/** A record before its audit trail is attached. */
export type SystemRecord = {
  id: string;
  label: string;
  sub: string;
  status: string;
  href: string;
  attempts?: string;
  lastSuccess?: string | null;
  lastFailure?: string | null;
  facts?: { at: string | null; text: string }[];
};

/** A total with its newest records. A null total means the read failed. */
export type Counted = { total: number; records: SystemRecord[] } | null;

export type ConnectionInput = {
  id: string;
  provider: IntegrationProvider;
  enabled: boolean;
  status: string;
  webhookConfigured: boolean;
  last_delivery_at: string | null;
  last_failure_at: string | null;
  updated_at: string;
};

export type SystemDashInput = {
  now: Date;
  integrations: {
    connections: ConnectionInput[];
    activeConnections: number;
    failed24h: number;
    pendingRetries: number;
    failedQueue: IntegrationDeliveryLogView[];
    /** Deliveries created in the last 24 hours. */
    logs: IntegrationDeliveryLogView[];
    logsTruncated: boolean;
  } | null;
  /** The signed in staff member's own Google connection. */
  google: { connected: boolean; configured: boolean; draftingAvailable: boolean; connectedAt: string | null } | null;
  queues: { summary: { label: string; count: number }[]; records: SystemRecord[] } | null;
  automationRuns: Counted;
  jobs: { total: number; failing: number; records: SystemRecord[] } | null;
  health: { verified: boolean; records: SystemRecord[] } | null;
  /** Open SPVs with a blocked package or a signer gap. */
  spv: { blockedPackages: number; signerGaps: number; records: SystemRecord[] } | null;
  pages: Counted;
  imports: Counted;
  exports: Counted;
  beta: Counted;
  /** Audit entries by record id. Null when the audit trail could not be read. */
  audit: Map<string, AuditEntry[]> | null;
};

export type SystemDashboard = {
  readAt: string;
  pill: { text: string; tone: "good" | "bad" | "none" };
  need: { key: string; value: string; label: string; attention: boolean }[];
  rings: DepartmentMetric[];
  more: DepartmentMetric[];
  summary: string;
  integrations: { key: string; label: string; status: string; tone: "good" | "warn" | "none" }[];
  actions: { key: string; text: string; tone: "bad" | "warn" | "good" }[];
  timeline: { key: string; label: string; total: number; failed: number }[] | null;
  advisor: string;
  popups: Record<string, Popup>;
};

const NA = "Not available";
const LIVE = "live";
const SHOWN = 10;
const HOUR = 3_600_000;
const IP = "/admin/integrations";
const LOG_LIMIT = 1000;
const DELIVERY_SOURCE = "integration delivery logs, the same source as the Integration health summary";

const when = (iso: string | null | undefined): string | null => (iso ? `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC` : null);
const words = (s: string) => s.replace(/_/g, " ");
const noDash = (s: string) => s.replace(/\s+[—–-]\s+|[—–]/g, ": ");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const PROVIDER: Partial<Record<string, string>> = { slack: "Slack", webhook: "Webhook", gmail_foundation: "Gmail", docusign_foundation: "DocuSign", calendar_foundation: "Google Calendar", hubspot_foundation: "HubSpot" };
const providerName = (p: string) => PROVIDER[p] ?? words(p);

function deliveryRecord(l: IntegrationDeliveryLogView): SystemRecord {
  const bad = l.status === "failed" || l.status === "retrying";
  return {
    id: l.id,
    label: `${providerName(l.provider)}: ${words(l.event_type)}`,
    sub: `${l.status}, ${when(l.created_at)}`,
    status: l.response_code ? `${l.status}, response ${l.response_code}` : l.status,
    attempts: `${l.attempt_count} of ${l.max_attempts}`,
    lastSuccess: l.delivered_at,
    lastFailure: bad ? l.created_at : null,
    href: IP,
    facts: [
      { at: l.created_at, text: "Delivery queued" },
      { at: l.next_retry_at, text: "Next retry due" },
      { at: l.delivered_at, text: "Delivered" },
    ],
  };
}

export function buildSystemDashboard(input: SystemDashInput): SystemDashboard {
  const { integrations: ig, google, now } = input;
  const readAt = when(now.toISOString()) as string;

  const toRecord = (r: SystemRecord): MetricRecord => {
    const facts = (r.facts ?? []).flatMap((f) => (f.at ? [{ at: f.at, text: f.text }] : []));
    const audit = input.audit
      ? [...facts, ...(input.audit.get(r.id) ?? [])].sort((a, b) => b.at.localeCompare(a.at)).map((a) => ({ at: when(a.at) as string, text: noDash(a.text) }))
      : null;
    return {
      label: noDash(r.label),
      sub: noDash(r.sub),
      href: r.href,
      transaction: {
        id: r.id,
        status: noDash(r.status),
        attempts: r.attempts ?? "Not recorded",
        lastSuccess: when(r.lastSuccess) ?? "Not recorded",
        lastFailure: when(r.lastFailure) ?? "Not recorded",
        audit,
      },
    };
  };

  const popup = (p: {
    label: string; value: string; unit?: string; detail: string; source: string; href: string; hrefLabel: string;
    /** Null when the records could not be read. */
    records: SystemRecord[] | null; total: number | null; empty: string; recordsLabel: string;
    flag?: Popup["flag"]; breakdown?: { label: string; value: string }[]; note?: string;
  }): Popup => ({
    label: p.label, value: p.value, unit: p.unit, detail: p.detail, flag: p.flag ?? null,
    extra: {
      ...recordsFor(p.records ? p.records.slice(0, SHOWN).map(toRecord) : null, p.total, p.hrefLabel.replace(/^Open /, ""), p.empty),
      recordsLabel: p.recordsLabel,
      breakdown: p.breakdown,
      note: [p.note, `Source: ${p.source}.`, `Read ${readAt}.`].filter(Boolean).join(" "),
      href: p.href, hrefLabel: p.hrefLabel, explainLabel: "Explain with AI",
    },
  });

  const popups: Record<string, Popup> = {};
  const ring = (id: string, label: string, value: number | null | typeof LIVE, p: Omit<Parameters<typeof popup>[0], "label" | "value" | "total"> & { total?: number | null }): DepartmentMetric => {
    const n = typeof value === "number" ? value : null;
    popups[id] = popup({ ...p, label, value: value === null ? NA : String(value), unit: n === null ? undefined : p.unit, total: p.total === undefined ? n : p.total });
    return {
      id, department: "administration", label, value: n ?? 0, valueText: value === null ? "n/a" : String(value), detail: p.detail,
      flowLabel: null, changes: null, weekly: null, note: value === null ? "The count could not be read." : undefined,
    };
  };

  const conn = (p: string) => ig?.connections.find((c) => c.provider === p) ?? null;
  const connRecord = (c: ConnectionInput, status: string): SystemRecord => ({
    id: c.id, label: providerName(c.provider), sub: status, status, href: IP,
    lastSuccess: c.last_delivery_at, lastFailure: c.last_failure_at,
    facts: [{ at: c.updated_at, text: "Connection last updated" }],
  });
  const isConnected = (c: ConnectionInput) => c.enabled && c.status === "active" && c.webhookConfigured;
  const channelStatus = (p: "slack" | "webhook"): string => {
    const c = conn(p);
    if (!ig || !c) return NA;
    if (!c.enabled) return "Disabled";
    if (!c.webhookConfigured) return "Enabled, URL not configured";
    return c.status === "active" ? "Connected" : `Enabled, status ${c.status}`;
  };
  // The DocuSign foundation has no live connection yet, so it reads Not connected, as on Integrations.
  const statusOf: Record<string, string> = {
    gmail_foundation: google ? (google.connected ? "Google connected" : google.draftingAvailable ? "Drafting available, Google not connected" : "Unavailable") : NA,
    calendar_foundation: google ? (google.connected ? "Connected" : google.configured ? "Not connected" : "Not configured") : NA,
    docusign_foundation: "Not connected",
    slack: channelStatus("slack"),
    webhook: channelStatus("webhook"),
  };

  // A. The four integration rings.
  const logs = ig?.logs ?? [];
  const failedLogs = logs.filter((l) => l.status === "failed");
  const activeConns = ig?.connections.filter((c) => c.enabled && c.status === "active") ?? [];
  const retryable = ig?.failedQueue.filter((l) => l.next_retry_at) ?? [];
  const unread = <T,>(rows: T[]): T[] | null => (ig ? rows : null);
  const rings: DepartmentMetric[] = [
    ring("active", "Active connections", ig ? ig.activeConnections : null, {
      unit: "active", detail: "Integration connections that are enabled with status active.", source: "integration connections", href: IP, hrefLabel: "Open Integrations",
      records: unread(activeConns.map((c) => connRecord(c, statusOf[c.provider] ?? c.status))), recordsLabel: "Active connections", empty: "No connections are active.",
    }),
    ring("failed", "Failed (24h)", ig ? ig.failed24h : null, {
      unit: "deliveries", detail: "Deliveries created in the last 24 hours with status failed.", source: DELIVERY_SOURCE, href: IP, hrefLabel: "Open Integrations",
      flag: ig ? (ig.failed24h > 0 ? { text: "Failing deliveries to review", tone: "bad" } : { text: "Nothing failed in the last 24 hours", tone: "good" }) : null,
      records: unread(failedLogs.map(deliveryRecord)), recordsLabel: "Failed deliveries", empty: "No deliveries failed in the last 24 hours.",
    }),
    ring("retries", "Pending retries", ig ? ig.pendingRetries : null, {
      unit: "scheduled", detail: "Failed or retrying deliveries with a next retry scheduled.", source: DELIVERY_SOURCE, href: IP, hrefLabel: "Open Integrations",
      records: unread(retryable.map(deliveryRecord)), recordsLabel: "Waiting for retry", empty: "No deliveries are waiting for a retry.",
    }),
    ring("retry_queue", "Retry queue", ig ? ig.failedQueue.length : null, {
      unit: "in queue", detail: "Failed and retrying deliveries in the queue, up to the 30 the Integrations page loads.", source: DELIVERY_SOURCE, href: IP, hrefLabel: "Open Integrations",
      records: unread(ig?.failedQueue.map(deliveryRecord) ?? []), recordsLabel: "Retry queue", empty: "The retry queue is empty.",
    }),
  ];

  // B. The other four.
  const queueTotal = input.queues ? input.queues.summary.reduce((a, q) => a + q.count, 0) : null;
  const health = input.health;
  const blockers = health?.records.length ?? 0;
  rings.push(
    ring("queues", "Queues", queueTotal, {
      unit: "open items", detail: "Items across every admin queue on the Queues page, newest first.", source: "the admin queues", href: "/admin/queues", hrefLabel: "Open Queues",
      records: input.queues?.records ?? null, recordsLabel: "Newest items", empty: "Every queue is clear.",
      breakdown: input.queues?.summary.map((q) => ({ label: q.label, value: String(q.count) })),
    }),
    ring("automation", "Automation rules", LIVE, {
      detail: "Automation rules run live in code. No rule count is stored, so none is shown. The records are the newest automation runs.",
      source: "automation runs", href: "/admin/automation", hrefLabel: "Open Automation", total: input.automationRuns?.total ?? null,
      records: input.automationRuns?.records ?? null, recordsLabel: "Newest runs", empty: "No automation runs yet.",
    }),
    ring("jobs", "Scheduled jobs", input.jobs ? input.jobs.total : null, {
      unit: "jobs", detail: "Jobs that run on their own schedule, failing jobs first.", source: "the job schedule and the job run log", href: "/admin/scheduled-jobs", hrefLabel: "Open Scheduled jobs",
      flag: input.jobs && input.jobs.failing > 0 ? { text: `${plural(input.jobs.failing, "job")} failed on the latest run`, tone: "bad" } : null,
      records: input.jobs?.records ?? null, recordsLabel: "Jobs", empty: "No jobs are scheduled.",
    }),
    ring("health", "System health", !health ? null : health.verified || blockers > 0 ? blockers : LIVE, {
      unit: blockers === 1 ? "blocker" : "blockers",
      detail: health && !health.verified && blockers === 0
        ? "System checks run live. The database checks could not be verified here, so no count is shown."
        : "Launch readiness blockers: migrations, security checks and environment settings.",
      source: "the System Health launch readiness check", href: "/admin/system-health", hrefLabel: "Open System Health",
      flag: health?.verified && blockers === 0 ? { text: "No blockers", tone: "good" } : blockers > 0 ? { text: "Blockers to clear", tone: "bad" } : null,
      records: health?.records ?? null, recordsLabel: "Blockers", empty: health?.verified ? "No blockers found." : "No verified records to show.",
    }),
  );

  const counted = (id: string, label: string, c: Counted, p: { unit: string; detail: string; source: string; href: string; hrefLabel: string; recordsLabel: string; empty: string }) =>
    ring(id, label, c ? c.total : null, { ...p, records: c?.records ?? null });
  const more = [
    counted("pages", "Pages built", input.pages, { unit: "pages", detail: "Page Builder pages with a saved draft.", source: "page builder drafts", href: "/admin/page-builder-lab", hrefLabel: "Open Page Builder", recordsLabel: "Pages", empty: "No pages built yet." }),
    counted("imports", "Import jobs", input.imports, { unit: "imports", detail: "Import batches started in the Import and Export center.", source: "import batches", href: "/admin/imports", hrefLabel: "Open Import / Export", recordsLabel: "Newest imports", empty: "No imports yet." }),
    counted("exports", "Export jobs", input.exports, { unit: "exports", detail: "Exports generated in the Import and Export center.", source: "the operational activity log", href: "/admin/imports", hrefLabel: "Open Import / Export", recordsLabel: "Newest exports", empty: "No exports yet." }),
    counted("beta", "Beta operations", input.beta, { unit: "open", detail: "Beta feedback that is open or being reviewed.", source: "beta feedback", href: "/admin/beta-operations", hrefLabel: "Open Beta Operations", recordsLabel: "Open feedback", empty: "No open beta feedback." }),
  ];

  // C. Integrations card. Each row opens its connection and its deliveries from the last 24 hours.
  const googleNote = "This is your own Google connection.";
  const LIST: { provider: IntegrationProvider; label: string; detail: string; note?: string }[] = [
    { provider: "gmail_foundation", label: "Gmail and email foundation", detail: "Email drafting. Automatic sending is off.", note: googleNote },
    { provider: "calendar_foundation", label: "Google Calendar", detail: "Google Calendar connection.", note: googleNote },
    { provider: "docusign_foundation", label: "DocuSign foundation", detail: "Signing readiness only. No envelopes are created or sent." },
    { provider: "slack", label: "Slack", detail: "Notifications to a Slack channel." },
    { provider: "webhook", label: "Webhook", detail: "Signed posts to your endpoint." },
  ];
  const integrations = LIST.map((l): SystemDashboard["integrations"][number] => {
    const key = `int_${l.provider}`;
    const status = statusOf[l.provider];
    const c = conn(l.provider);
    const own = logs.filter((x) => x.provider === l.provider).map(deliveryRecord);
    const isGoogle = l.provider === "gmail_foundation" || l.provider === "calendar_foundation";
    const rows = c ? [{ ...connRecord(c, status), facts: [{ at: isGoogle ? (google?.connectedAt ?? null) : null, text: "Google connected" }, { at: c.updated_at, text: "Connection last updated" }] }, ...own] : null;
    popups[key] = popup({
      label: l.label, value: status, detail: l.detail, note: l.note, href: IP, hrefLabel: "Open Integrations",
      source: isGoogle ? "connected accounts and integration connections" : "integration connections and delivery logs",
      records: rows, total: rows?.length ?? null, recordsLabel: "Connection and deliveries (24h)", empty: "No connection record yet.",
    });
    const tone = status === "Connected" || status === "Google connected" ? "good" : status === NA ? "none" : "warn";
    return { key, label: l.label, status, tone };
  });

  // D. Needs you today.
  const offChannels = ig ? (["slack", "webhook", "docusign_foundation"] as const).filter((p) => { const c = conn(p); return p === "docusign_foundation" || !c || !isConnected(c); }) : null;
  const offRecords = offChannels?.flatMap((p) => { const c = conn(p); return c ? [connRecord(c, statusOf[p])] : []; }) ?? null;
  const offNames = (offChannels ?? []).map(providerName).join(", ");
  popups.not_connected = popup({
    label: "Integrations not connected", value: offChannels ? String(offChannels.length) : NA, unit: offChannels ? "of 3" : undefined,
    detail: offChannels?.length ? `Not connected: ${offNames}.` : "Counts Slack, Webhook and DocuSign.", source: "integration connections", href: IP, hrefLabel: "Open Integrations",
    records: offRecords, total: offChannels?.length ?? null, recordsLabel: "Not connected", empty: "Slack, Webhook and DocuSign are all connected.",
  });
  const need = [
    { key: "not_connected", value: offChannels ? String(offChannels.length) : NA, label: offChannels?.length === 1 ? "integration not connected" : "integrations not connected", attention: !!offChannels?.length },
    { key: "failed", value: ig ? String(ig.failed24h) : NA, label: "failed deliveries (24h)", attention: !!ig?.failed24h },
  ];

  // E. Next best actions.
  const spv = input.spv;
  popups.spv = popup({
    label: "Blocked SPV packages and signer gaps", value: spv ? String(spv.blockedPackages + spv.signerGaps) : NA, unit: spv ? "to review" : undefined,
    detail: spv ? `${plural(spv.blockedPackages, "blocked package")} and ${plural(spv.signerGaps, "signer gap")} across SPVs in draft, review or open.` : "Blocked packages and signer gaps across SPVs in draft, review or open.",
    source: "the SPV execution readiness check", href: "/admin/spvs", hrefLabel: "Open SPVs",
    records: spv?.records ?? null, total: spv?.records.length ?? null, recordsLabel: "SPVs to review", empty: "No blocked packages or signer gaps.",
  });
  const actions: SystemDashboard["actions"] = [
    { key: "spv", tone: "warn", text: "Review blocked SPV packages and signer gaps before connecting DocuSign" },
  ];
  const disabled = ig ? (["slack", "webhook"] as const).filter((p) => !conn(p)?.enabled) : [];
  if (disabled.length) {
    const names = disabled.map(providerName).join(" and ");
    popups.disabled = popup({
      label: "Disabled integrations", value: String(disabled.length), unit: "of 2", detail: `${names} ${disabled.length === 1 ? "is" : "are"} disabled.`,
      source: "integration connections", href: IP, hrefLabel: "Open Integrations",
      records: disabled.flatMap((p) => { const c = conn(p); return c ? [connRecord(c, statusOf[p])] : []; }), total: disabled.length, recordsLabel: "Disabled", empty: "Slack and Webhook are enabled.",
    });
    actions.push({ key: "disabled", tone: "warn", text: `${names} ${disabled.length === 1 ? "is" : "are"} disabled` });
  }
  const failing = ig ? ig.failed24h > 0 || ig.pendingRetries > 0 || ig.failedQueue.length > 0 : null;
  if (failing === false) actions.push({ key: "retry_queue", tone: "good", text: "All clear: no deliveries are failing" });
  else if (ig && failing) actions.push(ig.failed24h > 0 ? { key: "failed", tone: "bad", text: `Review ${plural(ig.failed24h, "failed delivery", "failed deliveries")} from the last 24 hours` } : { key: "retry_queue", tone: "warn", text: `Review ${plural(ig.failedQueue.length, "delivery", "deliveries")} in the retry queue` });

  // F. Delivery timeline: 12 bars of two hours.
  const start = now.getTime() - 24 * HOUR;
  const timeline = ig
    ? Array.from({ length: 12 }, (_, i) => {
        const from = start + i * 2 * HOUR;
        const to = from + 2 * HOUR;
        const rows = logs.filter((l) => { const t = new Date(l.created_at).getTime(); return t >= from && (i === 11 ? t <= to : t < to); });
        const failed = rows.filter((l) => l.status === "failed").length;
        const hm = (ms: number) => new Date(ms).toISOString().slice(11, 16);
        const key = `t_${i}`;
        const label = `${hm(from)} to ${hm(to)} UTC`;
        popups[key] = popup({
          label: `Deliveries ${label}`, value: String(rows.length), unit: rows.length === 1 ? "delivery" : "deliveries",
          detail: `Deliveries created from ${when(new Date(from).toISOString())} to ${when(new Date(to).toISOString())}. ${failed} failed.`,
          note: ig.logsTruncated ? `Only the newest ${LOG_LIMIT} deliveries are counted.` : undefined,
          source: "integration delivery logs", href: IP, hrefLabel: "Open Integrations",
          records: rows.map(deliveryRecord), total: rows.length, recordsLabel: "Deliveries", empty: "No deliveries in this window.",
        });
        return { key, label, total: rows.length, failed };
      })
    : null;

  // G. Summary, pill and advisor, only from figures shown above.
  const fig = (m: DepartmentMetric) => `${m.label} ${m.valueText === "n/a" ? "not available" : m.valueText}`;
  const pill: SystemDashboard["pill"] = failing === null ? { text: "Status not available", tone: "none" } : failing ? { text: "Deliveries need review", tone: "bad" } : { text: "No failing deliveries", tone: "good" };
  const summary = `${rings.map(fig).join(", ")}.`;
  const advisor = [
    `${pill.text}.`,
    offChannels?.length ? `${plural(offChannels.length, "integration")} not connected: ${offNames}.` : null,
    summary,
    `${more.map(fig).join(", ")}.`,
  ].filter(Boolean).join(" ");

  return { readAt, pill, need, rings, more, summary, integrations, actions, timeline, advisor, popups };
}

const orNull = async <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

async function loadIntegrations(db: Db, now: Date): Promise<SystemDashInput["integrations"]> {
  // The shared loaders turn a failed read into zero, so check the log is readable first.
  const probe = await db.from("integration_delivery_logs").select("id").limit(1);
  if (probe.error) return null;
  const [console_, recent] = await Promise.all([loadIntegrationsAdminConsole(), listRecentDeliveryLogs(LOG_LIMIT)]);
  if (console_.connections.length === 0) return null;
  const since = now.getTime() - 24 * HOUR;
  const logs = recent.filter((l) => new Date(l.created_at).getTime() >= since);
  return {
    connections: console_.connections,
    activeConnections: console_.health.activeConnections,
    failed24h: console_.health.failedDeliveries24h,
    pendingRetries: console_.health.pendingRetries,
    failedQueue: console_.failedQueue,
    logs,
    logsTruncated: logs.length === LOG_LIMIT,
  };
}

async function loadGoogle(userDb: Db, userId: string): Promise<SystemDashInput["google"]> {
  const [status, gmail] = await Promise.all([getGoogleConnectionStatus(userDb, userId), getGmailFoundationStatus(userDb, userId)]);
  return { connected: status.connected, configured: status.configured, draftingAvailable: gmail.draftingAvailable, connectedAt: status.connectedAt };
}

async function loadQueues(db: Db): Promise<SystemDashInput["queues"]> {
  const snap = await getAllAdminQueuesSnapshot(db, { limit: SHOWN });
  const records = Object.values(snap.itemsByQueue).flat()
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, SHOWN)
    .map((q): SystemRecord => ({ id: q.entity_id, label: q.title, sub: `${words(q.queue_type)}, ${words(q.status)}`, status: words(q.status), href: q.href, facts: [{ at: q.created_at, text: "Entered the queue or last updated" }] }));
  return { summary: snap.summary.map((s) => ({ label: s.label, count: s.count })), records };
}

async function loadAutomation(db: Db): Promise<Counted> {
  const c = await loadAutomationConsole(db, parseAutomationConsoleFilters(new URLSearchParams({ limit: String(SHOWN) })));
  return {
    total: c.total,
    records: c.runs.map((r) => ({
      id: r.id, label: words(r.triggerType ?? "Automation run"), sub: `${r.status}, ${when(r.startedAt)}`, status: r.dryRun ? `${r.status}, dry run` : r.status, href: "/admin/automation",
      lastSuccess: r.status === "success" ? r.completedAt : null, lastFailure: r.status === "failed" ? (r.completedAt ?? r.startedAt) : null,
      facts: [{ at: r.startedAt, text: "Run started" }, { at: r.completedAt, text: `Run finished: ${r.actionsExecuted} executed, ${r.actionsSkipped} skipped, ${r.failuresCount} failed` }],
    })),
  };
}

async function loadJobs(now: Date): Promise<SystemDashInput["jobs"]> {
  const jobs = listCronJobs();
  const [paused, runs] = await Promise.all([loadPausedCrons(), loadLatestCronRuns(jobs.map((j) => j.path))]);
  const rows = jobs.map((j) => {
    const run = runs.get(j.path);
    const timedOut = run?.status === "running" && now.getTime() - new Date(run.started_at).getTime() > KILLED_AFTER_MS;
    const bad = timedOut || run?.status === "error";
    const last = !run ? "no run recorded" : timedOut ? "timed out" : run.status;
    const status = paused[j.path] ? `paused, last run ${last}` : last;
    const record: SystemRecord = {
      id: j.path, label: j.name, sub: run ? `${status}, ${when(run.started_at)}` : status, status: run?.http_status ? `${status}, response ${run.http_status}` : status, href: "/admin/scheduled-jobs",
      lastSuccess: run?.status === "ok" ? (run.finished_at ?? run.started_at) : null, lastFailure: run && bad ? (run.finished_at ?? run.started_at) : null,
      facts: run ? [{ at: run.started_at, text: "Latest run started" }, { at: run.finished_at, text: "Latest run finished" }] : [],
    };
    return { bad, at: run?.started_at ?? "", record };
  });
  rows.sort((a, b) => Number(b.bad) - Number(a.bad) || b.at.localeCompare(a.at));
  return { total: jobs.length, failing: rows.filter((r) => r.bad).length, records: rows.map((r) => r.record) };
}

async function loadHealth(): Promise<SystemDashInput["health"]> {
  const s = await buildLaunchReadinessSnapshot();
  return {
    verified: !s.migrations.verificationUnavailable && !s.security.verificationUnavailable,
    records: s.blockers.map((b, i) => ({ id: `Blocker ${i + 1}`, label: b, sub: "Blocking launch readiness", status: "Blocking", href: "/admin/system-health", facts: [{ at: s.generatedAt, text: "Check run" }] })),
  };
}

async function loadSpv(db: Db): Promise<SystemDashInput["spv"]> {
  const opps = await listAdminSpvOpportunities(db);
  if (opps.error) return null;
  const spvs = opps.data.filter((s) => ["draft", "under_review", "open"].includes(s.status));
  const ids = spvs.map((s) => s.id);
  const [packages, requirements, reviews] = await Promise.all([listAdminPackagesGrouped(db, ids), listAdminRequirementsGrouped(db, ids), listAdminClosingReviewsBySpv(db, ids)]);
  if (packages.error || requirements.error || reviews.error) return null;
  const reqs = Object.values(requirements.data ?? {}).flat();
  const inputs = await Promise.all(spvs.map(async (spv) => {
    const [parts, critical] = await Promise.all([listSpvParticipationsForOpportunity(db, spv.id), countCriticalOpenComplianceForCompany(db, spv.company_id)]);
    if (parts.error || critical.error) throw new Error("SPV readiness could not be read.");
    return {
      spv, packages: packages.data?.[spv.id] ?? [], participations: parts.data ?? [], requirements: reqs.filter((r) => r.spv_opportunity_id === spv.id),
      closingReview: reviews.data?.[spv.id] ?? null, criticalComplianceOpenCount: critical.count, hasFounderSigner: Boolean(spv.created_by),
    };
  }));
  const updated = new Map(spvs.map((s) => [s.id, s.updated_at]));
  const gaps = Object.values(computeExecutionReadinessBySpvMap(inputs))
    .map((s) => ({ s, blocked: s.blockedPackages.length, signers: s.signers.filter((x) => x.status !== "present").length }))
    .filter((g) => g.blocked + g.signers > 0);
  return {
    blockedPackages: gaps.reduce((a, g) => a + g.blocked, 0),
    signerGaps: gaps.reduce((a, g) => a + g.signers, 0),
    records: gaps.map((g) => ({
      id: g.s.spvId, label: g.s.spvName, sub: `${plural(g.blocked, "blocked package")}, ${plural(g.signers, "signer gap")}`, status: g.s.nextRequiredStep,
      href: `/admin/spvs?spv=${g.s.spvId}`, facts: [{ at: updated.get(g.s.spvId) ?? null, text: "SPV last updated" }],
    })),
  };
}

async function loadPages(db: Db): Promise<Counted> {
  const { data, count, error } = await db.from("page_builder_drafts").select("id, page_slug, created_at, updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(SHOWN);
  if (error || count === null) return null;
  return { total: count, records: (data ?? []).map((p) => ({ id: p.id, label: words(p.page_slug), sub: `updated ${when(p.updated_at)}`, status: "Draft saved", href: "/admin/page-builder-lab", facts: [{ at: p.created_at, text: "Draft created" }, { at: p.updated_at, text: "Draft updated" }] })) };
}

async function loadImports(db: Db): Promise<Counted> {
  const [{ count, error }, batches] = await Promise.all([db.from("import_batches").select("id", { count: "exact", head: true }), listImportBatches(db, SHOWN)]);
  if (error || count === null) return null;
  return {
    total: count,
    records: batches.map((b) => ({
      id: b.id, label: `${words(b.import_type)}: ${b.file_name}`, sub: `${b.status}, ${when(b.created_at)}`, status: b.status, href: "/admin/imports",
      lastSuccess: b.status === "completed" ? b.completed_at : null, lastFailure: b.status === "failed" ? (b.completed_at ?? b.created_at) : null,
      facts: [{ at: b.created_at, text: `Import started, ${plural(b.total_rows ?? 0, "row")}` }, { at: b.completed_at, text: "Import finished" }],
    })),
  };
}

async function loadExports(db: Db): Promise<Counted> {
  const { data, count, error } = await db.from("operational_activity_events").select("id, title, created_at", { count: "exact" }).eq("event_type", "export_generated").order("created_at", { ascending: false }).limit(SHOWN);
  if (error || count === null) return null;
  return { total: count, records: (data ?? []).map((e) => ({ id: e.id, label: e.title, sub: `generated ${when(e.created_at)}`, status: "Generated", href: "/admin/imports", lastSuccess: e.created_at, facts: [{ at: e.created_at, text: "Export generated" }] })) };
}

async function loadBeta(db: Db): Promise<Counted> {
  // The feedback message is never selected.
  const { data, count, error } = await db.from("beta_feedback").select("id, role, category, severity, status, created_at", { count: "exact" }).in("status", ["open", "reviewing"]).order("created_at", { ascending: false }).limit(SHOWN);
  if (error || count === null) return null;
  return { total: count, records: (data ?? []).map((f) => ({ id: f.id, label: `${words(f.category)} from ${f.role}`, sub: `${f.severity}, ${f.status}`, status: f.status, href: "/admin/beta-operations", facts: [{ at: f.created_at, text: "Feedback sent" }] })) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Action names and times only. The single metadata field read links a delivery to its entries. */
async function loadAudit(db: Db, ids: string[]): Promise<Map<string, AuditEntry[]> | null> {
  const uuids = [...new Set(ids)].filter((i) => UUID.test(i));
  const out = new Map<string, AuditEntry[]>();
  if (uuids.length === 0) return out;
  const [audit, events] = await Promise.all([
    db.from("audit_logs").select("entity_id, created_at, text:action, delivery:metadata->>delivery_log_id").in("entity_id", uuids).order("created_at", { ascending: false }).limit(500),
    db.from("operational_activity_events").select("entity_id, created_at, text:title, delivery:metadata->>delivery_log_id").in("entity_id", uuids).order("created_at", { ascending: false }).limit(500),
  ]);
  if (audit.error || events.error) return null;
  const add = (id: string | null, e: AuditEntry) => {
    if (!id) return;
    const list = out.get(id) ?? [];
    if (list.length < SHOWN) out.set(id, [...list, e]);
  };
  for (const r of [...(audit.data ?? []), ...(events.data ?? [])] as unknown as { entity_id: string | null; created_at: string; text: string; delivery: string | null }[]) {
    const e = { at: r.created_at, text: words(r.text).replace(/\./g, " ") };
    add(r.entity_id, e);
    if (r.delivery) add(r.delivery, e);
  }
  return out;
}

export async function loadSystemDashboard(db: Db, userDb: Db, userId: string, now: Date = new Date()): Promise<SystemDashboard> {
  const [integrations, google, queues, automationRuns, jobs, health, spv, pages, imports, exports, beta] = await Promise.all([
    orNull(loadIntegrations(db, now)), orNull(loadGoogle(userDb, userId)), orNull(loadQueues(db)), orNull(loadAutomation(db)), orNull(loadJobs(now)), orNull(loadHealth()),
    orNull(loadSpv(db)), orNull(loadPages(db)), orNull(loadImports(db)), orNull(loadExports(db)), orNull(loadBeta(db)),
  ]);
  // Deliveries reach the audit trail through their connection id.
  const ids = [
    ...(integrations?.connections ?? []).map((c) => c.id),
    ...[queues, automationRuns, spv, pages, imports, exports, beta].flatMap((x) => (x?.records ?? []).slice(0, SHOWN).map((r) => r.id)),
  ];
  const audit = await orNull(loadAudit(db, ids));
  return buildSystemDashboard({ now, integrations, google, queues, automationRuns, jobs, health, spv, pages, imports, exports, beta, audit });
}
