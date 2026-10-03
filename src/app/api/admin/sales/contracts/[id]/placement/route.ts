import { NextResponse } from "next/server";
import { z } from "zod";
import { bad } from "@/lib/contracts/access";
import { actorAndBundle } from "@/lib/contracts/route-helpers";

export const dynamic = "force-dynamic";

const box = z.object({ page: z.number().int().min(1).max(500), x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(0.01).max(1), height: z.number().min(0.005).max(1) });
const schema = z.object({ countersign: z.array(box).max(20) });

/** GET — countersignature boxes placed on an uploaded contract. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const r = await actorAndBundle((await params).id);
  if ("error" in r) return r.error;
  return NextResponse.json({ countersign: (r.b.doc.countersign_fields ?? []).filter((f) => f.kind === "signature"), contactId: r.b.doc.contact_id, title: r.b.template.name, status: r.b.doc.status });
}

/** PUT — save the countersignature boxes for an uploaded contract that is still a draft. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const r = await actorAndBundle((await params).id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  if (b.doc.source !== "upload") return bad("Only uploaded contracts have hand-placed boxes.");
  if (b.doc.status !== "draft" || b.doc.locked) return bad("This contract was already sent.", 409);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Invalid boxes.");
  const fields = parsed.data.countersign.map((f) => ({ ...f, kind: "signature" as const }));
  const { error } = await actor.db.from("contract_documents").update({ countersign_fields: fields, updated_at: new Date().toISOString() }).eq("id", b.doc.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
