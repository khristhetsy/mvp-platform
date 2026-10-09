/** Bulk actions on directory records. POST { ids, action: "publish"|"unpublish"|"suppress" } → { updated } */
import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { updateRecord } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), action: z.enum(["publish", "unpublish", "suppress"]) });

export async function POST(request: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select records first." }, { status: 400 });
  try {
    let updated = 0;
    for (const id of parsed.data.ids) { await updateRecord(id, {}, parsed.data.action, auth.adminId); updated++; }
    return NextResponse.json({ updated });
  } catch (err) {
    return failed(err, "Couldn't update the records.");
  }
}
