import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { sendEmail } from "@/lib/email/send-email";
import {
  PROSPECT_INTRO_EMAIL_SOURCE,
  defaultIntroDraft,
  introHtml,
  loadProspectIntroTarget,
} from "@/lib/matching/prospect-intro-send";

export const dynamic = "force-dynamic";

// GET /api/admin/prospect-intros/[id]/send: the draft the admin reviews. Staff only.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const target = await loadProspectIntroTarget(id);
  if (!target) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const staffName = auth.profile.full_name?.trim() || "iCFO Capital Global";
  const draft = defaultIntroDraft(target, staffName);
  return NextResponse.json({ to: target.email, investorName: target.investorName, ...draft });
}

// POST /api/admin/prospect-intros/[id]/send: send the intro email from iCapOS. Staff only.
// Body: { subject, message }. The status change stays a separate call to the existing route.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { subject?: string; message?: string } | null;
  const subject = body?.subject?.trim() ?? "";
  const message = body?.message?.trim() ?? "";
  if (!subject || !message) return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });

  const target = await loadProspectIntroTarget(id);
  if (!target) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (target.status === "dismissed") return NextResponse.json({ error: "This request was dismissed. Reopen it first." }, { status: 409 });
  if (!target.email || !target.email.includes("@")) {
    return NextResponse.json({ error: "This investor has no email address on file." }, { status: 422 });
  }

  const ok = await sendEmail({
    to: target.email,
    subject,
    html: introHtml(message),
    text: message,
    replyTo: auth.profile.email ?? undefined,
    fromName: auth.profile.full_name ?? undefined,
    fromAddress: auth.profile.email ?? null,
    source: PROSPECT_INTRO_EMAIL_SOURCE,
    audience: "investor",
    triggeredBy: auth.profile.id,
  });
  if (!ok) return NextResponse.json({ error: "The email could not be sent. Nothing was recorded as sent." }, { status: 502 });
  return NextResponse.json({ ok: true, to: target.email });
}
