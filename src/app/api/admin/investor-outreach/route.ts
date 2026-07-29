import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  listOutreachCampaigns,
  getCampaignRecipients,
  type OutreachCampaign,
} from "@/lib/outreach/investor-outreach";
import { getOutreachAutomationEnabled, setOutreachAutomationEnabled } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";

/**
 * Staff gate for investor-outreach routes: resolves the signed-in user, reads
 * their `profiles.role`, and allows only `admin` or `analyst`. Returns the
 * user id on success (needed to attribute approvals) or a JSON error Response.
 */
async function requireStaff(): Promise<
  { userId: string } | { error: Response }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "analyst")) {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }

  return { userId: user.id };
}

export type OutreachCampaignSummary = OutreachCampaign & {
  companyName: string;
  audienceCount: number;
  queuedCount: number;
  sentCount: number;
};

// GET — list all outreach campaigns enriched with company name + recipient counts.
export async function GET(): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const campaigns = await listOutreachCampaigns();
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  const summaries = await Promise.all(
    campaigns.map(async (campaign): Promise<OutreachCampaignSummary> => {
      const recipients = await getCampaignRecipients(campaign.id);
      const queuedCount = recipients.filter((r) => r.status === "queued").length;
      const sentCount = recipients.filter((r) => r.status === "sent").length;

      const { data: company } = await admin
        .from("companies")
        .select("company_name")
        .eq("id", campaign.company_id)
        .maybeSingle();
      const companyName =
        (company as { company_name?: string | null } | null)?.company_name ?? "Unknown company";

      return {
        ...campaign,
        companyName,
        audienceCount: recipients.length,
        queuedCount,
        sentCount,
      };
    }),
  );

  return NextResponse.json({ campaigns: summaries, liveSend: await getOutreachAutomationEnabled() });
}

// PATCH — flip the outreach automation master switch on/off (admin-controlled).
export async function PATCH(req: Request): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => null)) as { action?: string; enabled?: unknown } | null;
  if (body?.action !== "set_automation" || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Expected { action: 'set_automation', enabled: boolean }." }, { status: 400 });
  }

  const ok = await setOutreachAutomationEnabled(body.enabled, gate.userId);
  return NextResponse.json({ ok, liveSend: body.enabled });
}
