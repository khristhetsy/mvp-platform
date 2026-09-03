// Per-gate automated reminders for the Founder Progress stage gates. While a gate
// is pending, the founder gets a gate-specific email every 3 days telling them what
// to do to resolve it; sending auto-stops when the gate is met and re-arms if it
// regresses. Reminders are ON by default — a pending gate with no row is treated as
// active and gets a row on the first pass. Sent from the iCapOS system email.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import type { StageConditions } from "@/lib/founder-journey/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const REMINDER_INTERVAL_DAYS = 3;
const INTERVAL_MS = REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");

type GateDef = {
  key: string;
  label: string;
  detail: string;
  path: string;
  met: (c: StageConditions) => boolean;
  // Founder-facing "what to do" — drives the reminder body.
  ask: string;
  steps: string[];
};

// Mirrors the gates in FounderJourneyPanel. `path` is where the founder resolves it.
export const GATE_DEFS: GateDef[] = [
  {
    key: "onboarding",
    label: "Onboarding complete",
    detail: "Company profile, funding info, pitch deck",
    path: "/founder/settings",
    met: (c) => c.onboardingComplete,
    ask: "complete your company profile — add your funding info and upload your pitch deck",
    steps: ["Fill in your company profile", "Add your funding information", "Upload your pitch deck"],
  },
  {
    key: "readiness",
    label: "Readiness qualified",
    detail: "Score needs to reach 75",
    path: "/founder/readiness",
    met: (c) => c.readinessQualified,
    ask: "raise your Capital Readiness score to 75 or higher — the diligence checklist shows the gaps to close",
    steps: ["Open your readiness checklist", "Close the flagged gaps", "Upload documents that lift the score"],
  },
  {
    key: "docs",
    label: "Required documents uploaded",
    detail: "Qualify-stage document set",
    path: "/founder/documents",
    met: (c) => c.requiredDocsUploaded,
    ask: "upload the required Preparation document set — financials, cap table, and corporate documents",
    steps: ["See which document categories are missing", "Upload each required document", "Confirm they appear in your data room"],
  },
  {
    key: "dealroom",
    label: "Deal room created",
    detail: "Needed to advance to Marketing",
    path: "/founder/deal-room",
    met: (c) => c.hasDealRoom,
    ask: "set up your deal room — the workspace investors use to diligence your company",
    steps: ["Open Deal Room", "Create your room", "Load your data-room documents"],
  },
  {
    key: "interest",
    label: "Investor interest logged",
    detail: "Signal to move into Closing",
    path: "/founder/matches",
    met: (c) => c.hasInvestorInterest,
    ask: "review your investor matches and start outreach so your first investor interest gets logged",
    steps: ["Open your investor matches", "Reach out to the strongest fits", "Log the first expressed interest"],
  },
];

export const GATE_LABELS: Record<string, string> = Object.fromEntries(GATE_DEFS.map((g) => [g.key, g.label]));

function gateEmail(gate: GateDef, firstName: string) {
  const url = `${SITE_URL}${gate.path}`;
  const subject = `Reminder: ${gate.label.toLowerCase()}`;
  const stepsHtml = gate.steps.map((s) => `<li>${s}</li>`).join("");
  const html = `<p>Hi ${firstName},</p><p>You're one step closer. To clear <b>${gate.label}</b>, please ${gate.ask}.</p><ol>${stepsHtml}</ol><p><a href="${url}">Take care of it now →</a></p><p style="color:#667;font-size:12px">You're receiving this because this item is still open on your iCapOS profile. It stops automatically once it's done. iCapOS is not a broker-dealer and does not raise capital or guarantee funding.</p>`;
  const text = `Hi ${firstName}, to clear "${gate.label}", please ${gate.ask}. Steps: ${gate.steps.join("; ")}. ${url}`;
  return { subject, html, text };
}

/** Preview of the reminder email for a gate (for the admin detail view). */
export function gateEmailPreview(gateKey: string, firstName = "there"): { subject: string; text: string } | null {
  const gate = GATE_DEFS.find((g) => g.key === gateKey);
  if (!gate) return null;
  const { subject, text } = gateEmail(gate, firstName);
  return { subject, text };
}

