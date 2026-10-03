/**
 * Email a registered investor when iCFO makes a founder requested introduction.
 *
 * Skipped, and reported as not sent, when: the founder's account may not send
 * real email (demo and internal accounts), the investor paused email or turned
 * the email channel off, or there is no usable address. Never throws.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { loadNotificationPrefs } from "@/lib/notifications/preferences";
import { emailDispatchAllowedForUser } from "@/lib/organizations/organizations";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { formatRaise, renderInvestorIntroEmail } from "@/lib/matching/investor-intro-email";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

function norm(v: string): string {
  return v.trim().toLowerCase();
}

export async function emailInvestorIntroMade(input: {
  introRequestId: string;
  investorUserId: string;
  companyId: string;
  founderId: string | null;
  note: string | null;
  actorUserId: string;
}): Promise<boolean> {
  try {
    const admin = db();
    if (input.founderId && !(await emailDispatchAllowedForUser(admin, input.founderId))) return false;

    const prefs = await loadNotificationPrefs(input.investorUserId);
    if (prefs.pause_all || !prefs.channel_email) return false;

    const [{ data: prof }, { data: co }, { data: ip }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", input.investorUserId).maybeSingle(),
      admin
        .from("companies")
        .select("company_name, industry, funding_stage, funding_amount, funding_amount_band")
        .eq("id", input.companyId)
        .maybeSingle(),
      admin
        .from("investor_profiles")
        .select("preferred_sectors, preferred_stages")
        .eq("profile_id", input.investorUserId)
        .maybeSingle(),
    ]);
    const person = prof as { full_name?: string | null; email?: string | null } | null;
    const email = person?.email?.trim() ?? "";
    if (!email.includes("@")) return false;

    const company = co as {
      company_name?: string | null;
      industry?: string | null;
      funding_stage?: string | null;
      funding_amount?: number | null;
      funding_amount_band?: string | null;
    } | null;
    const prefsRow = ip as { preferred_sectors?: string[] | null; preferred_stages?: string[] | null } | null;

    // Only state an alignment the investor's own saved preferences show.
    const alignedOn: string[] = [];
    if (company?.industry && (prefsRow?.preferred_sectors ?? []).some((s) => norm(s) === norm(company.industry!))) alignedOn.push("industry");
    if (company?.funding_stage && (prefsRow?.preferred_stages ?? []).some((s) => norm(s) === norm(company.funding_stage!))) alignedOn.push("stage");

    const fullName = (person?.full_name ?? "").trim();
    const rendered = renderInvestorIntroEmail({
      firstName: fullName ? fullName.split(/\s+/)[0]! : null,
      companyName: company?.company_name?.trim() || "a company",
      industry: company?.industry ?? null,
      fundingStage: company?.funding_stage ?? null,
      raising: formatRaise(company?.funding_amount ?? null, company?.funding_amount_band ?? null),
      alignedOn,
      note: input.note,
      dashboardUrl: absoluteUrl("/investor/dashboard"),
    });

    return await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      source: "investor-intro-made",
      audience: "investor",
      triggeredBy: input.actorUserId,
    });
  } catch (error) {
    console.error("[capitalos] investor intro email failed", {
      introRequestId: input.introRequestId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
