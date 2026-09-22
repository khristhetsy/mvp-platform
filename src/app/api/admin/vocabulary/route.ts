import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { VOCABULARY_LISTS, type VocabularyList, type VocabularyOption } from "@/lib/vocabulary/lists";
import { checkAdd, checkRename } from "@/lib/vocabulary/mutations";

export const dynamic = "force-dynamic";

function db() {
  return createServiceRoleClient() as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const listSchema = z.enum(VOCABULARY_LISTS as [VocabularyList, ...VocabularyList[]]);

async function optionsFor(list: VocabularyList): Promise<VocabularyOption[]> {
  const { data } = await db()
    .from("vocabulary_options")
    .select("slug, label, archived")
    .eq("list", list);
  return ((data ?? []) as { slug: string; label: string; archived: boolean }[]).map((r) => ({
    slug: r.slug,
    label: r.label,
    archived: Boolean(r.archived),
  }));
}

/** Every list, with the values in display order. */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await db()
      .from("vocabulary_options")
      .select("id, list, slug, label, sort_order, archived")
      .order("list", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) return NextResponse.json({ error: "Could not load the lists." }, { status: 500 });
    return NextResponse.json({ options: data ?? [] });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not load the lists." }, { status: 500 });
  }
}

const addSchema = z.object({ list: listSchema, label: z.string() });

/** Add a value. The slug is derived here, never accepted from the client. */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "That is not a value I can add." }, { status: 400 });

    const { list, label } = parsed.data;
    const existing = await optionsFor(list);
    const check = checkAdd(existing, label);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

    // New values sort to the end rather than jumping the order someone chose.
    const { data: last } = await db()
      .from("vocabulary_options")
      .select("sort_order")
      .eq("list", list)
      .eq("archived", false)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = Number((last as { sort_order?: number } | null)?.sort_order ?? 0) + 10;

    const { data, error } = await db()
      .from("vocabulary_options")
      .insert({ list, slug: check.slug, label: label.trim(), sort_order: sortOrder })
      .select("id, list, slug, label, sort_order, archived")
      .single();

    if (error) return NextResponse.json({ error: "Could not add it." }, { status: 500 });
    return NextResponse.json({ option: data });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not add it." }, { status: 500 });
  }
}

const patchSchema = z.object({
  list: listSchema,
  slug: z.string().min(1),
  label: z.string().optional(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * Rename, reorder, archive or restore.
 *
 * The slug is not editable by any path: every stored answer points at it, and
 * changing it would orphan them all at once.
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "That is not a change I can make." }, { status: 400 });

    const { list, slug, label, archived, sortOrder } = parsed.data;
    const patch: Record<string, unknown> = {};

    if (label !== undefined) {
      const check = checkRename(await optionsFor(list), slug, label);
      if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
      patch.label = label.trim();
    }
    if (archived !== undefined) patch.archived = archived;
    if (sortOrder !== undefined) patch.sort_order = sortOrder;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }

    const { data, error } = await db()
      .from("vocabulary_options")
      .update(patch)
      .eq("list", list)
      .eq("slug", slug)
      .select("id, list, slug, label, sort_order, archived")
      .single();

    if (error) return NextResponse.json({ error: "Could not save it." }, { status: 500 });
    return NextResponse.json({ option: data });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not save it." }, { status: 500 });
  }
}
