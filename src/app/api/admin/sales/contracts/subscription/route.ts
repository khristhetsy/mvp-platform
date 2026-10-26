import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canSeeContact, forbidden, requireContractsApi } from "@/lib/contracts/access";
import { createPackageDocuments, PackageMastersMissing } from "@/lib/contracts/subscription/create";
import { errorMessage } from "@/lib/contracts/route-helpers";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  contactId: z.string().uuid(),
  profile: z.object({ type: z.enum(["entity", "individual", "joint"]), usPerson: z.boolean(), spouseSigns: z.boolean() }),
});

/**
 * POST — the documents of a subscription package for this subscriber profile:
 * the contact's drafts of each part (reused if already started) and the IRS form
 * PDFs. Nothing is sent. Returns them in package order.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Choose a contact and describe the subscriber.");
  const { contactId, profile } = parsed.data;
  if (!(await canSeeContact(actor, contactId))) return forbidden();
  try {
    const result = await createPackageDocuments(actor.db, { contactId, userId: actor.userId, profile });
    await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.subscription_package_opened", entityType: "contract_documents", metadata: { contact_id: contactId, profile, documents: result.documents.length } });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PackageMastersMissing) return bad("The subscription masters are not installed yet. Install the masters first.", 409, { code: "masters_missing" });
    return NextResponse.json({ error: errorMessage(err, "Could not open the subscription package.") }, { status: 500 });
  }
}
