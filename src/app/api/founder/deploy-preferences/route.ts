import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getDeployPreferences,
  setDeployPreferences,
  normalizeDoNotContact,
  DEFAULT_DEPLOY_PREFERENCES,
  type DeployPreferences,
} from "@/lib/founder/deploy-preferences";

export const dynamic = "force-dynamic";

/** Resolve the signed-in founder's company id (their own company). */
async function resolveFounderCompany(): Promise<{ companyId: string } | { error: Response }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("founder_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return { error: NextResponse.json({ error: "No company found." }, { status: 404 }) };
  return { companyId: String(data.id) };
}

// GET — the founder's current deploy preferences.
export async function GET(): Promise<Response> {
  const gate = await resolveFounderCompany();
  if ("error" in gate) return gate.error;
  const prefs = await getDeployPreferences(gate.companyId);
  return NextResponse.json({ prefs });
}

// PATCH { notifications, doNotContact } — save the founder's deploy preferences.
export async function PATCH(req: Request): Promise<Response> {
  const gate = await resolveFounderCompany();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => null)) as
    | { notifications?: unknown; doNotContact?: unknown }
    | null;

  const notifications: Record<string, boolean> = { ...DEFAULT_DEPLOY_PREFERENCES.notifications };
  if (body?.notifications && typeof body.notifications === "object") {
    for (const [k, v] of Object.entries(body.notifications as Record<string, unknown>)) {
      if (typeof v === "boolean") notifications[k] = v;
    }
  }

  const rawList = Array.isArray(body?.doNotContact)
    ? (body!.doNotContact as unknown[]).map((x) => String(x))
    : typeof body?.doNotContact === "string"
      ? (body!.doNotContact as string).split(/[\n,]+/)
      : [];
  const doNotContact = normalizeDoNotContact(rawList).slice(0, 2000);

  const prefs: DeployPreferences = { notifications, doNotContact };
  const ok = await setDeployPreferences(gate.companyId, prefs);
  if (!ok) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true, prefs });
}
