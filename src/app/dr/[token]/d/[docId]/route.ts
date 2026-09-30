/**
 * One file from an IR share link: checks the link and the email, logs the view on the
 * investor's record, then redirects to a 5 minute signed URL. `docId` is a document id, or
 * "file" for a term sheet uploaded straight into the email dialog.
 */
import { NextRequest, NextResponse } from "next/server";
import { canOpenShare, loadShareLink, logShareView, normShareEmail, signedFileUrl } from "@/lib/ir/share-links";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string; docId: string }> }): Promise<Response> {
  const { token, docId } = await ctx.params;
  const email = normShareEmail(req.nextUrl.searchParams.get("e"));
  const link = await loadShareLink(token);
  const back = new URL(`/dr/${encodeURIComponent(token)}?e=${encodeURIComponent(email)}`, req.nextUrl.origin);
  if (!link || !canOpenShare(link, email).ok) return NextResponse.redirect(back);
  if (docId !== "file" && !/^[0-9a-f-]{36}$/i.test(docId)) return NextResponse.redirect(back);
  const file = await signedFileUrl(link, docId);
  if (!file) return NextResponse.redirect(back);
  await logShareView(link, email, "view", docId, file.name);
  return NextResponse.redirect(file.url);
}
