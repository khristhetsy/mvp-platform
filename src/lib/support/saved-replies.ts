/**
 * Saved replies for the support desk: reusable answers staff insert into the
 * reply box and edit before sending. One JSON row in `platform_settings`
 * (key `support_saved_replies`). Staff add and edit them from the queue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const SAVED_REPLIES_KEY = "support_saved_replies";

export type SavedReply = { id: string; title: string; body: string };

export const DEFAULT_SAVED_REPLIES: SavedReply[] = [
  {
    id: "looking-into-it",
    title: "Looking into it",
    body: "Thanks for the details. I'm looking into this now and will come back to you with an answer shortly.",
  },
  {
    id: "need-more-info",
    title: "Need more information",
    body: "Thanks for reaching out. To help, could you tell me which page you were on and what you expected to happen? A screenshot saved as a PDF also helps.",
  },
  {
    id: "pdf-only",
    title: "Uploads are PDF only",
    body: "Documents on iCapOS are uploaded as PDF files. If you export your file to PDF and upload it again, it will go through.",
  },
];

function normalize(raw: unknown): SavedReply[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: SavedReply[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim().slice(0, 80) : "";
    const body = typeof row.body === "string" ? row.body.trim().slice(0, 4000) : "";
    let id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 60) : title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!title || !body) continue;
    while (seen.has(id)) id = `${id}-x`;
    seen.add(id);
    out.push({ id, title, body });
  }
  return out.slice(0, 50);
}

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function getSavedReplies(): Promise<SavedReply[]> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", SAVED_REPLIES_KEY).maybeSingle();
    const row = data as { value?: unknown } | null;
    return row ? normalize(row.value) : DEFAULT_SAVED_REPLIES;
  } catch {
    return DEFAULT_SAVED_REPLIES;
  }
}

export async function saveSavedReplies(next: unknown, updatedBy: string | null): Promise<SavedReply[] | null> {
  const clean = normalize(next);
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert({ key: SAVED_REPLIES_KEY, value: clean, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return error ? null : clean;
  } catch {
    return null;
  }
}
