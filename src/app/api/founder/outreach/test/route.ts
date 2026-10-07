import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { renderManualEmail } from "@/lib/outreach/manual-template";
import { buildUnsubscribeUrl } from "@/lib/outreach/unsubscribe";
import { sendEmail } from "@/lib/email/send-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { normalizeAttachments, withOnePagerLink } from "@/lib/outreach/manual-attachments";
import { buildManualAttachments } from "@/lib/outreach/manual-attachments.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Send a preview of the manual outreach email to the founder's own inbox.
 * Uses the founder's own details as the merge sample. Sends regardless of
 * INVESTOR_OUTREACH_LIVE (it only goes to the founder), but needs the email
 * provider (RESEND_API_KEY) configured.
 */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const email = auth.profile.email;
  if (!email) return NextResponse.json({ error: "Your account has no email on file." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { subject?: unknown; body?: unknown; attachments?: unknown } | null;
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const att = normalizeAttachments(body?.attachments);
  const emailBody = withOnePagerLink(typeof body?.body === "string" ? body.body : "", att);
  if (!emailBody.trim()) {
    return NextResponse.json({ error: "Add an email body before sending a test." }, { status: 400 });
  }

  const company = await ensureFounderCompanyForUser(auth.profile);
  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
  const previewUrl = company?.is_published && company?.slug ? `${appBase}/f/${company.slug}` : null;
  const firstName = (auth.profile.full_name ?? "").trim().split(/\s+/)[0] || null;

  const rendered = renderManualEmail(subject, emailBody, {
    firstName,
    company: company?.company_name ?? "your company",
    sector: company?.industry ?? null,
    previewUrl,
    unsubscribeUrl: buildUnsubscribeUrl(email),
  });

  // Same attachments the investors get, so the test shows exactly what lands.
  let attachments: Array<{ filename: string; content: string }> = [];
  if (company?.id) {
    try {
      attachments = (await buildManualAttachments(createServiceRoleClient() as unknown as SupabaseClient, company.id, att)).attachments;
    } catch {
      attachments = [];
    }
  }

  const ok = await sendEmail({
    to: email,
    subject: `[Test] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Couldn't send — email delivery isn't configured yet (RESEND_API_KEY)." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sentTo: email });
}
