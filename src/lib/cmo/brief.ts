// Prospect Pipeline — Step 6: CMO Brief. A read-only strategist over the whole
// pipeline. It ONLY reads (counts + views) and produces a ranked, source-cited
// morning brief. It never sends, posts, or calls — every action routes to an
// Admin Task via "Add to task".

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export type BriefPriority = "critical" | "high" | "medium" | "low";

export interface BriefItem {
  id: string;
  priority: BriefPriority;
  title: string;
  rationale: string;
  citation: string;   // which source rows back this item
  count: number;
  href: string;       // where to act
  taskTitle: string;
  taskDescription: string;
}

const PRIORITY_RANK: Record<BriefPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

async function count(build: (db: ReturnType<typeof serviceRoleClientUntyped>) => PromiseLike<{ count: number | null }>): Promise<number> {
  const db = serviceRoleClientUntyped();
  const { count: c } = await build(db);
  return c ?? 0;
}

export interface CmoBrief {
  generatedAt: string;
  summary: string;
  items: BriefItem[];
}

/** Build the ranked brief from live pipeline data. Pure reads. */
export async function buildCmoBrief(): Promise<CmoBrief> {
  const [unclassified, pendingApproach, hot, warm, ready, lintFlagged, sent] = await Promise.all([
    count((db) => db.from("crm_contacts").select("id", { count: "exact", head: true }).is("side", null)),
    count((db) => db.from("crm_contacts").select("id", { count: "exact", head: true }).not("side", "is", null).is("approach", null)),
    count((db) => db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("segment", "hot").eq("converted", false).eq("suppressed", false)),
    count((db) => db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("segment", "warm").eq("converted", false).eq("suppressed", false)),
    count((db) => db.from("publish_items").select("id", { count: "exact", head: true }).eq("status", "ready")),
    count((db) => db.from("publish_items").select("id", { count: "exact", head: true }).eq("status", "lint_flagged")),
    count((db) => db.from("publish_items").select("id", { count: "exact", head: true }).eq("status", "sent")),
  ]);

  const items: BriefItem[] = [];

  if (lintFlagged > 0) {
    items.push({
      id: "lint_flagged",
      priority: "critical",
      title: `${lintFlagged} message${lintFlagged > 1 ? "s" : ""} blocked by the compliance lint`,
      rationale: "These can never send until the flagged copy is revised. They're holding up their waves.",
      citation: `publish_items · status = lint_flagged · ${lintFlagged} rows`,
      count: lintFlagged,
      href: "/admin/crm/publish",
      taskTitle: "Revise lint-flagged outbound copy",
      taskDescription: `${lintFlagged} publish item(s) failed the compliance lint. Review the flags on the Publish page and revise the copy so they can queue.`,
    });
  }

  if (ready > 0) {
    items.push({
      id: "ready_to_approve",
      priority: "high",
      title: `${ready} message${ready > 1 ? "s" : ""} linted and awaiting your approval`,
      rationale: "Passed the compliance lint. Nothing sends until an admin approves — these are ready for a decision.",
      citation: `publish_items · status = ready · ${ready} rows`,
      count: ready,
      href: "/admin/crm/publish",
      taskTitle: "Review and approve ready messages",
      taskDescription: `${ready} publish item(s) passed lint and await admin approval to send.`,
    });
  }

  if (hot > 0) {
    items.push({
      id: "hot_queue",
      priority: "high",
      title: `${hot} hot lead${hot > 1 ? "s" : ""} scored and ready to approach`,
      rationale: "Highest pre-score prospects with a written approach. Draft a targeted message to the hot segment.",
      citation: `hot_queue view · ${hot} rows`,
      count: hot,
      href: "/admin/crm/publish",
      taskTitle: "Draft a message to the hot segment",
      taskDescription: `${hot} hot leads are scored with an approach. Draft a compliant message on the Publish page (segment = hot).`,
    });
  }

  if (pendingApproach > 0) {
    items.push({
      id: "pending_approach",
      priority: "medium",
      title: `${pendingApproach.toLocaleString()} classified contact${pendingApproach > 1 ? "s" : ""} need approach scoring`,
      rationale: "They have a side but no approach yet, so they can't be segmented or published to.",
      citation: `crm_contacts · side set, approach null · ${pendingApproach} rows`,
      count: pendingApproach,
      href: "/admin/crm/audience",
      taskTitle: "Run approach scoring",
      taskDescription: `${pendingApproach} classified contacts still need approach scoring on the Audience page.`,
    });
  }

  if (unclassified > 0) {
    items.push({
      id: "unclassified",
      priority: "medium",
      title: `${unclassified.toLocaleString()} contact${unclassified > 1 ? "s" : ""} still unclassified`,
      rationale: "Without a founder/investor side, the approach models can't run on them.",
      citation: `crm_contacts · side is null · ${unclassified} rows`,
      count: unclassified,
      href: "/admin/crm/classify",
      taskTitle: "Classify remaining contacts",
      taskDescription: `${unclassified} contacts are unclassified. Run classification and clear the review queue on the Classify page.`,
    });
  }

  items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.count - a.count);

  const summary = items.length === 0
    ? "Pipeline is clear — nothing needs attention right now."
    : `${items.length} priorit${items.length > 1 ? "ies" : "y"} today. ` +
      `${hot.toLocaleString()} hot leads, ${warm.toLocaleString()} warm; ${ready} message(s) ready to approve, ${sent} sent to date.`;

  return { generatedAt: new Date().toISOString(), summary, items };
}
