/**
 * Daily admin digest of founder introduction requests.
 *
 * Recipients are the Account Activity owners of the Marketing stage (super
 * admins when nobody holds it), the same people the in-app alert goes to, each
 * filtered by their own digest setting for "Founder requested an intro".
 * Nothing is sent when there are no new requests and none waiting.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { loadNotificationPrefs } from "@/lib/notifications/preferences";
import { activityClass } from "@/lib/activity/stages";
import { activityPrefsFrom, effectiveClassPref } from "@/lib/activity/preferences";
import { resolveRecipients } from "@/lib/activity/assignments";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { PROSPECT_ID_PREFIX } from "@/lib/matching/prospect-investors";
import {
  digestIsEmpty,
  renderIntroDigestEmail,
  type DigestRequest,
  type IntroDigestInput,
} from "@/lib/matching/intro-request-digest-email";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type Row = { id: string; company_id: string; created_at: string; ref: string; kind: "prospect" | "member" };

async function namesFor(rows: Row[]): Promise<{ companies: Map<string, string>; investors: Map<string, string> }> {
  const admin = db();
  const companyIds = [...new Set(rows.map((r) => r.company_id))];
  const prospectIds = [...new Set(rows.filter((r) => r.kind === "prospect").map((r) => r.ref.slice(PROSPECT_ID_PREFIX.length)))];
  const memberIds = [...new Set(rows.filter((r) => r.kind === "member").map((r) => r.ref))];
  const [c, p, m] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id, company_name").in("id", companyIds) : Promise.resolve({ data: [] }),
    prospectIds.length ? admin.from("prospect_investors").select("id, name").in("id", prospectIds) : Promise.resolve({ data: [] }),
    memberIds.length ? admin.from("profiles").select("id, full_name, email").in("id", memberIds) : Promise.resolve({ data: [] }),
  ]);
  const companies = new Map<string, string>();
  for (const r of (c.data ?? []) as Array<{ id: string; company_name: string | null }>) companies.set(r.id, r.company_name || "A founder");
  const investors = new Map<string, string>();
  for (const r of (p.data ?? []) as Array<{ id: string; name: string | null }>) investors.set(`${PROSPECT_ID_PREFIX}${r.id}`, r.name || "an investor");
  for (const r of (m.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) investors.set(r.id, r.full_name || r.email || "an investor");
  return { companies, investors };
}

/** Builds the digest content for the 24 hours before `now`. */
export async function loadIntroDigest(now: Date = new Date()): Promise<IntroDigestInput> {
  const admin = db();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [prospectFresh, memberFresh, prospectWaiting, memberWaiting] = await Promise.all([
    admin.from("prospect_intro_requests").select("id, company_id, investor_ref, created_at").gte("created_at", since).order("created_at", { ascending: false }),
    admin
      .from("intro_requests")
      .select("id, company_id, investor_id, created_at")
      .eq("direction", "founder_to_investor")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    admin.from("prospect_intro_requests").select("created_at").eq("status", "new"),
    admin.from("intro_requests").select("created_at").eq("direction", "founder_to_investor").in("status", ["requested", "reviewing"]),
  ]);

  const fresh: Row[] = [
    ...((prospectFresh.data ?? []) as Array<{ id: string; company_id: string; investor_ref: string; created_at: string }>).map((r) => ({
      id: r.id,
      company_id: r.company_id,
      created_at: r.created_at,
      ref: r.investor_ref,
      kind: "prospect" as const,
    })),
    ...((memberFresh.data ?? []) as Array<{ id: string; company_id: string; investor_id: string | null; created_at: string }>)
      .filter((r) => r.investor_id)
      .map((r) => ({ id: r.id, company_id: r.company_id, created_at: r.created_at, ref: r.investor_id as string, kind: "member" as const })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const { companies, investors } = await namesFor(fresh);
  const freshList: DigestRequest[] = fresh.map((r) => ({
    companyName: companies.get(r.company_id) ?? "A founder",
    investorName: investors.get(r.ref) ?? "an investor",
    kind: r.kind,
  }));

  const waitingDates = [
    ...((prospectWaiting.data ?? []) as Array<{ created_at: string }>),
    ...((memberWaiting.data ?? []) as Array<{ created_at: string }>),
  ].map((r) => new Date(r.created_at).getTime()).filter((t) => Number.isFinite(t));
  const oldest = waitingDates.length ? Math.min(...waitingDates) : null;

  return {
    fresh: freshList,
    waiting: waitingDates.length,
    oldestWaitingDays: oldest === null ? null : Math.floor((now.getTime() - oldest) / (24 * 60 * 60 * 1000)),
    prospectQueueUrl: absoluteUrl("/admin/prospect-intros"),
    memberQueueUrl: absoluteUrl("/admin/intro-requests"),
  };
}

export type IntroDigestRun = { fresh: number; waiting: number; recipients: number; sent: number; skipped: Record<string, number> };

export async function runIntroRequestDigest(now: Date = new Date()): Promise<IntroDigestRun> {
  const digest = await loadIntroDigest(now);
  const run: IntroDigestRun = { fresh: digest.fresh.length, waiting: digest.waiting, recipients: 0, sent: 0, skipped: {} };
  const skip = (reason: string) => {
    run.skipped[reason] = (run.skipped[reason] ?? 0) + 1;
  };
  if (digestIsEmpty(digest)) {
    skip("nothing new or waiting");
    return run;
  }

  const cls = activityClass("founder_intro_requested");
  if (!cls) return run;
  const { userIds } = await resolveRecipients(cls.stage, cls);
  run.recipients = userIds.length;
  const rendered = renderIntroDigestEmail(digest);
  const admin = db();

  for (const userId of userIds) {
    const prefs = await loadNotificationPrefs(userId);
    if (prefs.pause_all) { skip("paused"); continue; }
    if (!prefs.channel_email) { skip("email channel off"); continue; }
    if (!effectiveClassPref(activityPrefsFrom(prefs), cls.key).digest) { skip("digest off for this alert"); continue; }
    const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
    const email = (data as { email?: string | null } | null)?.email?.trim() ?? "";
    if (!email.includes("@")) { skip("no email address"); continue; }
    const ok = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      source: "intro-request-digest",
      audience: "staff",
    });
    if (ok) run.sent += 1;
    else skip("send failed or email not configured");
  }
  return run;
}
