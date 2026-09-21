import { NextRequest, NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import {
  activateFieldSet,
  answerCounts,
  listFieldSetVersions,
  loadRegistrationFieldSet,
  saveFieldSet,
} from "@/lib/icfo-events/registration-field-sets-server";
import { sharedOptionList, type FieldSet } from "@/lib/icfo-events/registration-field-sets";

export const dynamic = "force-dynamic";

/**
 * The active set, plus what the editor needs to be honest:
 *   · `usage` — how many registrations answered under each key, which decides
 *     which keys are locked against renaming;
 *   · `linked` — the shared option lists, so the editor can show a linked
 *     field's real options without duplicating them into the draft.
 */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [set, usage, versions] = await Promise.all([
    loadRegistrationFieldSet(),
    answerCounts(),
    listFieldSetVersions(),
  ]);

  return NextResponse.json({
    set,
    usage,
    linked: { sectors: sharedOptionList("sectors"), countries: sharedOptionList("countries") },
    versions: versions.map((v) => ({
      id: v.id, version: v.version, isActive: v.isActive,
      reason: v.reason, createdAt: v.createdAt, createdByName: v.createdByName,
    })),
  });
}

type Body = { set?: FieldSet; reason?: string; activateId?: string };

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;

  // Revert: make an earlier version active again, unchanged.
  if (body?.activateId) {
    await activateFieldSet(body.activateId);
    return NextResponse.json({ ok: true });
  }

  if (!body?.set) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const result = await saveFieldSet(body.set, body.reason ?? "", auth.profile.id);
  if (!result.ok) return NextResponse.json({ error: result.errors.join("  ·  ") }, { status: 400 });
  return NextResponse.json({ ok: true, version: result.version });
}
