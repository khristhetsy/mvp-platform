/** Publish an import: its draft rows become visible to founders. POST → { published } */
import { NextResponse } from "next/server";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { publishImport } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    return NextResponse.json({ published: await publishImport(id) });
  } catch (err) {
    return failed(err, "Couldn't publish the import.");
  }
}
