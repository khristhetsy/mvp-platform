import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api/super-admin";
import { getOrCreateDraft, saveDraftLayout } from "@/lib/page-builder/drafts";
import { isPageBuilderSlug } from "@/lib/page-builder/drafts";
import { parseLayoutDocument, validateLayout } from "@/lib/page-builder/validation";
import type { PageLayoutDocument } from "@/lib/page-builder/types";

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
    const warnings = validateLayout(draft.layout);
    return NextResponse.json({ draft, warnings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load draft." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { pageSlug } = await context.params;
  if (!isPageBuilderSlug(pageSlug)) {
    return NextResponse.json({ error: "Unknown page slug." }, { status: 400 });
  }

  let body: { layout?: PageLayoutDocument };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseLayoutDocument(body.layout);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid layout document." }, { status: 400 });
  }

  const layout: PageLayoutDocument = { ...parsed, pageSlug, version: 1 };
  const warnings = validateLayout(layout);
  const hasErrors = warnings.some((w) => w.severity === "error");
  if (hasErrors) {
    return NextResponse.json({ error: "Layout has validation errors.", warnings }, { status: 422 });
  }

  try {
    const draft = await saveDraftLayout(auth.supabase, pageSlug, layout, auth.userId);
    return NextResponse.json({ draft, warnings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save draft." },
      { status: 500 },
    );
  }
}
