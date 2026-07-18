import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  loadProspectInvestors,
  createProspectInvestor,
  type ProspectInvestorInput,
} from "@/lib/matching/prospect-investors";

export const dynamic = "force-dynamic";

/**
 * Staff gate for prospect-investor routes: resolves the signed-in user, reads
 * their `profiles.role`, and allows only `admin` or `analyst`. Returns the
 * user id on success (needed to attribute created records) or a JSON error
 * Response to return directly.
 */
async function requireStaff(): Promise<
  { userId: string } | { error: Response }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "analyst")) {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }

  return { userId: user.id };
}

/** Accepts an array or a comma-separated string; returns a trimmed, non-empty string[]. */
function normalizeStringList(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.map((v) => String(v))
    : typeof value === "string"
      ? value.split(",")
      : [];
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Coerces a value to a finite number, or null when empty/invalid. */
function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

// GET — list all prospect investors.
export async function GET(): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  return NextResponse.json({ prospects: await loadProspectInvestors() });
}

// POST — create a prospect investor from a JSON body.
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const investorType =
    typeof body.investor_type === "string" && body.investor_type.trim().length > 0
      ? body.investor_type.trim()
      : null;
  const source =
    typeof body.source === "string" && body.source.trim().length > 0
      ? body.source.trim()
      : null;
  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim()
      : null;

  const input: ProspectInvestorInput = {
    name,
    investor_type: investorType,
    preferred_sectors: normalizeStringList(body.preferred_sectors),
    preferred_stages: normalizeStringList(body.preferred_stages),
    preferred_geographies: normalizeStringList(body.preferred_geographies),
    check_size_min: normalizeNumber(body.check_size_min),
    check_size_max: normalizeNumber(body.check_size_max),
    notes,
    source,
  };

  const created = await createProspectInvestor(input, gate.userId);
  if (!created) {
    return NextResponse.json({ error: "Failed to create prospect." }, { status: 500 });
  }

  return NextResponse.json(created);
}
