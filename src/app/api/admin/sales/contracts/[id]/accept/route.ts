import { NextResponse } from "next/server";
import { bad } from "@/lib/contracts/access";
import { SendBlockedError } from "@/lib/contracts/service";
import { acceptanceFor, acceptSubscription } from "@/lib/contracts/subscription/acceptance-server";
import { actorAndBundle, errorMessage } from "@/lib/contracts/route-helpers";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET: where the package stands (subscriber signed, countersigned, accepted). Null for anything but a sent subscription package. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  return NextResponse.json({ acceptance: await acceptanceFor(r.actor.db, r.b.doc.id) });
}

/** POST: the Manager accepts the subscription. Records it and emails the subscriber the next step. No funds move. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  try {
    const result = await acceptSubscription(actor.db, b.doc.id, { actorLabel: actor.actorLabel, displayName: actor.profile.full_name ?? actor.actorLabel, email: actor.profile.email ?? null });
    await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.subscription_accepted", entityType: "contract_documents", entityId: b.doc.id, metadata: { emailed: result.emailed } });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SendBlockedError) return bad(err.message, 409);
    return NextResponse.json({ error: errorMessage(err, "Could not record the acceptance.") }, { status: 500 });
  }
}
