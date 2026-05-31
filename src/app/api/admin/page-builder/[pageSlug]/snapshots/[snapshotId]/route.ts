import { NextResponse } from "next/server";
import { requirePageBuilderApi } from "@/lib/api/permissions";
import { getSnapshotById, isPageBuilderSlug } from "@/lib/page-builder/drafts";
import { countAllBlocks } from "@/lib/page-builder/layout-blocks";
import { parseLayoutDocument } from "@/lib/page-builder/validation";

type RouteContext = { params: Promise<{ pageSlug: string; snapshotId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requirePageBuilderApi();
  if ("error" in auth) return auth.error;

  const { pageSlug, snapshotId } = await context.params;
  if (!isPageBuilderSlug(pageSlug)) {
    return NextResponse.json({ error: "Unknown page slug." }, { status: 400 });
  }

  try {
    const snapshot = await getSnapshotById(auth.supabase, snapshotId);
    if (snapshot.page_slug !== pageSlug) {
      return NextResponse.json({ error: "Snapshot does not belong to this page." }, { status: 404 });
    }

    const layout = parseLayoutDocument(snapshot.layout);
    const { data: profile } = snapshot.created_by
      ? await auth.supabase.from("profiles").select("full_name, email").eq("id", snapshot.created_by).maybeSingle()
      : { data: null };

    return NextResponse.json({
      snapshot: {
        ...snapshot,
        blockCount: layout ? countAllBlocks(layout.blocks) : 0,
        createdByName: profile?.full_name ?? null,
        createdByEmail: profile?.email ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load snapshot." },
      { status: 500 },
    );
  }
}
