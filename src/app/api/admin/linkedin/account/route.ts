import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { event, getOrCreateAccount, updateAccount } from "@/lib/linkedin/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  safety_level: z.enum(["careful", "standard", "custom"]).optional(),
  custom_daily_cap: z.number().int().min(1).max(20).nullable().optional(),
  custom_weekly_cap: z.number().int().min(1).max(80).nullable().optional(),
  manual_allowance: z.number().int().min(0).max(20).optional(),
  high_value_tag: z.string().trim().max(60).nullable().optional(),
  send_on_schedule: z.boolean().optional(),
  handoff_enabled: z.boolean().optional(),
  withdraw_pending: z.boolean().optional(),
  weekly_summary: z.boolean().optional(),
  resume: z.boolean().optional(),
});

/** PUT: change the account's safety level and Autopilot settings. The rules that must stay on are not settings. */
export async function PUT(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  try {
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    const { resume, ...rest } = parsed.data;
    // Resume after a LinkedIn warning. Only a person can do this, never the sender.
    const patch = resume && account.status === "warning" ? { ...rest, status: "connected" as const, paused_reason: null } : rest;
    const updated = await updateAccount(account.id, patch);
    if (resume && account.status === "warning") await event({ account_id: account.id, kind: "resumed", detail: "Resumed after a warning", created_by: auth.profile.id });
    return NextResponse.json({ account: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 500 });
  }
}
