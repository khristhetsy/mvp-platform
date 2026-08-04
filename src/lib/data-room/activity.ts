// Founder-facing data-room activity: who viewed which document, when.
// Reads the existing audit trail — every signed-URL creation is logged by
// /api/documents/signed-url as `document.signed_url.created`. No new table.
import { createServiceRoleClient } from "@/lib/supabase/admin";

export interface DataRoomActivityItem {
  id: string;
  viewerName: string;
  documentLabel: string;
  at: string;
}

function titleCase(code: string): string {
  return code.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export async function listDataRoomActivity(companyId: string, limit = 20): Promise<DataRoomActivityItem[]> {
  const admin = createServiceRoleClient();

  const { data: docs } = await admin
    .from("documents")
    .select("id, file_name, document_type")
    .eq("company_id", companyId);
  const docList = docs ?? [];
  if (docList.length === 0) return [];

  const docLabel = new Map(
    docList.map((d) => [d.id, d.file_name || (d.document_type ? titleCase(d.document_type) : "Document")]),
  );
  const docIds = docList.map((d) => d.id);

  const { data: logs } = await admin
    .from("audit_logs")
    .select("id, user_id, entity_id, created_at")
    .eq("entity_type", "document")
    .eq("action", "document.signed_url.created")
    .in("entity_id", docIds)
    .order("created_at", { ascending: false })
    .limit(limit * 4);
  const rows = logs ?? [];
  if (rows.length === 0) return [];

  const viewerIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .in("id", viewerIds);
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

  const items: DataRoomActivityItem[] = [];
  for (const row of rows) {
    const viewer = row.user_id ? profMap.get(row.user_id) : null;
    // Only surface investor views to the founder — hide their own and staff opens.
    if (!viewer || viewer.role !== "investor") continue;
    items.push({
      id: row.id,
      viewerName: viewer.full_name || viewer.email || "Investor",
      documentLabel: docLabel.get(row.entity_id ?? "") ?? "a document",
      at: row.created_at,
    });
    if (items.length >= limit) break;
  }
  return items;
}
