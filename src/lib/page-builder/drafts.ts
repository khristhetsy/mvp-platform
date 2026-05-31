import { buildDemoLayout, emptyLayout } from "@/lib/page-builder/demo-layout";
import { parseLayoutDocument } from "@/lib/page-builder/validation";
import type {
  PageBuilderDraftRow,
  PageBuilderSlug,
  PageBuilderSnapshotRow,
  PageLayoutDocument,
} from "@/lib/page-builder/types";
import { PAGE_BUILDER_SLUGS } from "@/lib/page-builder/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

function normalizeLayout(raw: unknown, pageSlug: PageBuilderSlug): PageLayoutDocument {
  const parsed = parseLayoutDocument(raw);
  if (parsed) {
    return { ...parsed, pageSlug };
  }
  return emptyLayout(pageSlug);
}

export function isPageBuilderSlug(value: string): value is PageBuilderSlug {
  return (PAGE_BUILDER_SLUGS as readonly string[]).includes(value);
}

export async function getOrCreateDraft(supabase: Client, pageSlug: PageBuilderSlug, userId: string) {
  const { data: existing } = await supabase
    .from("page_builder_drafts")
    .select("*")
    .eq("page_slug", pageSlug)
    .maybeSingle();

  if (existing) {
    return {
      ...existing,
      layout: normalizeLayout(existing.layout, pageSlug),
    } as PageBuilderDraftRow;
  }

  const layout = emptyLayout(pageSlug);
  const { data, error } = await supabase
    .from("page_builder_drafts")
    .insert({
      page_slug: pageSlug,
      layout,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create draft.");
  }

  return { ...data, layout: normalizeLayout(data.layout, pageSlug) } as PageBuilderDraftRow;
}

export async function saveDraftLayout(
  supabase: Client,
  pageSlug: PageBuilderSlug,
  layout: PageLayoutDocument,
  userId: string,
) {
  const { data, error } = await supabase
    .from("page_builder_drafts")
    .upsert(
      {
        page_slug: pageSlug,
        layout: { ...layout, pageSlug, version: 1 },
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "page_slug" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save draft.");
  }

  return { ...data, layout: normalizeLayout(data.layout, pageSlug) } as PageBuilderDraftRow;
}

export async function resetDraftLayout(supabase: Client, pageSlug: PageBuilderSlug, userId: string) {
  return saveDraftLayout(supabase, pageSlug, emptyLayout(pageSlug), userId);
}

export async function loadDemoDraftLayout(supabase: Client, pageSlug: PageBuilderSlug, userId: string) {
  return saveDraftLayout(supabase, pageSlug, buildDemoLayout(pageSlug), userId);
}

export async function listSnapshots(supabase: Client, draftId: string) {
  const { data, error } = await supabase
    .from("page_builder_snapshots")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PageBuilderSnapshotRow[];
}

export async function createSnapshot(
  supabase: Client,
  draft: PageBuilderDraftRow,
  userId: string,
  label?: string,
) {
  const { data, error } = await supabase
    .from("page_builder_snapshots")
    .insert({
      draft_id: draft.id,
      page_slug: draft.page_slug,
      layout: draft.layout,
      label: label ?? `Snapshot ${new Date().toLocaleString()}`,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create snapshot.");
  }

  return data as PageBuilderSnapshotRow;
}

export async function restoreSnapshot(
  supabase: Client,
  pageSlug: PageBuilderSlug,
  snapshotId: string,
  userId: string,
) {
  const { data: snapshot, error } = await supabase
    .from("page_builder_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .single();

  if (error || !snapshot) {
    throw new Error(error?.message ?? "Snapshot not found.");
  }

  const layout = normalizeLayout(snapshot.layout, pageSlug);
  const draft = await getOrCreateDraft(supabase, pageSlug, userId);
  await createSnapshot(supabase, draft, userId, "Auto-backup before rollback");
  return saveDraftLayout(supabase, pageSlug, layout, userId);
}

export async function getDraftBySlug(supabase: Client, pageSlug: PageBuilderSlug) {
  const { data, error } = await supabase
    .from("page_builder_drafts")
    .select("*")
    .eq("page_slug", pageSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    ...data,
    layout: normalizeLayout(data.layout, pageSlug),
  } as PageBuilderDraftRow;
}
