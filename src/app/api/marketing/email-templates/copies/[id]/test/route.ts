import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getCopyWithMaster } from "@/lib/email/masters-queries";
import { sendCopyToRecipient } from "@/lib/email/send-copy";

// Send test email (build spec §5/§6): renders the current copy and sends it to
// the logged-in admin, flagged [TEST]. Suppression is still enforced.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    if (!profile.email) {
      return NextResponse.json({ error: "Your profile has no email address." }, { status: 400 });
    }
    const { id } = await params;
    const copy = await getCopyWithMaster(id);
    if (!copy) return NextResponse.json({ error: "Template copy not found." }, { status: 404 });

    const result = await sendCopyToRecipient(
      copy,
      { email: profile.email, firstName: (profile as { full_name?: string | null }).full_name },
      { subject: copy.name, test: true },
    );

    if (!result.ok) {
      const status = result.reason === "not_configured" ? 503 : result.reason === "suppressed" ? 409 : 502;
      return NextResponse.json({ error: result.message }, { status });
    }
    return NextResponse.json({ to: profile.email, resendId: result.resendId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test send failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
