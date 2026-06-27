// Single source of truth for "how complete is this founder's data room?".
// Pure + deterministic. Reused by the founder hub, the nudge engine, the weekly
// digest, the admin cockpit, and the assistant — so the number is consistent
// everywhere. Builds on the existing checklist + Qualify-doc definitions.

import { buildDocumentChecklist, documentTypeCode } from "@/lib/data/founder-readiness";
import { requiredDocumentTypes } from "@/lib/documents/required-types";
import { QUALIFY_REQUIRED_DOCUMENTS } from "@/lib/founder-journey/documents";
import type { DocumentRecord } from "@/lib/supabase/types";

export type DataRoomStatus = "uploaded" | "needs_review" | "missing";
export type FastestPath = "generate" | "upload";

export interface DataRoomItem {
  label: string;
  code: string;
  status: DataRoomStatus;
  /** One of the 3 documents that gate Qualify / investor access. */
  core: boolean;
  /** Quickest way for the founder to satisfy this item. */
  path: FastestPath;
  /** Where to send the founder to satisfy it. */
  href: string;
  /** Button copy for the fastest path. */
  cta: string;
}

export interface DataRoomState {
  items: DataRoomItem[];
  total: number;
  completed: number;
  percent: number; // 0..100 across the full required set
  missingCount: number;
  needsReviewCount: number;
  // Core = the 3 Qualify docs that unlock investor access.
  coreTotal: number;
  coreCompleted: number;
  coreComplete: boolean;
  coreMissing: DataRoomItem[];
  fullComplete: boolean;
  /** The single highest-priority item to tackle next (core first). */
  nextItem: DataRoomItem | null;
}

/** Required-doc labels that have an in-app AI generator (fastest path). */
const GENERATORS: Record<string, { href: string; cta: string }> = {
  "Business plan": { href: "/founder/business-plan", cta: "Generate with AI" },
  "Financial model": { href: "/founder/financial-model", cta: "Build it in-app" },
  "Cap table": { href: "/founder/cap-table", cta: "Build it in-app" },
};

/** Codes (from QUALIFY_REQUIRED_DOCUMENTS) that count as core/Qualify docs. */
const CORE_CODES = new Set(
  QUALIFY_REQUIRED_DOCUMENTS.flatMap((d) => [d.code, ...d.aliases]).map((c) => c.toUpperCase()),
);

// The readiness checklist label "Financial model" maps to FINANCIAL_STATEMENTS,
// which is the Qualify "Financial statements" doc — so it's a core item.
const CORE_LABELS = new Set(["Pitch deck", "Financial model", "Cap table"]);

function isCore(label: string, code: string): boolean {
  return CORE_LABELS.has(label) || CORE_CODES.has(code.toUpperCase());
}

export function computeDataRoomState(documents: DocumentRecord[]): DataRoomState {
  const checklist = buildDocumentChecklist(documents, requiredDocumentTypes);

  const items: DataRoomItem[] = checklist.map((c) => {
    const gen = GENERATORS[c.label];
    const path: FastestPath = gen ? "generate" : "upload";
    return {
      label: c.label,
      code: c.code,
      status: c.status,
      core: isCore(c.label, c.code),
      path,
      href: gen ? gen.href : "/founder/documents",
      cta: gen ? gen.cta : "Upload",
    };
  });

  const total = items.length;
  const completed = items.filter((i) => i.status !== "missing").length;
  const missingCount = items.filter((i) => i.status === "missing").length;
  const needsReviewCount = items.filter((i) => i.status === "needs_review").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const coreItems = items.filter((i) => i.core);
  const coreCompleted = coreItems.filter((i) => i.status !== "missing").length;
  const coreMissing = coreItems.filter((i) => i.status === "missing");

  // Priority: missing core docs first, then any missing doc, then needs-review.
  const nextItem =
    coreMissing[0] ??
    items.find((i) => i.status === "missing") ??
    items.find((i) => i.status === "needs_review") ??
    null;

  return {
    items,
    total,
    completed,
    percent,
    missingCount,
    needsReviewCount,
    coreTotal: coreItems.length,
    coreCompleted,
    coreComplete: coreMissing.length === 0,
    coreMissing,
    fullComplete: missingCount === 0,
    nextItem,
  };
}

/** What completing the data room unlocks — used in motivating copy. */
export const DATA_ROOM_UNLOCKS = [
  "Visibility to investors in the Private Market",
  "The ability to request investor introductions",
  "Advancing to the Deploy stage to start your raise",
] as const;

/** Convenience: derive the document_type codes already satisfied. */
export function satisfiedCodes(state: DataRoomState): string[] {
  return state.items.filter((i) => i.status !== "missing").map((i) => documentTypeCode(i.label));
}
