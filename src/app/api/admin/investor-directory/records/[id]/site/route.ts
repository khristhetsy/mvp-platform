import { NextResponse } from "next/server";
import { directoryAdmin } from "@/lib/investor-directory/admin-auth";
import { getRecord } from "@/lib/investor-directory/db";
import { fetchSiteText } from "@/lib/investor-directory/site-text";

export const runtime = "nodejs";

/** Reads the record's home page so industries can be suggested from it. Nothing is saved. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const rec = await getRecord(id);
  if (!rec) return NextResponse.json({ error: "That record was not found." }, { status: 404 });
  // A record without a website can check the address the admin is about to save, such as one guessed from the email domain.
  const body = (await req.json().catch(() => ({}))) as { website?: unknown };
  const site = rec.website || (typeof body.website === "string" ? body.website.trim().slice(0, 300) : "");
  if (!site) return NextResponse.json({ error: "This record has no website." }, { status: 400 });
  try {
    return NextResponse.json(await fetchSiteText(site));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't read the website." }, { status: 502 });
  }
}
