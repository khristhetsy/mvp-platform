import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { getAppUrl } from "@/lib/env";
import { isPrivateBetaMode } from "@/lib/env/private-beta";
import { writeAuditLog } from "@/lib/data/audit";

const inviteSchema = z.object({
  role: z.enum(["founder", "investor"]),
  email: z.string().email().optional(),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const baseUrl = getAppUrl() ?? "http://localhost:3000";
  const params = new URLSearchParams({ role: parsed.data.role });
  if (parsed.data.email) params.set("email", parsed.data.email);
  if (isPrivateBetaMode()) params.set("beta", "1");

  const inviteUrl = `${baseUrl}/auth/sign-up?${params.toString()}`;

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "beta.invite_link_generated",
    entityType: "beta_invite",
    entityId: null,
    metadata: {
      role: parsed.data.role,
      email: parsed.data.email ?? null,
      privateBetaMode: isPrivateBetaMode(),
    },
  });

  return NextResponse.json({
    inviteUrl,
    role: parsed.data.role,
    privateBetaMode: isPrivateBetaMode(),
    instructions:
      parsed.data.role === "investor"
        ? "Investor must complete onboarding and await staff approval before marketplace access."
        : "Founder should complete company onboarding and document uploads after signup.",
  });
}
