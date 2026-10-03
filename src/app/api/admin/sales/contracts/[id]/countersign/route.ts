import { NextResponse } from "next/server";
import { z } from "zod";
import { bad } from "@/lib/contracts/access";
import { countersign, SendBlockedError } from "@/lib/contracts/service";
import { actorAndBundle, errorMessage } from "@/lib/contracts/route-helpers";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  signature: z.string().max(3_000_000),
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120),
  saveToDrive: z.boolean().optional(),
});

/** POST — iCFO countersigns; the executed copy and certificate go to the prospect automatically. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Add your signature and name.");
  try {
    const result = await countersign(actor.db, b.doc.id, {
      ...parsed.data,
      signer: { id: actor.userId, email: actor.profile.email ?? null, actorLabel: actor.actorLabel, displayName: actor.profile.full_name ?? parsed.data.name },
    });
    await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.countersigned", entityType: "contract_documents", entityId: b.doc.id, metadata: { sha256: result.hash, saved_to_drive: result.drive?.saved ?? false } });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SendBlockedError) return bad(err.message, 409);
    return NextResponse.json({ error: errorMessage(err, "Countersign failed.") }, { status: 500 });
  }
}
