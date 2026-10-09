/** Pull bounced founder sends into the verification queue. POST → { marked } */
import { NextResponse } from "next/server";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { syncBounces } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ marked: await syncBounces() });
  } catch (err) {
    return failed(err, "Couldn't check bounces.");
  }
}
