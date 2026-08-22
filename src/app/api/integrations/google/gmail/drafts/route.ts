import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { absolutizeEmailHtml } from "@/lib/email/absolutize-html";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { GmailAttachment } from "@/lib/integrations/gmail-send";
import type { EmailAttachment } from "@/lib/email/inbox";
import {
  createGmailDraft,
  updateGmailDraft,
  deleteGmailDraft,
  getGmailDraft,
  listGmailDraftSummaries,
  fetchGmailAttachmentBytes,
  hasGmailDraftScope,
} from "@/lib/integrations/gmail-drafts";

export const dynamic = "force-dynamic";

const ATTACH_BUCKET = "email-attachments";

const attachmentSchema = z.object({
  name: z.string().max(200),
  path: z.string().max(400),
  size: z.number().int().nonnegative(),
  content_type: z.string().nullish(),
});

const saveSchema = z.object({
  id: z.string().max(200).optional(),
  to: z.string().max(2000).optional(),
  cc: z.string().max(2000).optional(),
  bcc: z.string().max(2000).optional(),
  subject: z.string().max(200).optional(),
  body: z.string().max(26214400).optional(),
  html: z.string().max(26214400).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

async function requireGmailUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const status = await getGoogleConnectionStatus(supabase, user.id);
  if (!status.connected) {
    return { error: NextResponse.json({ error: "Google account not connected. Connect it in Settings." }, { status: 400 }) };
  }
  if (!hasGmailDraftScope(status.scopes)) {
    return { error: NextResponse.json({ error: "Gmail drafts permission not granted. Reconnect your Google account in Settings." }, { status: 400 }) };
  }
  return { userId: user.id };
}

/** Pull the attachment bytes referenced by a save request out of Storage. */
async function loadAttachmentBytes(userId: string, refs: z.infer<typeof attachmentSchema>[]): Promise<GmailAttachment[]> {
  if (refs.length === 0) return [];
  const admin = createServiceRoleClient();
  const owned = refs.filter((a) => a.path.startsWith(`${userId}/`));
  const fetched = await Promise.all(
    owned.map(async (a) => {
      const { data, error } = await admin.storage.from(ATTACH_BUCKET).download(a.path);
      if (error || !data) return null;
      const content = Buffer.from(await data.arrayBuffer());
      return { name: a.name, mimeType: a.content_type ?? "application/octet-stream", content } as GmailAttachment;
    }),
  );
  return fetched.filter((a): a is GmailAttachment => a !== null);
}

function isEmptyDraft(d: z.infer<typeof saveSchema>): boolean {
  const has = (s?: string | null) => Boolean(s && s.trim());
  const bodyText = (d.body ?? "").replace(/<[^>]*>/g, "").trim();
  return !has(d.to) && !has(d.cc) && !has(d.bcc) && !has(d.subject) && !bodyText && (d.attachments?.length ?? 0) === 0;
}

// GET ?id=<draftId>  → full draft for restore (attachments rehydrated to storage)
// GET (no id)        → list of draft summaries for the Drafts folder
export async function GET(request: Request) {
  const auth = await requireGmailUser();
  if ("error" in auth) return auth.error;

  const id = new URL(request.url).searchParams.get("id");

  if (id) {
    const detail = await getGmailDraft(auth.userId, id);
    if ("error" in detail) return NextResponse.json({ error: detail.error.message }, { status: 502 });

    // Re-hydrate attachments: download from Gmail, re-upload to our bucket so the
    // composer treats them like normal uploads and re-saving keeps them attached.
    const admin = createServiceRoleClient();
    const attachments: EmailAttachment[] = [];
    for (const a of detail.attachments) {
      const bytes = await fetchGmailAttachmentBytes(auth.userId, detail.messageId, a.attachmentId);
      if ("error" in bytes) continue;
      const path = `${auth.userId}/${randomUUID()}-${a.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await admin.storage.from(ATTACH_BUCKET).upload(path, bytes, { contentType: a.mimeType, upsert: true });
      if (up.error) continue;
      attachments.push({ name: a.name, path, size: bytes.length, content_type: a.mimeType });
    }

    return NextResponse.json({
      draft: {
        id: detail.draftId,
        to: detail.to,
        cc: detail.cc,
        bcc: detail.bcc,
        subject: detail.subject,
        body: detail.bodyText,
        html: detail.bodyHtml,
        attachments,
      },
    });
  }

  const summaries = await listGmailDraftSummaries(auth.userId);
  if ("error" in summaries) return NextResponse.json({ error: summaries.error.message }, { status: 502 });
  return NextResponse.json({ drafts: summaries });
}

// POST → create (no id) or update (id) the Gmail draft; returns the (stable) draft id.
export async function POST(request: Request) {
  const auth = await requireGmailUser();
  if ("error" in auth) return auth.error;

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  if (isEmptyDraft(parsed.data)) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const attachments = await loadAttachmentBytes(auth.userId, parsed.data.attachments ?? []);
  const msg = {
    to: (parsed.data.to ?? "").trim(),
    cc: (parsed.data.cc ?? "").trim() || null,
    bcc: (parsed.data.bcc ?? "").trim() || null,
    subject: parsed.data.subject ?? "",
    body: parsed.data.body ?? "",
    html: parsed.data.html ? absolutizeEmailHtml(parsed.data.html) : null,
    attachments,
  };

  let result = parsed.data.id
    ? await updateGmailDraft(auth.userId, parsed.data.id, msg)
    : await createGmailDraft(auth.userId, msg);

  // Draft was sent/deleted elsewhere — recreate rather than fail the autosave.
  if ("error" in result && result.error.message === "draft_not_found") {
    result = await createGmailDraft(auth.userId, msg);
  }
  if ("error" in result) return NextResponse.json({ error: result.error.message }, { status: 502 });

  return NextResponse.json({ id: result.id, savedAt: new Date().toISOString() });
}

// DELETE ?id=<draftId>
export async function DELETE(request: Request) {
  const auth = await requireGmailUser();
  if ("error" in auth) return auth.error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "A draft id is required." }, { status: 400 });

  const result = await deleteGmailDraft(auth.userId, id);
  if ("error" in result) return NextResponse.json({ error: result.error.message }, { status: 502 });
  return NextResponse.json({ success: true });
}
