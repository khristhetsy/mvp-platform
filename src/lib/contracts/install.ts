// One time install of the launch masters. Kept out of store.ts so the bundled
// master files only load in the install route.

import "server-only";
import type { Db } from "./access";
import { MASTER_SEEDS } from "./master-seeds";
import { loadDocx, tokenizeDoc } from "./docx-engine";
import { bufferToBytea } from "./store";
import type { TemplateField } from "./types";

/** Install the launch masters. Idempotent: masters already installed are skipped. */
export async function installMasters(db: Db, userId: string): Promise<{ installed: string[]; skipped: string[] }> {
  const entities = await listEntitiesByKey(db);
  const installed: string[] = [];
  const skipped: string[] = [];
  for (const seed of MASTER_SEEDS) {
    const { data: existing } = await db.from("contract_templates").select("id").eq("key", seed.key).limit(1);
    if (existing?.length) {
      skipped.push(seed.name);
      continue;
    }
    const bytes = Buffer.from(seed.base64, "base64");
    const fields: TemplateField[] = seed.fields.map((f, i) => ({ ...f, sort_order: i }));
    // Refuse to install a map that does not fit its file.
    const { doc } = await loadDocx(bytes);
    tokenizeDoc(doc, fields, seed.entityMatch);

    const { data: tpl, error } = await db
      .from("contract_templates")
      .insert({
        key: seed.key,
        name: seed.name,
        kind: seed.kind,
        subtype: seed.subtype,
        version: 1,
        status: "active",
        master_docx: bufferToBytea(bytes),
        master_filename: seed.filename,
        default_entity_id: entities.get(seed.entityKey) ?? null,
        entity_match: seed.entityMatch,
        signature_anchors: seed.anchors,
        has_expiry: seed.hasExpiry,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !tpl) throw new Error(`Could not install ${seed.name}: ${error?.message ?? "unknown error"}`);
    const { error: fErr } = await db.from("contract_template_fields").insert(fields.map((f) => ({ ...f, template_id: tpl.id })));
    if (fErr) throw new Error(`Could not install fields for ${seed.name}: ${fErr.message}`);
    installed.push(seed.name);
  }
  return { installed, skipped };
}

async function listEntitiesByKey(db: Db): Promise<Map<string, string>> {
  const { data } = await db.from("contract_entities").select("id, key");
  return new Map(((data ?? []) as { id: string; key: string }[]).map((e) => [e.key, e.id]));
}

