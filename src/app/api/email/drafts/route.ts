import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { listDrafts, saveDraft, deleteDraft } from "@/lib/email/drafts";

export const dynamic = "force-dynamic";

const attachmentSchema = z.object({
  name: z.string().max(200),
  path: z.string().max(400),
  size: z.number().int().nonnegative(),
  content_type: z.string().nullish(),
});

const saveSchema = z.object({
  id: z.string().uuid().nullish(),
  to: z.string().max(200).nullish(),
  subject: z.string().max(300).nullish(),
  body: z.string().max(50000).nullish(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

/** GET — list the current user's drafts. */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const drafts = await listDrafts(auth.supabase, auth.profile.id);
  return NextResponse.json({ drafts });
}

/** POST — create or update a draft. */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = saveSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid draft." }, { status: 400 });

  const draft = await saveDraft(auth.supabase, auth.profile.id, {
    id: parsed.data.id ?? null,
    to: parsed.data.to ?? null,
    subject: parsed.data.subject ?? null,
    body: parsed.data.body ?? null,
    attachments: parsed.data.attachments?.map((a) => ({ ...a, content_type: a.content_type ?? null })),
  });
  return NextResponse.json({ draft });
}

const deleteSchema = z.object({ id: z.string().uuid() });

/** DELETE — discard a draft. */
export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "id required." }, { status: 400 });
  await deleteDraft(auth.supabase, auth.profile.id, parsed.data.id);
  return NextResponse.json({ ok: true });
}
