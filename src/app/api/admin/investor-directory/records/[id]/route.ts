/**
 * One directory record.
 *   PATCH { patch?: RecordPatch, action: "save"|"verify"|"suppress"|"opt_out"|"publish"|"unpublish" } → { record }
 * "verify" requires at least one industry (the matcher scores on it).
 * "opt_out" suppresses the record and archives it in every founder's list.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { updateRecord } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const str = z.string().max(500).nullable().optional();
const arr = z.array(z.string().max(80)).max(40).optional();
const schema = z.object({
  action: z.enum(["save", "verify", "suppress", "opt_out", "publish", "unpublish"]),
  patch: z.object({
    firm: z.string().min(1).max(300).optional(),
    contact_name: str, title: str, email: z.string().email().max(300).nullable().optional().or(z.literal("").transform(() => null)),
    phone: str, website: str, city: str, state: str, fund_name: str, strategy: str, notes: z.string().max(4000).nullable().optional(),
    investor_types: arr, funding_stages: arr, capital_types: arr, industries: arr,
    investing_now: z.boolean().nullable().optional(),
  }).default({}),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  try {
    const patch = { ...parsed.data.patch, email: parsed.data.patch.email?.toLowerCase() ?? parsed.data.patch.email };
    if (!("email" in parsed.data.patch)) delete (patch as Record<string, unknown>).email;
    const record = await updateRecord(id, patch, parsed.data.action, auth.adminId);
    return NextResponse.json({ record });
  } catch (err) {
    return failed(err, "Couldn't save the record.");
  }
}
