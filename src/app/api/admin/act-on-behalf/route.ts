import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startActOnBehalf, stopActOnBehalf } from "@/lib/admin/act-on-behalf";

export const dynamic = "force-dynamic";

const schema = z.object({ founderId: z.string().uuid() });

// Begin acting as a founder. All authorization (staff + act_on_behalf permission
// + target is a founder) is enforced inside startActOnBehalf.
export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A founder id is required." }, { status: 400 });

  const result = await startActOnBehalf(parsed.data.founderId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}

// End the acting-as session.
export async function DELETE(): Promise<Response> {
  await stopActOnBehalf();
  return NextResponse.json({ ok: true });
}
