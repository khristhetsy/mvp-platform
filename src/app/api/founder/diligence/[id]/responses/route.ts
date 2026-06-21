import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { submitFounderResponse, NotAMemberError } from "@/lib/diligence/founder-actions";

export const dynamic = "force-dynamic";

const schema = z.object({
  finding_codes: z.array(z.string().max(20)).min(1).max(50),
  body: z.string().min(1).max(5000),
  disposition: z.enum(["agree", "remediating", "clarify", "dispute", "awaiting"]),
  owner_role: z.string().max(40).nullish(),
  due_date: z.string().max(40).nullish(),
  evidence_doc_id: z.string().uuid().nullish(),
});

/** POST — founder submits a response to one or more findings. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Pick at least one finding and write a response." }, { status: 400 });

  try {
    const result = await submitFounderResponse(createServiceRoleClient(), id, auth.profile.id, parsed.data);
    return NextResponse.json({ response: result });
  } catch (err) {
    if (err instanceof NotAMemberError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Submit failed." }, { status: 500 });
  }
}
