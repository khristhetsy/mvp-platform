import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { listThreads, composeThread } from "@/lib/email/inbox";

export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const threads = await listThreads(auth.supabase, auth.profile.id);
  return NextResponse.json({ threads });
}

const composeSchema = z.object({
  to: z.string().email(),
  toName: z.string().max(200).optional(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(50000),
});

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = composeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const thread = await composeThread(
    auth.supabase,
    { id: auth.profile.id, email: auth.profile.email, name: auth.profile.full_name },
    parsed.data,
  );
  return NextResponse.json({ thread });
}
