/**
 * The facts an activity email needs beyond the event row: which company, who
 * acted, which file, and where the company stands. Each lookup is best effort:
 * a missing value drops its line from the email, it never stops the send.
 */
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listCompanyDocuments } from "@/lib/data/documents";
import { computeDataRoomState } from "@/lib/data-room/completeness";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";
import type { DocumentRecord } from "@/lib/supabase/types";
import type { ChecklistItem, DocumentDetail } from "@/lib/activity/email-templates";

export type CompanyEmailContext = {
  companyName: string | null;
  founderId: string | null;
  checklist: ChecklistItem[];
  next: { label: string; cta: string; href: string } | null;
  readinessScore: number | null;
  /** 0 based position in the founder journey, 0 when unknown. */
  stepIndex: number;
};

export type ActorEmailContext = {
  name: string;
  email: string | null;
  firstName: string | null;
  roleLabel: string;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function loadCompanyEmailContext(companyId: string): Promise<CompanyEmailContext> {
  const empty: CompanyEmailContext = {
    companyName: null,
    founderId: null,
    checklist: [],
    next: null,
    readinessScore: null,
    stepIndex: 0,
  };
  try {
    const admin = createServiceRoleClient();
    const [{ data: company }, docsResult, { data: score }] = await Promise.all([
      admin.from("companies").select("company_name, founder_id").eq("id", companyId).maybeSingle(),
      listCompanyDocuments(admin, companyId),
      admin
        .from("company_readiness_scores")
        .select("effective_score")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const row = company as Record<string, unknown> | null;
    const founderId = str(row?.founder_id);

    let stepIndex = 0;
    if (founderId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("journey_stage")
        .eq("id", founderId)
        .maybeSingle();
      const stage = str((profile as Record<string, unknown> | null)?.journey_stage);
      const idx = stage ? (JOURNEY_STAGES as readonly string[]).indexOf(stage) : -1;
      stepIndex = idx >= 0 ? idx : 0;
    }

    const state = computeDataRoomState((docsResult.data ?? []) as DocumentRecord[]);
    const checklist = state.items
      .filter((item) => item.core)
      .map((item) => ({ label: item.label, done: item.status !== "missing" }));
    const next = state.nextItem
      ? { label: state.nextItem.label, cta: state.nextItem.cta, href: state.nextItem.href }
      : null;

    const raw = (score as Record<string, unknown> | null)?.effective_score;
    return {
      companyName: str(row?.company_name),
      founderId,
      checklist,
      next,
      readinessScore: typeof raw === "number" && Number.isFinite(raw) ? raw : null,
      stepIndex,
    };
  } catch {
    return empty;
  }
}

export async function loadActorEmailContext(
  userId: string,
  founderId: string | null,
): Promise<ActorEmailContext | null> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", userId)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (!row) return null;
    const fullName = str(row.full_name);
    const email = str(row.email);
    const name = fullName ?? email;
    if (!name) return null;
    const role = str(row.role);
    const roleLabel =
      founderId && userId === founderId
        ? "Founder"
        : role === "investor"
          ? "Investor"
          : role === "admin" || role === "analyst"
            ? "iCFO staff"
            : "Team member";
    return { name, email, firstName: fullName ? fullName.split(/\s+/)[0]! : null, roleLabel };
  } catch {
    return null;
  }
}

export async function loadDocumentDetail(documentId: string): Promise<DocumentDetail | null> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("documents")
      .select("file_name, size_bytes")
      .eq("id", documentId)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (!row) return null;
    const size = row.size_bytes;
    return {
      fileName: str(row.file_name),
      sizeBytes: typeof size === "number" ? size : null,
    };
  } catch {
    return null;
  }
}
