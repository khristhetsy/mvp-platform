import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, requireContractsApi } from "@/lib/contracts/access";
import { archiveEmailDraft, updateEmailDraft } from "@/lib/contracts/email-drafts";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(200).nullable().optional(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
});

/** PATCH — edit a cover email draft in the library. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Give the draft a name, subject and body.");
  try {
    const draft = await updateEmailDraft(auth.actor.db, id, { ...parsed.data, description: parsed.data.description || null });
    await writeAuditLog(auth.actor.db, { userId: auth.actor.userId, action: "contracts.email_draft_edited", entityType: "marketing_templates", entityId: id });
    return NextResponse.json({ draft });
  } catch (err) {
    return bad(err instanceof Error ? err.message : "Could not save the draft.", 404);
  }
}

/** DELETE — remove a draft from the library (archived). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const ok = await archiveEmailDraft(auth.actor.db, id).catch(() => false);
  if (!ok) return bad("Draft not found.", 404);
  await writeAuditLog(auth.actor.db, { userId: auth.actor.userId, action: "contracts.email_draft_removed", entityType: "marketing_templates", entityId: id });
  return NextResponse.json({ ok: true });
}
