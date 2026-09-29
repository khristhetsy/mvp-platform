import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { resolveFrom, TRANSACTIONAL_FROM_ENV } from "@/lib/email/send-email";
import { logOutboundEmail } from "@/lib/email/email-log";

const RESEND_API_URL = "https://api.resend.com/emails";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 3 requests per hour per user
  const rateLimited = await enforceRateLimit({
    bucket: "live-agent-request",
    subjectId: auth.profile.id,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimited) return rateLimited as Response;

  const body = await req.json().catch(() => ({})) as { currentPath?: string };
  const currentPath = typeof body.currentPath === "string" ? body.currentPath : "Unknown";

  const founderName = auth.profile.full_name ?? auth.profile.email ?? "A founder";
  const founderEmail = auth.profile.email ?? "unknown";
  const adminEmail =
    process.env.ADMIN_SUPPORT_EMAIL?.trim() ??
    process.env.TRANSACTIONAL_EMAIL_FROM?.replace(/.*<(.+)>/, "$1").trim() ??
    "info@myicfos.com";

  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (apiKey) {
    const subject = `Live agent requested — ${founderName}`;
    const text = [
      `A founder has requested a live agent via the iCapOS AI assistant.`,
      ``,
      `Founder: ${founderName} (${founderEmail})`,
      `Page: ${currentPath}`,
      `Time: ${new Date().toUTCString()}`,
      ``,
      `Please follow up via the platform Messages or email.`,
    ].join("\n");
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resolveFrom({ envKeys: TRANSACTIONAL_FROM_ENV }),
        to: [adminEmail],
        subject,
        text,
      }),
    }).catch((err) => {
      console.error("[live-agent-request] Email send failed:", err);
      return null;
    });
    const sent = res?.ok ? ((await res.json().catch(() => null)) as { id?: string } | null) : null;
    await logOutboundEmail({
      to: adminEmail,
      subject,
      text,
      status: res?.ok ? "sent" : "failed",
      error: res?.ok ? null : `Email provider error ${res?.status ?? "network"}`,
      providerId: sent?.id ?? null,
      source: "live-agent-request",
      triggeredBy: auth.profile.id,
    });
  }

  return NextResponse.json({ received: true });
}
