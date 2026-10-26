// One time install of the launch masters. Kept out of store.ts so the bundled
// master files only load in the install route.

import "server-only";
import type { Db } from "./access";
import { MASTER_SEEDS } from "./master-seeds";
import { SUBSCRIPTION_SEEDS } from "./subscription/seeds";
import { SUBSCRIPTION_PACKAGE_KEY } from "./subscription/package";
import { loadDocx, tokenizeDoc } from "./docx-engine";
import { bufferToBytea, byteaToBuffer } from "./store";
import type { TemplateField } from "./types";

/** Install the launch masters. Idempotent: masters already installed are skipped. */
export async function installMasters(db: Db, userId: string): Promise<{ installed: string[]; skipped: string[]; upgraded: string[] }> {
  const entities = await listEntitiesByKey(db);
  const installed: string[] = [];
  const skipped: string[] = [];
  const upgraded: string[] = [];
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
  // Subscription package parts: same install, no issuing entity text, each tagged with its package, part and delivery.
  for (const seed of SUBSCRIPTION_SEEDS) {
    const { data: existing } = await db.from("contract_templates").select("id, version, master_docx, master_filename").eq("key", seed.key).eq("status", "active").order("version", { ascending: false }).limit(1);
    const bytes = Buffer.from(seed.base64, "base64");
    const fields: TemplateField[] = seed.fields.map((f, i) => ({ ...f, sort_order: i }));
    const { doc } = await loadDocx(bytes);
    tokenizeDoc(doc, fields, null);
    if (existing?.length) {
      // Already installed. When the file shipped with the app is newer than the installed one, save it as the next
      // version with its field map (earlier versions and the drafts made from them stay as they are).
      // A file an admin supplied with Replace file has its own name and is never overwritten here.
      if (existing[0].master_filename !== seed.filename || !isOutdated(existing[0].master_docx, bytes)) {
        skipped.push(seed.name);
        continue;
      }
      await installSubscriptionVersion(db, seed, bytes, fields, userId, entities, (existing[0].version as number) + 1);
      upgraded.push(seed.name);
      continue;
    }

    await installSubscriptionVersion(db, seed, bytes, fields, userId, entities, 1);
    installed.push(seed.name);
  }
  return { installed, skipped, upgraded };
}

async function listEntitiesByKey(db: Db): Promise<Map<string, string>> {
  const { data } = await db.from("contract_entities").select("id, key");
  return new Map(((data ?? []) as { id: string; key: string }[]).map((e) => [e.key, e.id]));
}


/** True when the installed master file is not the one shipped with the app. */
export function isOutdated(installed: unknown, shipped: Buffer): boolean {
  try {
    return !byteaToBuffer(installed).equals(shipped);
  } catch {
    return true;
  }
}

async function installSubscriptionVersion(
  db: Db,
  seed: (typeof SUBSCRIPTION_SEEDS)[number],
  bytes: Buffer,
  fields: TemplateField[],
  userId: string,
  entities: Map<string, string>,
  version: number,
): Promise<void> {
  const { data: tpl, error } = await db
    .from("contract_templates")
    .insert({
      key: seed.key,
      name: seed.name,
      kind: "subscription",
      subtype: null,
      version,
      status: "active",
      master_docx: bufferToBytea(bytes),
      master_filename: seed.filename,
      default_entity_id: entities.get("venture") ?? null,
      entity_match: null,
      signature_anchors: seed.anchors,
      has_expiry: false,
      package_key: SUBSCRIPTION_PACKAGE_KEY,
      part_key: seed.part,
      delivery: seed.delivery,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !tpl) throw new Error(`Could not install ${seed.name}: ${error?.message ?? "unknown error"}`);
  if (fields.length) {
    const { error: fErr } = await db.from("contract_template_fields").insert(fields.map((f) => ({ ...f, template_id: tpl.id })));
    if (fErr) throw new Error(`Could not install fields for ${seed.name}: ${fErr.message}`);
  }
  if (version > 1) await db.from("contract_templates").update({ status: "retired" }).eq("key", seed.key).neq("id", tpl.id);
}
