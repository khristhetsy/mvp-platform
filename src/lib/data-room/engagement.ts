// Founder-facing data-room engagement: which documents investors open most.
// Aggregates the same audit trail listDataRoomActivity reads — every signed-URL
// creation is logged as `document.signed_url.created`. No new table.
import { createServiceRoleClient } from "@/lib/supabase/admin";

export interface EngagementViewer {
  name: string;
  views: number;
}

export interface DataRoomEngagementItem {
  documentId: string;
  label: string;
  views: number;
  uniqueInvestors: number;
  lastViewedAt: string | null;
  viewers: EngagementViewer[];
}

export interface DataRoomEngagement {
  items: DataRoomEngagementItem[];
  totalViews: number;
  maxViews: number;
  uniqueInvestors: number;
}

function titleCase(code: string): string {
  return code.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Per-document engagement ranking for a company's data room, investor views only.
 * Looks back over the most recent `sampleLimit` signed-URL events.
 */
export async function listDataRoomEngagement(companyId: string, sampleLimit = 2000): Promise<DataRoomEngagement> {
  const empty: DataRoomEngagement = { items: [], totalViews: 0, maxViews: 0, uniqueInvestors: 0 };
  const admin = createServiceRoleClient();

  const { data: docs } = await admin
    .from("documents")
    .select("id, file_name, document_type")
    .eq("company_id", companyId);
  const docList = docs ?? [];
  if (docList.length === 0) return empty;

  const docLabel = new Map(
    docList.map((d) => [d.id, d.file_name || (d.document_type ? titleCase(d.document_type) : "Document")]),
  );
  const docIds = docList.map((d) => d.id);

  const { data: logs } = await admin
    .from("audit_logs")
    .select("user_id, entity_id, created_at")
    .eq("entity_type", "document")
    .eq("action", "document.signed_url.created")
    .in("entity_id", docIds)
    .order("created_at", { ascending: false })
    .limit(sampleLimit);
  const rows = logs ?? [];
  if (rows.length === 0) return empty;

  const viewerIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .in("id", viewerIds);
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

  // docId -> { views, last, viewerId -> {name, views} }
  const agg = new Map<string, { views: number; last: string | null; viewers: Map<string, EngagementViewer> }>();
  const allInvestors = new Set<string>();

  for (const row of rows) {
    const viewer = row.user_id ? profMap.get(row.user_id) : null;
    if (!viewer || viewer.role !== "investor") continue; // investor views only
    const docId = row.entity_id ?? "";
    if (!docLabel.has(docId)) continue;

    allInvestors.add(viewer.id);
    let entry = agg.get(docId);
    if (!entry) {
      entry = { views: 0, last: null, viewers: new Map() };
      agg.set(docId, entry);
    }
    entry.views += 1;
    if (!entry.last || row.created_at > entry.last) entry.last = row.created_at;

    const name = viewer.full_name || viewer.email || "Investor";
    const v = entry.viewers.get(viewer.id);
    if (v) v.views += 1;
    else entry.viewers.set(viewer.id, { name, views: 1 });
  }

  const items: DataRoomEngagementItem[] = [...agg.entries()]
    .map(([documentId, e]) => ({
      documentId,
      label: docLabel.get(documentId) ?? "Document",
      views: e.views,
      uniqueInvestors: e.viewers.size,
      lastViewedAt: e.last,
      viewers: [...e.viewers.values()].sort((a, b) => b.views - a.views),
    }))
    .sort((a, b) => b.views - a.views);

  const totalViews = items.reduce((s, i) => s + i.views, 0);
  const maxViews = items.reduce((m, i) => Math.max(m, i.views), 0);

  return { items, totalViews, maxViews, uniqueInvestors: allInvestors.size };
}
