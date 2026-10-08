/**
 * Send message from the Sales Hub chatter, through iCapOS or through Gmail.
 *  GET  → which mailboxes the signed-in person can send from
 *  POST { via: "icapos" | "gmail", to, cc?, subject, body }
 *
 * iCapOS: starts an iCapOS inbox thread (Resend, sent as you from your own address when
 * its domain is verified in Resend, else your name on the platform address; your saved
 * signature), so the contact's replies land in the iCapOS inbox.
 * Gmail: sends from the person's connected Google account, like the Gmail send route.
 * Either way the send is logged on the contact's timeline with a "via" badge.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { sendViaGmail } from "@/lib/integrations/gmail-send";
import { composeThread } from "@/lib/email/inbox";
import { parseRecipients, previewFrom } from "@/lib/email/send-email";
import { logOutboundEmailActivity } from "@/lib/sales/activity";
import { scheduleAtFrom, scheduleSend } from "@/lib/scheduled-emails/schedule";

export const dynamic = "force-dynamic";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export async function GET(): Promise<Response> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, profile } = auth;
  const google = await getGoogleConnectionStatus(supabase, profile.id);
  return NextResponse.json({
    icapos: await previewFrom(profile.full_name ?? profile.email ?? null, profile.email),
    gmail: {
      connected: google.connected,
      canSend: google.connected && google.scopes.includes(GMAIL_SEND_SCOPE),
      email: google.email,
    },
  });
}

const sendSchema = z.object({
  via: z.enum(["icapos", "gmail"]),
  to: z.string().min(3).max(2000),
  toName: z.string().max(200).optional().nullable(),
  cc: z.string().max(2000).optional().nullable(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(100_000),
});

export async function POST(req: Request): Promise<Response> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, profile } = auth;

  const raw: unknown = await req.json().catch(() => ({}));
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Add a recipient, subject, and message." }, { status: 400 });
  const { via, to, toName, cc, subject, body } = parsed.data;

  const toList = parseRecipients(to);
  const ccList = parseRecipients(cc);
  if (toList.length === 0) return NextResponse.json({ error: "Add a valid email address." }, { status: 400 });

  if (scheduleAtFrom(raw)) {
    // Schedule send: stored now, sent through this route at that time (scheduled-emails/runner).
    return scheduleSend({ kind: "sales_chatter", userId: profile.id, raw, toLabel: toName ? `${toName} <${toList[0]}>` : toList.join(", "), subject });
  }

  if (via === "icapos") {
    try {
      const thread = await composeThread(
        supabase,
        { id: profile.id, email: profile.email, name: profile.full_name },
        { to: toList.join(", "), toName: toName ?? null, cc: ccList.join(", ") || null, subject, body },
      );
      if (!thread.sent) {
        return NextResponse.json({ error: "iCapOS couldn't send the email. Try again, or send via Gmail." }, { status: 502 });
      }
      await logOutboundEmailActivity([...toList, ...ccList], subject, profile.id, 25, "icapos");
      return NextResponse.json({ ok: true, via, threadId: thread.id });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't send the email." }, { status: 500 });
    }
  }

  const google = await getGoogleConnectionStatus(supabase, profile.id);
  if (!google.connected) return NextResponse.json({ error: "Gmail isn't connected. Connect Google, or send via iCapOS." }, { status: 400 });
  if (!google.scopes.includes(GMAIL_SEND_SCOPE)) {
    return NextResponse.json({ error: "Gmail send permission isn't granted. Reconnect Google, or send via iCapOS." }, { status: 400 });
  }
  const result = await sendViaGmail({ userId: profile.id, to: toList.join(", "), cc: ccList.join(", ") || null, subject, body });
  if ("error" in result) return NextResponse.json({ error: result.error.message }, { status: 502 });
  await logOutboundEmailActivity([...toList, ...ccList], subject, profile.id, 25, "gmail");
  return NextResponse.json({ ok: true, via, messageId: result.messageId });
}
