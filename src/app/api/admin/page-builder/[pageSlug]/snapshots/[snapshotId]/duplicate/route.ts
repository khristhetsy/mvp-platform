import { NextResponse } from "next/server";
import { requirePageBuilderApi } from "@/lib/api/permissions";
import {
  duplicateSnapshotToDraft,
  getOrCreateDraft,
  isPageBuilderSlug,
  listSnapshotsWithMeta,
} from "@/lib/page-builder/drafts";
import { validateLayout } from "@/lib/page-builder/validation";

type RouteContext = { params: Promise<{ pageSlug: string; snapshotId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requirePageBuilderApi();
  if ("error" in auth) return auth.error;

  const { pageSlug, snapshotId } = await context.params;
  if (!isPageBuilderSlug(pageSlug)) {
    return NextResponse.json({ error: "Unknown page slug." }, { status: 400 });
  }

  try {
    const draft = await duplicateSnapshotToDraft(auth.supabase, pageSlug, snapshotId, auth.userId);
    const warnings = validateLayout(draft.layout);
    const snapshots = await listSnapshotsWithMeta(auth.supabase, draft.id, pageSlug);
    return NextResponse.json({ draft, warnings, snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to duplicate snapshot." },
      { status: 500 },
    );
  }
}
