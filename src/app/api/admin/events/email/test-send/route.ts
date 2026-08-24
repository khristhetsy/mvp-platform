import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { loadEventMergeData, type EventEmailType } from "@/lib/event-email/merge";
import { renderEventEmail } from "@/lib/event-email/render";
import { publishedBookletUrl } from "@/lib/event-hub/brochure/editions";
import { getMarketingSettings } from "@/lib/marketing/settings";
import { emailConfigured, makeUnsubscribeToken, sendMarketingEmail } from "@/lib/marketing/send";

export const dynamic = "force-dynamic";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Quick proof send (spec §9): render the event email and send ONE copy directly to
 *  the requesting staff member (or a supplied address) — no campaign row, no list. */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      type?: EventEmailType;
      includeBanner?: boolean;
      includeLobby?: boolean;
      bookletUrl?: string;
      subject?: string;
      bodyHtml?: string;
      toEmail?: string;
    };
    if (!body.eventId) return NextResponse.json({ error: "Missing event." }, { status: 400 });

    const to = (body.toEmail?.trim() || auth.profile.email || "").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return NextResponse.json({ error: "No valid recipient — add a test address." }, { status: 400 });
    }
    if (!emailConfigured()) {
      return NextResponse.json({ error: "Email provider not configured (set RESEND_API_KEY)." }, { status: 400 });
    }

    const merge = await loadEventMergeData(auth.supabase, body.eventId, { baseUrl: BASE_URL });
    if (!merge) return NextResponse.json({ error: "Couldn't build merge data." }, { status: 500 });

    const type = body.type ?? "invite";
    // Booklet emails must link to the real booklet, not fall back to the event page.
    let bookletUrl = body.bookletUrl;
    if (type === "booklet" && !bookletUrl) {
      bookletUrl = (await publishedBookletUrl(auth.supabase, body.eventId, BASE_URL)) ?? undefined;
    }
    const html = body.bodyHtml?.trim()
      ? body.bodyHtml
      : renderEventEmail(merge, { type, includeBanner: body.includeBanner, includeLobby: body.includeLobby, bookletUrl });

    const settings = await getMarketingSettings();
    const result = await sendMarketingEmail({
      to,
      first_name: "there",
      company: null,
      from_name: settings.default_from_name,
      from_email: settings.default_from_email,
      reply_to: settings.default_reply_to,
      subject: `[TEST] ${body.subject?.trim() || `You're invited: ${merge.title}`}`,
      html_body: html,
      text_body: null,
      unsubscribe_token: makeUnsubscribeToken(to),
    });

    if (!result.ok) return NextResponse.json({ error: result.error ?? "Send failed." }, { status: 502 });
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't send test. ${detail.slice(0, 160)}` }, { status: 500 });
  }
}
