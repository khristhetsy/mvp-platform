import { NextResponse } from "next/server";
import { requirePageBuilderApi } from "@/lib/api/permissions";
import {
  createSnapshot,
  getOrCreateDraft,
  getSnapshotById,
  isPageBuilderSlug,
  listSnapshotsWithMeta,
} from "@/lib/page-builder/drafts";
import { countAllBlocks } from "@/lib/page-builder/layout-blocks";
import { parseLayoutDocument } from "@/lib/page-builder/validation";

type RouteContext = { params: Promise<{ pageSlug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requirePageBuilderApi();
  if ("error" in auth) return auth.error;

  const { pageSlug } = await context.params;
  if (!isPageBuilderSlug(pageSlug)) {
    return NextResponse.json({ error: "Unknown page slug." }, { status: 400 });
  }

  try {
    const draft = await getOrCreateDraft(auth.supabase, pageSlug, auth.userId);
    const snapshots = await listSnapshotsWithMeta(auth.supabase, draft.id, pageSlug);
    return NextResponse.json({ draft, snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list snapshots." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requirePageBuilderApi();
  if ("error" in auth) return auth.error;

  const { pageSlug } = await context.params;
  if (!isPageBuilderSlug(pageSlug)) {
    return NextResponse.json({ error: "Unknown page slug." }, { status: 400 });
  }

  let label: string | undefined;
  try {
    const body = await request.json();
    label = typeof body?.label === "string" ? body.label : undefined;
  } catch {
    label = undefined;
  }

  try {
    const draft = await getOrCreateDraft(auth.supabase, pageSlug, auth.userId);
    const snapshot = await createSnapshot(auth.supabase, draft, auth.userId, label);
    const layout = parseLayoutDocument(snapshot.layout);
    return NextResponse.json({
      snapshot: {
        ...snapshot,
        blockCount: layout ? countAllBlocks(layout.blocks) : 0,
        createdByName: auth.profile.full_name,
        createdByEmail: auth.profile.email,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create snapshot." },
      { status: 500 },
    );
  }
}
