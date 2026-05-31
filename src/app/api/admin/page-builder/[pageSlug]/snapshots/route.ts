import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api/super-admin";
import { createSnapshot, getOrCreateDraft, isPageBuilderSlug, listSnapshots } from "@/lib/page-builder/drafts";

type RouteContext = { params: Promise<{ pageSlug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { pageSlug } = await context.params;
  if (!isPageBuilderSlug(pageSlug)) {
    return NextResponse.json({ error: "Unknown page slug." }, { status: 400 });
  }

  try {
    const draft = await getOrCreateDraft(auth.supabase, pageSlug, auth.userId);
    const snapshots = await listSnapshots(auth.supabase, draft.id);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list snapshots." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
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
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create snapshot." },
      { status: 500 },
    );
  }
}
