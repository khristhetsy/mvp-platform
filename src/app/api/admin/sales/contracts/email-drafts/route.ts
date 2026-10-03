import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, requireContractsApi } from "@/lib/contracts/access";
import { listEmailDrafts, saveEmailDraft } from "@/lib/contracts/email-drafts";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ drafts: await listEmailDrafts(auth.actor.db) });
}

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(200).nullable().optional(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
});

/** POST — Save to library (explicit; per-send edits never write back on their own). */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Give the draft a name, subject and body.");
  const draft = await saveEmailDraft(auth.actor.db, { ...parsed.data, description: parsed.data.description ?? null, userId: auth.actor.userId });
  await writeAuditLog(auth.actor.db, { userId: auth.actor.userId, action: "contracts.email_draft_saved", entityType: "marketing_templates", entityId: draft.id });
  return NextResponse.json({ draft });
}
