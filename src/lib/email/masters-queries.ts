// Data access for the MJML master/copy template system (build spec §5).
//
// Follows the existing Marketing Hub pattern: service-role client via
// marketingDb(), access control enforced at the API/route layer with
// requireRole(["admin"]). Masters are READ-ONLY here — there is deliberately no
// update/delete for masters, so no UI path can mutate one (spec §1 guardrail).

import { marketingDb } from "@/lib/marketing/db";
import type { PlaceholderSchema } from "./template-schema";

export type EmailMaster = {
  id: string;
  name: string;
  description: string | null;
  mjml_source: string;
  compiled_html: string;
  placeholder_schema: PlaceholderSchema;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

export type BannerMode = "gradient" | "image";
export type CopyStatus = "draft" | "ready" | "archived";

export type EmailCopy = {
  id: string;
  master_id: string;
  name: string;
  slot_values: Record<string, string>;
  banner_mode: BannerMode;
  banner_image_url: string | null;
  footer_note: string | null;
  status: CopyStatus;
  campaign_group_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** A master card for the gallery: master + how many copies reference it. */
export type MasterWithCount = EmailMaster & { copy_count: number };

export async function listMastersWithCounts(): Promise<MasterWithCount[]> {
  const db = marketingDb();
  const [{ data: masters, error }, { data: copies }] = await Promise.all([
    db.from("email_template_masters").select("*").order("name", { ascending: true }),
    db.from("email_template_copies").select("master_id"),
  ]);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const c of (copies ?? []) as Array<{ master_id: string }>) {
    counts.set(c.master_id, (counts.get(c.master_id) ?? 0) + 1);
  }
  return ((masters ?? []) as EmailMaster[]).map((m) => ({ ...m, copy_count: counts.get(m.id) ?? 0 }));
}

export async function getMaster(id: string): Promise<EmailMaster | null> {
  const db = marketingDb();
  const { data } = await db.from("email_template_masters").select("*").eq("id", id).maybeSingle();
  return (data as EmailMaster | null) ?? null;
}

/**
 * "Use template": always creates a COPY, never mutates the master (spec §1).
 * Name defaults to "{master.name} — Copy".
 */
export async function createCopyFromMaster(masterId: string, createdBy: string): Promise<EmailCopy> {
  const db = marketingDb();
  const master = await getMaster(masterId);
  if (!master) throw new Error("Master template not found.");

  const { data, error } = await db
    .from("email_template_copies")
    .insert({
      master_id: masterId,
      name: `${master.name} — Copy`,
      slot_values: {},
      banner_mode: "gradient",
      status: "draft",
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as EmailCopy;
}

/** A copy joined with the master fields the editor needs to render preview. */
export type CopyWithMaster = EmailCopy & {
  master: Pick<EmailMaster, "id" | "name" | "compiled_html" | "placeholder_schema">;
};

export async function getCopyWithMaster(copyId: string): Promise<CopyWithMaster | null> {
  const db = marketingDb();
  const { data: copy } = await db.from("email_template_copies").select("*").eq("id", copyId).maybeSingle();
  if (!copy) return null;
  const master = await getMaster((copy as EmailCopy).master_id);
  if (!master) return null;
  return {
    ...(copy as EmailCopy),
    master: {
      id: master.id,
      name: master.name,
      compiled_html: master.compiled_html,
      placeholder_schema: master.placeholder_schema,
    },
  };
}

export type CopyUpdate = Partial<
  Pick<EmailCopy, "name" | "slot_values" | "banner_mode" | "banner_image_url" | "footer_note" | "status" | "campaign_group_id">
>;

export async function updateCopy(copyId: string, patch: CopyUpdate): Promise<EmailCopy> {
  const db = marketingDb();
  const { data, error } = await db
    .from("email_template_copies")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", copyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as EmailCopy;
}
