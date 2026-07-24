import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createCatalogItem, updateCatalogItem } from "@/lib/icfo-events/credits";

export const dynamic = "force-dynamic";

/** Create a Rewards Catalog item (staff). */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string; description?: string | null; cost?: number; sort?: number };
    const title = body.title?.trim();
    const cost = Number(body.cost);
    if (!title || !Number.isFinite(cost) || cost <= 0) {
      return NextResponse.json({ error: "Title and a positive cost are required." }, { status: 400 });
    }
    const item = await createCatalogItem(auth.supabase, { title, description: body.description ?? null, cost: Math.round(cost), sort: body.sort ?? 0 });
    return NextResponse.json({ item });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't create the item." }, { status: 500 });
  }
}

/** Update a catalog item (staff) — edit fields or toggle active. */
export async function PATCH(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; title?: string; description?: string | null; cost?: number; active?: boolean; sort?: number };
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const item = await updateCatalogItem(auth.supabase, body.id, {
      title: body.title,
      description: body.description,
      cost: body.cost !== undefined ? Math.round(Number(body.cost)) : undefined,
      active: body.active,
      sort: body.sort,
    });
    return NextResponse.json({ item });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't update the item." }, { status: 500 });
  }
}
