import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getBrandedTemplate } from "@/lib/email/branded-templates";
import { sendCopyToRecipient } from "@/lib/email/send-copy";

// POST — send the saved branded template to the signed-in admin, marked [TEST].
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    if (!profile.email) return NextResponse.json({ error: "Your profile has no email address." }, { status: 400 });
    const { id } = await params;
    const found = await getBrandedTemplate(id);
    if (!found) return NextResponse.json({ error: "Branded template not found." }, { status: 404 });
    const result = await sendCopyToRecipient(
      found.copy,
      { email: profile.email, firstName: (profile as { full_name?: string | null }).full_name?.split(" ")[0] },
      { subject: found.template.subject, test: true },
    );
    if (!result.ok) {
      const status = result.reason === "not_configured" ? 503 : result.reason === "suppressed" ? 409 : 502;
      return NextResponse.json({ error: result.message }, { status });
    }
    return NextResponse.json({ to: profile.email });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
