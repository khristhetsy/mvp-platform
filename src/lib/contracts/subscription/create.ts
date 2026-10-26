// Create (or reuse) the documents of a subscription package for one contact.
// Server only. Masters become the contact's own drafts, like any contract; the
// IRS forms become uploaded PDFs that are sent as they are.

import "server-only";
import type { Db } from "../access";
import { createDraft, listEntities, putFile } from "../store";
import { countPdfPages } from "@/lib/esignature/pdf";
import { MIME_PDF } from "@/lib/esignature/types";
import { FORM_TITLE, packageItems, PART_LABEL, type FormKey, type PartKey, type SubscriberProfile } from "./package";
import { W8BENE_PDF_BASE64, W9_PDF_BASE64 } from "./form-pdfs";
import { W8BEN_PDF_BASE64 } from "./form-pdf-w8ben";

export type PackageDoc = {
  id: string;
  /** Master template id, or null for a form PDF. */
  templateId: string | null;
  name: string;
  part: PartKey;
  partLabel: string;
  kind: "subscription" | "form";
};

export type PackageResult = { documents: PackageDoc[]; notes: string[] };

export class PackageMastersMissing extends Error {
  constructor(public missing: string[]) {
    super("The subscription masters are not installed yet.");
    this.name = "PackageMastersMissing";
  }
}

const FORM_BASE64: Record<FormKey, string> = { w9: W9_PDF_BASE64, w8bene: W8BENE_PDF_BASE64, w8ben: W8BEN_PDF_BASE64 };

export async function createPackageDocuments(db: Db, input: { contactId: string; userId: string; profile: SubscriberProfile }): Promise<PackageResult> {
  const items = packageItems(input.profile);
  const keys = items.flatMap((i) => (i.source === "template" ? [i.templateKey] : []));

  const { data: tpls } = await db.from("contract_templates").select("id, key, name").in("key", keys).eq("status", "active");
  const byKey = new Map(((tpls ?? []) as { id: string; key: string; name: string }[]).map((t) => [t.key, t]));
  const missing = keys.filter((k) => !byKey.has(k));
  if (missing.length) throw new PackageMastersMissing(missing);

  // Reuse the contact's unsent drafts so nothing typed is lost when the profile is reopened.
  const { data: drafts } = await db
    .from("contract_documents")
    .select("id, template_id, title, source, version, updated_at")
    .eq("contact_id", input.contactId)
    .eq("status", "draft")
    .eq("locked", false)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  const draftRows = (drafts ?? []) as { id: string; template_id: string | null; title: string | null; source: string }[];

  const entities = await listEntities(db);
  const venture = entities.find((e) => e.legal_name === "ICFO VENTURE GROUP, LLC") ?? null;

  const documents: PackageDoc[] = [];
  const notes: string[] = [];
  for (const item of items) {
    if (item.source === "template") {
      const tpl = byKey.get(item.templateKey)!;
      const existing = draftRows.find((d) => d.source === "template" && d.template_id === tpl.id);
      const id = existing?.id ?? (await createDraft(db, { contactId: input.contactId, templateId: tpl.id, createdBy: input.userId })).id;
      documents.push({ id, templateId: tpl.id, name: tpl.name, part: item.part, partLabel: PART_LABEL[item.part], kind: "subscription" });
    } else if (item.source === "pdf") {
      const existing = draftRows.find((d) => d.source === "upload" && d.title === item.title);
      let id = existing?.id;
      if (!id) {
        const bytes = Buffer.from(FORM_BASE64[item.formKey], "base64");
        const pageCount = await countPdfPages(bytes);
        id = crypto.randomUUID();
        const uploadPath = `uploads/${id}/original.pdf`;
        await putFile(db, uploadPath, bytes, MIME_PDF);
        const { error } = await db.from("contract_documents").insert({
          id,
          contact_id: input.contactId,
          source: "upload",
          contract_type: null,
          title: item.title,
          upload_path: uploadPath,
          entity_id: venture?.id ?? null,
          version: 1,
          status: "draft",
          page_count: pageCount,
          created_by: input.userId,
        });
        if (error) throw new Error(`Could not add ${item.title}: ${error.message}`);
      }
      documents.push({ id, templateId: null, name: item.title, part: item.part, partLabel: PART_LABEL[item.part], kind: "form" });
    }
  }
  return { documents, notes };
}

export { FORM_TITLE };