export type GateReminderStatus = {
  gateKey: string;
  label: string;
  met: boolean;
  paused: boolean;
  sendsCount: number;
  lastSentAt: string | null;
  nextSendAt: string | null;
  resolvedAt: string | null;
  // Derived UI state.
  state: "resolved" | "paused" | "sent" | "scheduled";
  subject: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseDb = SupabaseClient<any>;

type ReminderRow = {
  gate_key: string;
  paused: boolean;
  sends_count: number;
  last_sent_at: string | null;
  next_send_at: string | null;
  resolved_at: string | null;
};

/** Per-gate reminder statuses for one company (for the admin UI). */
export async function getCompanyGateReminders(companyId: string, founderId: string | null): Promise<GateReminderStatus[]> {
  const db = createServiceRoleClient() as unknown as LooseDb;
  let conditions: StageConditions | null = null;
  if (founderId) {
    try {
      const journey = await evaluateFounderJourney(db as unknown as SupabaseClient<Database>, founderId);
      conditions = journey.conditions;
    } catch {
      conditions = null;
    }
  }
  const { data } = await db.from("stage_gate_reminders").select("gate_key, paused, sends_count, last_sent_at, next_send_at, resolved_at").eq("company_id", companyId);
  const rowByKey = new Map<string, ReminderRow>();
  for (const r of (data ?? []) as ReminderRow[]) rowByKey.set(r.gate_key, r);

  return GATE_DEFS.map((gate) => {
    const row = rowByKey.get(gate.key);
    const met = conditions ? gate.met(conditions) : false;
    const paused = row?.paused ?? false;
    let state: GateReminderStatus["state"];
    if (met) state = "resolved";
    else if (paused) state = "paused";
    else if (row?.last_sent_at) state = "sent";
    else state = "scheduled";
    return {
      gateKey: gate.key,
      label: gate.label,
      met,
      paused,
      sendsCount: row?.sends_count ?? 0,
      lastSentAt: row?.last_sent_at ?? null,
      nextSendAt: row?.next_send_at ?? null,
      resolvedAt: row?.resolved_at ?? null,
      state,
      subject: gateEmail(gate, "there").subject,
    };
  });
}

async function sendGate(db: LooseDb, companyId: string, founderId: string | null, email: string, firstName: string, gate: GateDef, existing: ReminderRow | undefined): Promise<boolean> {
  const { subject, html, text } = gateEmail(gate, firstName);
  try {
    await sendEmail({ to: email, subject, html, text, fromName: "iCapOS" });
  } catch {
    return false;
  }
  const now = new Date();
  const next = new Date(now.getTime() + INTERVAL_MS).toISOString();
  await db.from("stage_gate_reminders").upsert(
    {
      company_id: companyId,
      founder_id: founderId,
      gate_key: gate.key,
      paused: existing?.paused ?? false,
      sends_count: (existing?.sends_count ?? 0) + 1,
      last_sent_at: now.toISOString(),
      next_send_at: next,
      resolved_at: null,
      updated_at: now.toISOString(),
    },
    { onConflict: "company_id,gate_key" },
  );
  return true;
}

/** Staff-triggered "Send now" for one gate. */
export async function sendGateReminderNow(companyId: string, founderId: string | null, gateKey: string): Promise<{ ok: boolean; error?: string }> {
  const gate = GATE_DEFS.find((g) => g.key === gateKey);
  if (!gate) return { ok: false, error: "Unknown gate." };
  const db = createServiceRoleClient() as unknown as LooseDb;
  if (!founderId) return { ok: false, error: "No founder linked to this company." };
  const { data: prof } = await db.from("profiles").select("email, full_name").eq("id", founderId).maybeSingle();
  const email = (prof as { email?: string | null } | null)?.email;
  if (!email) return { ok: false, error: "Founder has no email on file." };
  const firstName = ((prof as { full_name?: string | null } | null)?.full_name ?? "").split(" ")[0] || "there";
  const { data: existingRows } = await db.from("stage_gate_reminders").select("gate_key, paused, sends_count, last_sent_at, next_send_at, resolved_at").eq("company_id", companyId).eq("gate_key", gateKey);
  const existing = (existingRows ?? [])[0] as ReminderRow | undefined;
  const sent = await sendGate(db, companyId, founderId, email, firstName, gate, existing);
  return sent ? { ok: true } : { ok: false, error: "Could not send the email." };
}

/** Pause or resume a gate's reminder automation. */
export async function setGateReminderPaused(companyId: string, founderId: string | null, gateKey: string, paused: boolean): Promise<{ ok: boolean }> {
  const db = createServiceRoleClient() as unknown as LooseDb;
  const now = new Date().toISOString();
  await db.from("stage_gate_reminders").upsert(
    { company_id: companyId, founder_id: founderId, gate_key: gateKey, paused, updated_at: now },
    { onConflict: "company_id,gate_key" },
  );
  return { ok: true };
}

/**
 * Nightly pass: for each active company, send any due gate reminders and close out
 * gates that are now met. Bounded + best-effort — never throws into the cron.
 */
export async function runStageGateReminderPass(limit = 400): Promise<{ sent: number; resolved: number }> {
  let sent = 0;
  let resolved = 0;
  try {
    const db = createServiceRoleClient() as unknown as LooseDb;
    // Companies whose founder hasn't finished the journey (skip 'optimize'-complete
    // is hard to know cheaply; include all pre-optimize stages + optimize).
    const { data: comps } = await db
      .from("companies")
      .select("id, founder_id")
      .not("founder_id", "is", null)
      .limit(limit);
    const companies = (comps ?? []) as Array<{ id: string; founder_id: string | null }>;
    if (companies.length === 0) return { sent: 0, resolved: 0 };

    const founderIds = [...new Set(companies.map((c) => c.founder_id).filter(Boolean))] as string[];
    const { data: profs } = await db.from("profiles").select("id, email, full_name").in("id", founderIds);
    const profById = new Map<string, { email: string | null; full_name: string | null }>();
    for (const p of (profs ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>) profById.set(p.id, { email: p.email, full_name: p.full_name });

    const now = Date.now();
    for (const company of companies) {
      if (!company.founder_id) continue;
      const prof = profById.get(company.founder_id);
      if (!prof?.email) continue;
      const firstName = (prof.full_name ?? "").split(" ")[0] || "there";

      let conditions: StageConditions;
      try {
        const journey = await evaluateFounderJourney(db as unknown as SupabaseClient<Database>, company.founder_id);
        conditions = journey.conditions;
      } catch {
        continue;
      }

      const { data: rows } = await db.from("stage_gate_reminders").select("gate_key, paused, sends_count, last_sent_at, next_send_at, resolved_at").eq("company_id", company.id);
      const rowByKey = new Map<string, ReminderRow>();
      for (const r of (rows ?? []) as ReminderRow[]) rowByKey.set(r.gate_key, r);

      for (const gate of GATE_DEFS) {
        const row = rowByKey.get(gate.key);
        const isMet = gate.met(conditions);

        if (isMet) {
          // Auto-stop: mark resolved once (don't send).
          if (row && !row.resolved_at) {
            await db.from("stage_gate_reminders").update({ resolved_at: new Date().toISOString(), next_send_at: null, updated_at: new Date().toISOString() }).eq("company_id", company.id).eq("gate_key", gate.key);
            resolved += 1;
          }
          continue;
        }

        // Pending. Respect pause.
        if (row?.paused) continue;
        // Due when there's no schedule yet (on by default / re-armed) or it's past.
        const due = !row?.next_send_at || new Date(row.next_send_at).getTime() <= now;
        if (!due) continue;

        const ok = await sendGate(db, company.id, company.founder_id, prof.email, firstName, gate, row);
        if (ok) sent += 1;
      }
    }
  } catch {
    /* best-effort — reminders must never break the cron */
  }
  return { sent, resolved };
}
