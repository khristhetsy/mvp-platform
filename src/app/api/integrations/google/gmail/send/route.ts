import { NextResponse } from "next/server";
import { z } from "zod";
import { sendViaGmail, type GmailAttachment } from "@/lib/integrations/gmail-send";
import { parseRecipients } from "@/lib/email/send-email";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const attachmentSchema = z.object({
  name: z.string().max(200),
  path: z.string().max(400),
  size: z.number().int().nonnegative(),
  content_type: z.string().nullish(),
});

const sendSchema = z.object({
  to: z.string().min(1).max(2000),
  cc: z.string().max(2000).optional(),
  bcc: z.string().max(2000).optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  html: z.string().max(60000).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const status = await getGoogleConnectionStatus(supabase, user.id);
  if (!status.connected) {
    return NextResponse.json(
      { error: "Google account not connected. Connect it in Settings." },
      { status: 400 },
    );
  }

  const hasGmailScope = status.scopes.includes("https://www.googleapis.com/auth/gmail.send");
  if (!hasGmailScope) {
    return NextResponse.json(
      { error: "Gmail send permission not granted. Reconnect your Google account in Settings." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  // Fetch attachment bytes from storage (paths are namespaced by profile id).
  let attachments: GmailAttachment[] = [];
  if (parsed.data.attachments && parsed.data.attachments.length > 0) {
    const admin = createServiceRoleClient();
    const owned = parsed.data.attachments.filter((a) => a.path.startsWith(`${user.id}/`));
    const fetched = await Promise.all(
      owned.map(async (a) => {
        const { data, error } = await admin.storage.from("email-attachments").download(a.path);
        if (error || !data) return null;
        const content = Buffer.from(await data.arrayBuffer());
        return { name: a.name, mimeType: a.content_type ?? "application/octet-stream", content } as GmailAttachment;
      }),
    );
    attachments = fetched.filter((a): a is GmailAttachment => a !== null);
  }

  const toList = parseRecipients(parsed.data.to);
  if (toList.length === 0) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }

  const result = await sendViaGmail({
    userId: user.id,
    to: toList.join(", "),
    cc: parseRecipients(parsed.data.cc).join(", ") || null,
    bcc: parseRecipients(parsed.data.bcc).join(", ") || null,
    subject: parsed.data.subject,
    body: parsed.data.body,
    html: parsed.data.html ?? null,
    attachments,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}
