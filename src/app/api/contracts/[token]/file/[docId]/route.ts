import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { packetDocument } from "@/lib/contracts/packet";
import { getFile } from "@/lib/contracts/store";

export const dynamic = "force-dynamic";

/** GET ?kind=sent|executed|certificate — the prospect's own copies only. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; docId: string }> }): Promise<Response> {
  const { token, docId } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const doc = await packetDocument(db, token, docId);
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const kind = new URL(req.url).searchParams.get("kind") ?? "sent";
  const path = kind === "executed" ? doc.executed_path : kind === "certificate" ? doc.certificate_path : doc.pdf_path;
  if (!path) return NextResponse.json({ error: "Not available yet." }, { status: 404 });
  const bytes = await getFile(db, path);
  const name = path.split("/").pop() ?? "document.pdf";
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}
