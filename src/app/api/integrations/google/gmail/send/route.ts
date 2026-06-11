import { NextResponse } from "next/server";
import { z } from "zod";
import { sendViaGmail } from "@/lib/integrations/gmail-send";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
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

  const result = await sendViaGmail({
    userId: user.id,
    to: parsed.data.to,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}
