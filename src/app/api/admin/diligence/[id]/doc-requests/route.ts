import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createDocRequest, generateDocRequests, verifyDocRequest } from "@/lib/diligence/dataroom";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  generate: z.literal(true).optional(),
  category: z.string().max(80).optional(),
  label: z.string().max(200).optional(),
  closes_findings: z.array(z.string().max(20)).max(50).optional(),
  owner_role: z.string().max(40).nullish(),
  due_date: z.string().max(40).nullish(),
});

/** POST — create a request, or auto-generate from open findings ({generate:true}). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    if (parsed.data.generate) {
      const { count } = await generateDocRequests(auth.supabase, id, auth.userId);
      return NextResponse.json({ count });
    }
    if (!parsed.data.label) return NextResponse.json({ error: "Label is required." }, { status: 400 });
    const docRequest = await createDocRequest(auth.supabase, id, auth.userId, {
      category: parsed.data.category ?? "Evidence",
      label: parsed.data.label,
      closes_findings: parsed.data.closes_findings ?? [],
      owner_role: parsed.data.owner_role ?? "founder",
      due_date: parsed.data.due_date ?? null,
    });
    return NextResponse.json({ docRequest });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

const verifySchema = z.object({ requestId: z.string().uuid() });

/** PATCH — verify a request: advances its findings + claims, recomputes confidence. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = verifySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "requestId required." }, { status: 400 });

  try {
    const { confidence } = await verifyDocRequest(auth.supabase, id, auth.userId, parsed.data.requestId);
    return NextResponse.json({ confidence });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verify failed." }, { status: 500 });
  }
}
