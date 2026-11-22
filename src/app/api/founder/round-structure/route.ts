import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getRoundStructure, saveRoundStructure } from "@/lib/term-sheet/store";
import { cleanRoundStructure } from "@/lib/term-sheet/values";

export const dynamic = "force-dynamic";

/** The founder's saved Round structure inputs, so the term sheet creator can pull from them. */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const { company } = await getActiveCompanyForUser(auth.profile);
    if (!company) return NextResponse.json({ roundStructure: null });
    const saved = await getRoundStructure(auth.supabase, company.id);
    return NextResponse.json({ roundStructure: saved });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load the Round structure." }, { status: 500 });
  }
}

/** Save the calculator inputs. The calculator calls this when the founder runs the analysis or taps Save. */
export async function PUT(request: Request): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { inputs?: unknown };
    const inputs = cleanRoundStructure(body.inputs);
    if (!inputs) return NextResponse.json({ error: "Round structure inputs are required." }, { status: 400 });
    const { company } = await getActiveCompanyForUser(auth.profile);
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const saved = await saveRoundStructure(auth.supabase, company.id, auth.profile.id, inputs);
    return NextResponse.json({ roundStructure: saved });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save the Round structure." }, { status: 500 });
  }
}
