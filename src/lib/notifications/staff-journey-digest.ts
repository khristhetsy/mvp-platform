// Once-daily digest to staff summarizing every founder who needs attention —
// stalled in a journey stage or waiting on stage approval. In-app + email, one
// per staff member, deduped to once a day. Best-effort — never throws into the
// cron. Complements the per-founder in-app alerts from the orchestration pass.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import { renderEmail, type EmailBlock, type RenderedEmail } from "@/lib/email/layout";
import type { SupabaseClient } from "@supabase/supabase-js";

const IDLE_DAYS = 7;
const DEDUPE_HOURS = 20; // once a day (allows a little clock drift on a daily cron)
const MAX_ROWS = 30;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");
const BOARD_URL = `${SITE_URL}/admin/companies`;
const STUCK_URL = `${SITE_URL}/admin/founders-stuck`;

const STAGE_LABEL: Record<string, string> = {
  initialize: "Onboarding",
  qualify: "Preparation",
  deploy: "Marketing",
  optimize: "Closing",
};

export type StalledRow = {
  company: string;
  companyId: string | null;
  founder: string;
  stage: string;
  /** Pending stage approval, or days since the company last changed. */
  pending: boolean;
  idleDays: number | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Approvals first, then idle founders longest first. */
export function sortStalled(rows: StalledRow[]): StalledRow[] {
  return [...rows].sort((a, b) => {
    if (a.pending !== b.pending) return a.pending ? -1 : 1;
    return (b.idleDays ?? 0) - (a.idleDays ?? 0);
  });
}

/** The digest email. Pure: takes every stalled row, sorts, and lists up to MAX_ROWS. */
export function buildStaffJourneyDigestEmail(all: StalledRow[], now: Date = new Date()): RenderedEmail {
  const sorted = sortStalled(all);
  const total = sorted.length;
  const pending = sorted.filter((r) => r.pending);
  const idleAll = sorted.filter((r) => !r.pending);
  const idle = idleAll.slice(0, Math.max(0, MAX_ROWS - pending.length));
  const shown = pending.length + idle.length;
  const longest = idle[0] ?? null;
  const people = plural(total, "founder needs", "founders need");

  const subject =
    pending.length === 1
      ? `${people} attention: ${pending[0].company} awaits your approval`
      : pending.length > 1
        ? `${people} attention: ${pending.length} await your approval`
        : longest
          ? `${people} attention: ${longest.company} idle ${longest.idleDays} days`
          : `${people} attention today`;

  const preheader = [
    idleAll.length ? `${plural(idleAll.length, "idle founder", "idle founders")}${longest ? `, longest is ${longest.company} at ${longest.idleDays} days` : ""}.` : null,
    idleAll.length > 1 ? "Sorted by days idle." : null,
  ]
    .filter(Boolean)
    .join(" ");

  const intro = [
    pending.length ? `${pending.length === 1 ? "One is" : `${pending.length} are`} waiting on your stage approval.` : null,
    idleAll.length
      ? `${idleAll.length === 1 ? "One has" : `${idleAll.length} have`} had no activity for ${IDLE_DAYS} days or more${idleAll.length > 1 ? ", listed longest first" : ""}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const maxDays = Math.max(1, ...idle.map((r) => r.idleDays ?? 0));
  const companyUrl = (r: StalledRow) => (r.companyId ? `${SITE_URL}/admin/companies/${r.companyId}` : BOARD_URL);

  const blocks: EmailBlock[] = [
    {
      type: "stats",
      items: [
        { value: String(pending.length), label: "awaiting approval" },
        { value: String(idleAll.length), label: idleAll.length === 1 ? "idle founder" : "idle founders" },
        { value: longest ? `${longest.idleDays} days` : "None", label: "longest idle" },
      ],
    },
    ...pending.map(
      (r): EmailBlock => ({
        type: "action",
        title: r.company,
        subtitle: `${r.founder} · ${r.stage} · stage approval pending`,
        button: { label: "Review approval", url: BOARD_URL },
      }),
    ),
  ];
  if (idle.length) {
    blocks.push({
      type: "rows",
      title: "Idle, longest first",
      items: idle.map((r) => ({
        title: r.company,
        subtitle: `${r.founder} · ${r.stage}`,
        right: `${r.idleDays}d`,
        url: companyUrl(r),
        bar: ((r.idleDays ?? 0) / maxDays) * 100,
      })),
    });
  }
  if (total > shown) {
    blocks.push({ type: "paragraph", text: `Showing ${shown} of ${total}. The rest are on the stuck founders page.` });
  }

  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Los_Angeles" }).format(now);

  return renderEmail({
    audience: "admin",
    subject,
    preheader,
    context: `Team digest · ${day}`,
    eyebrow: "Daily founder digest",
    headline: `${people} attention today`,
    intro,
    blocks,
    primary: { label: "Open companies", url: BOARD_URL },
    secondary: { label: "Stuck founders", url: STUCK_URL },
    footer: { reason: "Internal. Sent daily to admin and analyst roles when at least one founder is stalled or awaiting approval." },
  });
}

export async function digestStalledFoundersForStaff(): Promise<{ staffNotified: number; stalled: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as unknown as SupabaseClient<any>;

    const { data: profs } = await db
      .from("profiles")
      .select("id, full_name, journey_stage, stage_approval_status")
      .in("journey_stage", ["qualify", "deploy", "optimize"])
      .limit(500);
    const founders = (profs ?? []) as {
      id: string;
      full_name: string | null;
      journey_stage: string | null;
      stage_approval_status: string | null;
    }[];
    if (founders.length === 0) return { staffNotified: 0, stalled: 0 };

    const ids = founders.map((f) => f.id);
    const { data: comps } = await db
      .from("companies")
      .select("id, founder_id, company_name, updated_at")
      .in("founder_id", ids);
    const companyByFounder = new Map<string, { id: string; company_name: string | null; updated_at: string | null }>();
    for (const c of (comps ?? []) as { id: string; founder_id: string | null; company_name: string | null; updated_at: string | null }[]) {
      if (c.founder_id) companyByFounder.set(c.founder_id, { id: c.id, company_name: c.company_name, updated_at: c.updated_at });
    }

    const idleCutoff = Date.now() - IDLE_DAYS * 24 * 60 * 60 * 1000;
    const rows: StalledRow[] = [];
    for (const f of founders) {
      const company = companyByFounder.get(f.id);
      const stageLabel = STAGE_LABEL[f.journey_stage ?? ""] ?? f.journey_stage ?? "—";
      if (f.stage_approval_status === "pending") {
        rows.push({ company: company?.company_name ?? "Company", companyId: company?.id ?? null, founder: f.full_name ?? "Founder", stage: stageLabel, pending: true, idleDays: null });
        continue;
      }
      const updatedMs = company?.updated_at ? new Date(company.updated_at).getTime() : 0;
      if (updatedMs && updatedMs < idleCutoff) {
        const days = Math.floor((Date.now() - updatedMs) / (24 * 60 * 60 * 1000));
        rows.push({ company: company?.company_name ?? "Company", companyId: company?.id ?? null, founder: f.full_name ?? "Founder", stage: stageLabel, pending: false, idleDays: days });
      }
    }
    if (rows.length === 0) return { staffNotified: 0, stalled: 0 };
    const capped = sortStalled(rows).slice(0, MAX_ROWS);

    const { data: staff } = await db
      .from("profiles")
      .select("id, email, full_name")
      .in("role", ["admin", "analyst"])
      .limit(50);
    const staffRows = (staff ?? []) as { id: string; email: string | null; full_name: string | null }[];
    if (staffRows.length === 0) return { staffNotified: 0, stalled: rows.length };

    const email = buildStaffJourneyDigestEmail(rows);

    let staffNotified = 0;
    for (const s of staffRows) {
      const already = await hasRecentNotification({
        recipientUserId: s.id,
        type: "journey_digest",
        withinHours: DEDUPE_HOURS,
      });
      if (already) continue;

      await createNotification({
        recipientUserId: s.id,
        type: "journey_digest",
        title: `${rows.length} founder${rows.length === 1 ? "" : "s"} need attention`,
        message: `${capped.map((r) => r.company).slice(0, 3).join(", ")}${rows.length > 3 ? ` and ${rows.length - 3} more` : ""} are stalled or awaiting approval.`,
        entityType: "company",
        entityId: null,
      });

      if (s.email) {
        await sendEmail({
          to: s.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          fromName: "iCapOS Ops",
        });
      }
      staffNotified += 1;
    }
    return { staffNotified, stalled: rows.length };
  } catch {
    return { staffNotified: 0, stalled: 0 };
  }
}
