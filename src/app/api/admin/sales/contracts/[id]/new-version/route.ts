import { NextResponse } from "next/server";
import { bad } from "@/lib/contracts/access";
import { newVersionFrom } from "@/lib/contracts/store";
import { actorAndBundle } from "@/lib/contracts/route-helpers";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

/** POST — edit after send: a new draft version. The sent version stays retrievable, unchanged. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  if (!b.doc.locked) return bad("This version is still a draft; edit it directly.");
  if (b.doc.status === "sent" || b.doc.status === "viewed") return bad("Cancel the pending signature request before creating a new version.", 409);
  if (b.doc.status === "signed" || b.doc.status === "awaiting_countersign") return bad("A signed document cannot be revised.", 409);
  const { data: newer } = await actor.db.from("contract_documents").select("id").eq("document_key", b.doc.document_key).gt("version", b.doc.version).limit(1);
  if (newer?.length) return NextResponse.json({ id: newer[0].id });
  const doc = await newVersionFrom(actor.db, b.doc, actor.userId);
  await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.version_created", entityType: "contract_documents", entityId: doc.id, metadata: { from: b.doc.id, version: doc.version } });
  return NextResponse.json({ id: doc.id });
}
