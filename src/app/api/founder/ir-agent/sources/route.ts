import { NextResponse } from "next/server";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { extractDocumentText } from "@/lib/documents/extract-text";
import { PDF_ONLY, validateFile } from "@/lib/uploads/policy";
import { createServiceRoleClient, serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "ir-agent-sources";
const MAX_SOURCES = 10;

/**
 * Train the agent on a PDF. The file goes to private storage and its text is
 * pulled out right away and kept on the row, so the reply route can read it
 * without touching storage. PDF only, with the platform's own message on rejection.
 */
export async function POST(request: Request) {
  const auth = await requireFounderAgentApi(request);
  if ("error" in auth) return auth.error;
  const { agent } = auth.ctx;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "No file provided." }, { status: 400 });
  const check = validateFile({ name: file.name, type: file.type, size: file.size }, PDF_ONLY);
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });

  const db = serviceRoleClientUntyped();
  const { count } = await db.from("ir_agent_sources").select("id", { count: "exact", head: true }).eq("agent_id", agent.id);
  if ((count ?? 0) >= MAX_SOURCES) return NextResponse.json({ error: `Up to ${MAX_SOURCES} PDFs per agent. Remove one first.` }, { status: 400 });

  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `${agent.id}/${crypto.randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const admin = createServiceRoleClient();
  await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: row, error } = await db
    .from("ir_agent_sources")
    .insert({ agent_id: agent.id, file_name: file.name.slice(-120), storage_path: path, bytes: file.size, status: "processing" })
    .select("id, file_name, bytes, status, created_at")
    .single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "Could not save." }, { status: 500 });

  const text = await extractDocumentText(bytes, "application/pdf", file.name);
  const status = text.trim().length > 50 ? "trained" : "failed";
  await db.from("ir_agent_sources").update({ extracted_text: text || null, status }).eq("id", row.id);

  return NextResponse.json({
    source: { ...row, status },
    message: status === "trained" ? "Trained. The agent can answer from this document now." : "No readable text found. Scanned PDFs need a text layer.",
  });
}

export async function DELETE(req: Request) {
  const auth = await requireFounderAgentApi(req);
  if ("error" in auth) return auth.error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const db = serviceRoleClientUntyped();
  const { data: row } = await db.from("ir_agent_sources").select("id, storage_path").eq("id", id).eq("agent_id", auth.ctx.agent.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await createServiceRoleClient().storage.from(BUCKET).remove([row.storage_path]).catch(() => {});
  await db.from("ir_agent_sources").delete().eq("id", row.id);
  return NextResponse.json({ ok: true });
}
