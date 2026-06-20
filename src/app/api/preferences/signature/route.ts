import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { loadSignature, saveSignature } from "@/lib/email/signature";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const signature = await loadSignature(auth.supabase, auth.profile.id);
  return NextResponse.json({ signature });
}

const schema = z.object({ signature: z.string().max(2000) });

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  await saveSignature(auth.supabase, auth.profile.id, parsed.data.signature);
  return NextResponse.json({ signature: parsed.data.signature });
}
