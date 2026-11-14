import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { resendLoginLink } from "@/lib/billing/paid-signup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MESSAGES: Record<string, { status: number; error: string }> = {
  not_found: { status: 404, error: "This payment was not found." },
  not_paid: { status: 409, error: "This signup has not been paid yet." },
  claimed: { status: 409, error: "The login is already created. Nothing to send." },
  expired: { status: 410, error: "The 30 day window to create this login has closed." },
  cooldown: { status: 429, error: "A link was sent a moment ago. Try again in a few minutes." },
  send_failed: { status: 502, error: "The email was not sent. Email may be turned off or the provider is not configured." },
};

/** POST /api/admin/billing/paid-signups/[id]: a staff member (manage_billing) sends the private login link again. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_billing");
  if ("error" in auth) return auth.error as Response;
  const { id } = await params;
  const result = await resendLoginLink(id);
  if (result.ok) return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
  const m = MESSAGES[result.reason] ?? { status: 400, error: "Could not send the link." };
  return NextResponse.json({ error: m.error }, { status: m.status });
}
