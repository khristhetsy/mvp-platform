import { NextResponse } from "next/server";
import { requirePageBuilderApi } from "@/lib/api/permissions";
import { isPageBuilderSlug, loadDemoDraftLayout } from "@/lib/page-builder/drafts";
import { validateLayout } from "@/lib/page-builder/validation";

type RouteContext = { params: Promise<{ pageSlug: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requirePageBuilderApi();
  if ("error" in auth) return auth.error;

  const { pageSlug } = await context.params;
  if (!isPageBuilderSlug(pageSlug)) {
    return NextResponse.json({ error: "Unknown page slug." }, { status: 400 });
  }

  try {
    const draft = await loadDemoDraftLayout(auth.supabase, pageSlug, auth.userId);
    const warnings = validateLayout(draft.layout);
    return NextResponse.json({ draft, warnings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load demo layout." },
      { status: 500 },
    );
  }
}
