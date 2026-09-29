import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { VOCABULARY_LISTS, type VocabularyList } from "@/lib/vocabulary/lists";
import { sectionFor } from "@/lib/profile-fields/catalog";
import { checkSave, type DraftOption } from "@/lib/profile-fields/draft";
import { getInvestorMatchConfig, setInvestorMatchConfig } from "@/lib/settings/platform-settings";
import { DEFAULT_ENGINE_WEIGHTS, type EngineWeights } from "@/lib/matching/investor-company-matching";
import { DISPLAY_SURFACES, applyDisplayChange, checkDisplayChange, resolveSurface } from "@/lib/profile-fields/display";
import { loadDisplayConfig, loadMatchRequired, saveDisplayConfig } from "@/lib/profile-fields/display-store";

export const dynamic = "force-dynamic";

/**
 * Profile fields: one field at a time.
 *
 * Save writes the field's whole option list and records it as a new version.
 * Restore (the page's Unsave, and Restore in version history) re-applies an
 * older version as a new version, so history only ever grows. Nothing deletes.
 */

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

const listSchema = z.enum(VOCABULARY_LISTS as [VocabularyList, ...VocabularyList[]]);
const optionSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  label: z.string().max(80),
  archived: z.boolean(),
  description: z.string().max(200).nullable().optional(),
});

type Row = { slug: string; label: string; archived: boolean; description: string | null; sort_order: number };
type VersionRow = { version: number; note: string | null; created_at: string; created_by: string | null };

async function loadOptions(list: VocabularyList): Promise<DraftOption[]> {
  const { data, error } = await db()
    .from("vocabulary_options")
    .select("slug, label, archived, description, sort_order")
    .eq("list", list)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({ slug: r.slug, label: r.label, archived: Boolean(r.archived), description: r.description ?? null }));
}

async function loadVersions(list: VocabularyList): Promise<VersionRow[]> {
  const { data } = await db()
    .from("profile_field_versions")
    .select("version, note, created_at, created_by")
    .eq("list", list)
    .order("version", { ascending: false })
    .limit(25);
  return (data ?? []) as VersionRow[];
}

/** Write the list and record it as the next version. */
async function writeVersion(list: VocabularyList, options: DraftOption[], note: string, userId: string): Promise<number> {
  const versions = await loadVersions(list);
  if (versions.length === 0) {
    // The first edit ever: keep what was there as version 1, so Unsave has
    // something to return to.
    const before = await loadOptions(list);
    await db().from("profile_field_versions").insert({ list, version: 1, snapshot: before, note: "Before first edit", created_by: null });
  }
  const next = (versions[0]?.version ?? 1) + 1;

  const rows = options.map((o, i) => ({
    list,
    slug: o.slug,
    label: o.label.trim(),
    archived: o.archived,
    description: o.description?.trim() || null,
    sort_order: (i + 1) * 10,
  }));
  const { error } = await db().from("vocabulary_options").upsert(rows, { onConflict: "list,slug" });
  if (error) throw error;

  const { error: vErr } = await db()
    .from("profile_field_versions")
    .insert({ list, version: next, snapshot: options, note, created_by: userId });
  if (vErr) throw vErr;
  return next;
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = listSchema.safeParse(req.nextUrl.searchParams.get("list"));
  if (!parsed.success) return NextResponse.json({ error: "Unknown field." }, { status: 400 });
  try {
    const [options, versions] = await Promise.all([loadOptions(parsed.data), loadVersions(parsed.data)]);
    return NextResponse.json({ options, versions });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not load this field." }, { status: 500 });
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), list: listSchema, options: z.array(optionSchema).min(1).max(200), note: z.string().max(200).optional() }),
  z.object({ action: z.literal("restore"), list: listSchema, version: z.number().int().min(1) }),
  z.object({ action: z.literal("display"), surface: z.enum(DISPLAY_SURFACES), key: z.string().min(1).max(60), shown: z.boolean(), required: z.boolean() }),
  z.object({ action: z.literal("weight"), factor: z.enum(Object.keys(DEFAULT_ENGINE_WEIGHTS) as [keyof EngineWeights, ...(keyof EngineWeights)[]]), weight: z.number().int().min(0).max(100) }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "That is not a change I can make." }, { status: 400 });
  const body = parsed.data;

  try {
    if (body.action === "display") {
      const matchRequired = await loadMatchRequired();
      const change = { surface: body.surface, key: body.key, shown: body.shown, required: body.required };
      const check = checkDisplayChange(change, matchRequired);
      if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
      const before = await loadDisplayConfig();
      const next = applyDisplayChange(before, change);
      if (!(await saveDisplayConfig(next, auth.userId))) return NextResponse.json({ error: "Could not save the setting." }, { status: 500 });
      await writeAuditLog(auth.supabase as never, {
        userId: auth.userId, action: "profile_fields.display_updated", entityType: "profile_field_display",
        entityId: `${body.surface}:${body.key}`, metadata: { ...change, before: before[body.surface]?.[body.key] ?? null },
      });
      return NextResponse.json({ ok: true, surface: body.surface, resolved: resolveSurface(next, body.surface, matchRequired) });
    }

    if (body.action === "weight") {
      const cfg = await getInvestorMatchConfig();
      const before = cfg.engineWeights[body.factor];
      const ok = await setInvestorMatchConfig({ ...cfg, engineWeights: { ...cfg.engineWeights, [body.factor]: body.weight } }, auth.userId);
      if (!ok) return NextResponse.json({ error: "Could not save the weight." }, { status: 500 });
      await writeAuditLog(auth.supabase as never, {
        userId: auth.userId, action: "profile_fields.weight_updated", entityType: "match_config",
        entityId: body.factor, metadata: { factor: body.factor, from: before, to: body.weight },
      });
      return NextResponse.json({ ok: true, factor: body.factor, weight: body.weight });
    }

    const section = sectionFor(body.list);
    if (!section) return NextResponse.json({ error: "This field is not managed here." }, { status: 400 });
    const existing = await loadOptions(body.list);

    let target: DraftOption[];
    let note: string;
    if (body.action === "save") {
      target = body.options.map((o) => ({ ...o, description: o.description ?? null }));
      note = body.note?.trim() || "Saved";
    } else {
      const { data } = await db()
        .from("profile_field_versions")
        .select("snapshot")
        .eq("list", body.list)
        .eq("version", body.version)
        .maybeSingle();
      const snap = (data as { snapshot?: DraftOption[] } | null)?.snapshot;
      if (!snap) return NextResponse.json({ error: "That version no longer exists." }, { status: 404 });
      // Options added after that version stay, retired, so no answer is orphaned.
      const inSnap = new Set(snap.map((o) => o.slug));
      target = [...snap, ...existing.filter((o) => !inSnap.has(o.slug)).map((o) => ({ ...o, archived: true }))];
      note = `Restored version ${body.version}`;
    }

    const check = checkSave(existing, target, { addable: section.addable, slugIsLabel: section.slugIsLabel, hasDescription: section.hasDescription });
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

    const version = await writeVersion(body.list, target, note, auth.userId);
    await writeAuditLog(auth.supabase as never, {
      userId: auth.userId, action: body.action === "save" ? "profile_fields.saved" : "profile_fields.restored",
      entityType: "vocabulary_list", entityId: body.list, metadata: { list: body.list, version, note },
    });
    const [options, versions] = await Promise.all([loadOptions(body.list), loadVersions(body.list)]);
    return NextResponse.json({ ok: true, version, options, versions });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not save this field." }, { status: 500 });
  }
}
