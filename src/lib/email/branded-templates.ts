// Branded templates live in the Marketing templates library (marketing_templates),
// the list the Templates page and the email draft picker read. Each one keeps its
// filled-in content in a linked branded copy (email_template_copies), recorded as
// marketing_templates.blocks = { branded: { copy_id } }, so Edit can reopen the
// branded editor. html_body is re-rendered from the copy on every save.

import { marketingDb } from "@/lib/marketing/db";
import { createTemplate, getTemplate, updateTemplate } from "@/lib/marketing/templates";
import type { MarketingTemplate } from "@/lib/marketing/types";
import { getCopyWithMaster, getMaster, updateCopy, type CopyWithMaster, type EmailMaster } from "./masters-queries";
import { renderCopyHtml } from "./render-copy";
import { brandedLink } from "./branded-templates-link";

export { brandedLink, type BrandedLink } from "./branded-templates-link";

function templateName(master: Pick<EmailMaster, "name">, slots: Record<string, string>): string {
  const company = (slots.company_name ?? "").trim();
  if (master.name === "Deal introduction" && company) return `${company} deal introduction`;
  return (slots.headline ?? "").trim() || master.name;
}

function templateFields(copy: CopyWithMaster) {
  const slots = copy.slot_values ?? {};
  return {
    subject: (slots.headline ?? "").trim() || copy.name,
    preview_text: (slots.preheader ?? "").trim() || null,
    html_body: renderCopyHtml(copy, "campaign"),
  };
}

export type BrandedTemplateInput = {
  masterId: string;
  slotValues: Record<string, string>;
  department: string | null;
  name?: string;
};

export async function createBrandedTemplate(input: BrandedTemplateInput, createdBy: string): Promise<MarketingTemplate> {
  const master = await getMaster(input.masterId);
  if (!master) throw new Error("Design not found.");
  const name = input.name?.trim() || templateName(master, input.slotValues);

  const db = marketingDb();
  const { data: copyRow, error } = await db
    .from("email_template_copies")
    .insert({ master_id: master.id, name, slot_values: input.slotValues, banner_mode: "gradient", status: "ready", created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  const copy = await getCopyWithMaster((copyRow as { id: string }).id);
  if (!copy) throw new Error("Couldn't load the saved design.");

  return createTemplate(
    {
      name,
      ...templateFields(copy),
      blocks: { branded: { copy_id: copy.id } },
      category: "general",
      department: input.department,
      status: "active",
    },
    createdBy,
  );
}

export async function getBrandedTemplate(templateId: string): Promise<{ template: MarketingTemplate; copy: CopyWithMaster } | null> {
  const template = await getTemplate(templateId);
  const link = template ? brandedLink(template.blocks) : null;
  if (!template || !link) return null;
  const copy = await getCopyWithMaster(link.copy_id);
  return copy ? { template, copy } : null;
}

export async function updateBrandedTemplate(
  templateId: string,
  patch: { slotValues: Record<string, string>; department?: string | null; name?: string },
): Promise<MarketingTemplate> {
  const found = await getBrandedTemplate(templateId);
  if (!found) throw new Error("Branded template not found.");
  const name = patch.name?.trim() || found.template.name;
  await updateCopy(found.copy.id, { slot_values: patch.slotValues, name });
  const copy = await getCopyWithMaster(found.copy.id);
  if (!copy) throw new Error("Couldn't load the saved design.");
  return updateTemplate(templateId, {
    name,
    ...templateFields(copy),
    ...(patch.department !== undefined ? { department: patch.department } : {}),
  });
}

/** Duplicate with its own copy, so editing the duplicate never changes the original. */
export async function duplicateBrandedTemplate(templateId: string, createdBy: string): Promise<MarketingTemplate> {
  const found = await getBrandedTemplate(templateId);
  if (!found) throw new Error("Branded template not found.");
  const created = await createBrandedTemplate(
    {
      masterId: found.copy.master_id,
      slotValues: found.copy.slot_values ?? {},
      department: found.template.department ?? null,
      name: `Copy of ${found.template.name}`,
    },
    createdBy,
  );
  return updateTemplate(created.id, { status: "draft" });
}

/**
 * Starting values for a new branded template: standard greeting, section titles
 * and button text; the creator's name, email and photo from their profile; and
 * the title, phone and booking link from the last branded template they saved.
 * Values for slots a design doesn't have are ignored when it renders.
 */
export async function brandedDefaults(profileId: string): Promise<Record<string, string>> {
  const db = marketingDb();
  const [{ data: me }, { data: last }] = await Promise.all([
    db.from("profiles").select("full_name, email, avatar_url").eq("id", profileId).maybeSingle(),
    db
      .from("email_template_copies")
      .select("slot_values")
      .eq("created_by", profileId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const p = (me ?? {}) as { full_name?: string | null; email?: string | null; avatar_url?: string | null };
  const prev = ((last as { slot_values?: Record<string, string> } | null)?.slot_values ?? {}) as Record<string, string>;
  // Standard lines every deal introduction starts with; edit as needed.
  const out: Record<string, string> = {
    greeting: "Hi {{first_name}},",
    considerations_title: "Investment considerations",
    terms_title: "Investment terms",
    cta_intro: "If you'd like to learn more about the company or discuss this opportunity in greater detail, you're welcome to schedule a conversation with me.",
    cta_text: "Schedule a conversation",
  };
  for (const k of ["sender_name", "sender_title", "sender_phone", "sender_email", "sender_photo", "cta_text", "cta_url"]) {
    if (prev[k]) out[k] = prev[k];
  }
  if (p.full_name) out.sender_name = p.full_name;
  if (p.email) out.sender_email = p.email;
  if (p.avatar_url && /^https?:\/\//.test(p.avatar_url)) out.sender_photo = p.avatar_url;
  return out;
}
