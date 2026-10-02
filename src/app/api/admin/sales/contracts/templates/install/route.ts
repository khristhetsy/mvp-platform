import { NextResponse } from "next/server";
import { forbidden, requireContractsApi } from "@/lib/contracts/access";
import { installMasters } from "@/lib/contracts/install";
import { seedEmailDrafts } from "@/lib/contracts/email-drafts";
import { writeAuditLog } from "@/lib/data/audit";
import { errorMessage } from "@/lib/contracts/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST — install the launch masters and cover email drafts (admin, idempotent). */
export async function POST(): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  if (!actor.isAdmin) return forbidden("Only an admin can install master templates.");
  try {
    const result = await installMasters(actor.db, actor.userId);
    const drafts = await seedEmailDrafts(actor.db, actor.userId);
    await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.masters_installed", entityType: "contract_templates", metadata: { ...result, drafts } });
    return NextResponse.json({ ...result, drafts });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Install failed.") }, { status: 500 });
  }
}
