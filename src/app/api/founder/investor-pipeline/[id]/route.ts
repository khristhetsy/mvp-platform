import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";

const SAFE_COLUMNS =
  "id,founder_id,name,location,investor_type,investment_size,pledge_amount,interested,meeting_requested,match_score,outreach_status,preferred_stages,focus_sectors,notes,created_at,updated_at";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Whitelist updatable fields — never allow contact_email or contact_phone
  const allowedFields = [
    "name",
    "location",
    "investor_type",
    "investment_size",
    "pledge_amount",
    "interested",
    "meeting_requested",
    "match_score",
    "outreach_status",
    "preferred_stages",
    "focus_sectors",
    "notes",
  ];

  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pipeline_investors")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", id)
    .eq("founder_id", profile.id) // enforce ownership
    .select(SAFE_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ investor: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  const { id } = await params;

  const { error } = await supabase
    .from("pipeline_investors")
    .delete()
    .eq("id", id)
    .eq("founder_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
