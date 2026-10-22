import { NextResponse } from "next/server";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { updateAgent } from "@/lib/ir-agent/store";
import { createServiceRoleClient, serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "ir-agent-images";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/svg+xml": "svg" };

/** The agent's photo or logo. PNG, JPG or SVG, under 2 MB, public bucket like company logos. */
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
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "The image must be PNG, JPG or SVG." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The image must be under 2 MB." }, { status: 400 });

  const admin = createServiceRoleClient();
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  const path = `${agent.id}/agent.${ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = `${data.publicUrl}?t=${Date.now()}`;
  await serviceRoleClientUntyped().from("ir_agents").update({ image_url: imageUrl }).eq("id", agent.id);
  const saved = await updateAgent(agent.id, {});
  return NextResponse.json({ image_url: imageUrl, agent: saved.ok ? saved.agent : null });
}

export async function DELETE(request: Request) {
  const auth = await requireFounderAgentApi(request);
  if ("error" in auth) return auth.error;
  await serviceRoleClientUntyped().from("ir_agents").update({ image_url: null }).eq("id", auth.ctx.agent.id);
  return NextResponse.json({ ok: true });
}
