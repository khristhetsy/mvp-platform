import { notifyStaffComplianceAlert } from "@/lib/notifications/compliance-events";
import type {
  ComplianceEventInput,
  ComplianceEventRecord,
  ComplianceEventStatus,
  ComplianceSeverity,
} from "@/lib/compliance/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function dedupeKey(input: ComplianceEventInput) {
  return `${input.eventType}:${input.companyId ?? ""}:${input.founderId ?? ""}:${input.investorId ?? ""}:${input.sourceId ?? ""}`;
}

export async function findOpenComplianceEvent(
  admin: SupabaseClient<Database>,
  input: ComplianceEventInput,
) {
  const sourceId = input.sourceId ?? null;
  let query = admin
    .from("compliance_events")
    .select("*")
    .eq("event_type", input.eventType)
    .in("status", ["open", "under_review"]);

  if (input.companyId) {
    query = query.eq("company_id", input.companyId);
  }
  if (input.founderId) {
    query = query.eq("founder_id", input.founderId);
  }
  if (input.investorId) {
    query = query.eq("investor_id", input.investorId);
  }

  const { data, error } = await query;
  if (error) {
    return { error };
  }

  const match = (data ?? []).find((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return String(meta.source_id ?? "") === String(sourceId ?? "");
  });

  return { data: match as ComplianceEventRecord | undefined };
}

export async function recordComplianceEvent(
  input: ComplianceEventInput,
  options?: { allowDuplicate?: boolean },
) {
  const admin = createServiceRoleClient();

  if (!options?.allowDuplicate) {
    const existing = await findOpenComplianceEvent(admin, input);
    if (existing.data) {
      return { data: existing.data, created: false };
    }
  }

  const metadata = {
    ...(input.metadata ?? {}),
    dedupe_key: dedupeKey(input),
    ...(input.sourceId ? { source_id: input.sourceId } : {}),
  };

  const { data, error } = await admin
    .from("compliance_events")
    .insert({
      company_id: input.companyId ?? null,
      founder_id: input.founderId ?? null,
      investor_id: input.investorId ?? null,
      event_type: input.eventType,
      severity: input.severity,
      source: input.source,
      title: input.title,
      description: input.description,
      metadata,
      status: "open",
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to record compliance event.") };
  }

  const record = data as ComplianceEventRecord;

  if (record.severity === "critical" || record.severity === "high") {
    void notifyStaffComplianceAlert({
      eventId: record.id,
      severity: record.severity,
      title: record.title,
      description: record.description,
    });
  }

  return { data: record, created: true };
}

export async function listComplianceEvents(
  admin: SupabaseClient<Database>,
  filters?: { status?: ComplianceEventStatus | "all"; limit?: number },
) {
  let query = admin.from("compliance_events").select("*").order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const limit = filters?.limit ?? 100;
  const { data, error } = await query.limit(limit);

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as ComplianceEventRecord[] };
}

export async function updateComplianceEvent(
  admin: SupabaseClient<Database>,
  input: {
    eventId: string;
    reviewerId: string;
    status?: ComplianceEventStatus;
    severity?: ComplianceSeverity;
    internalNotes?: string | null;
    action: "review" | "dismiss" | "resolve" | "escalate";
  },
) {
  const now = new Date().toISOString();
  const patch: Database["public"]["Tables"]["compliance_events"]["Update"] = {
    reviewed_by: input.reviewerId,
    reviewed_at: now,
  };

  if (input.internalNotes !== undefined) {
    patch.internal_notes = input.internalNotes;
  }

  if (input.severity) {
    patch.severity = input.severity;
  }

  switch (input.action) {
    case "review":
      patch.status = "under_review";
      break;
    case "dismiss":
      patch.status = "dismissed";
      break;
    case "resolve":
      patch.status = "resolved";
      break;
    case "escalate":
      patch.status = "under_review";
      patch.severity = input.severity ?? "critical";
      break;
  }

  if (input.status) {
    patch.status = input.status;
  }

  const { data, error } = await admin
    .from("compliance_events")
    .update(patch)
    .eq("id", input.eventId)
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as ComplianceEventRecord };
}

export async function getComplianceMetrics(admin: SupabaseClient<Database>) {
  const [open, critical, high, socialFlagged, flaggedOutreach, queuedMessages, underReview] = await Promise.all([
    admin.from("compliance_events").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("compliance_events").select("id", { count: "exact", head: true }).eq("severity", "critical").in("status", ["open", "under_review"]),
    admin.from("compliance_events").select("id", { count: "exact", head: true }).eq("severity", "high").in("status", ["open", "under_review"]),
    admin
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "social_draft_flagged")
      .in("status", ["open", "under_review"]),
    admin
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "risky_fundraising_language")
      .in("status", ["open", "under_review"]),
    admin
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["outreach_abuse", "excessive_queued_outreach"])
      .in("status", ["open", "under_review"]),
    admin.from("compliance_events").select("id", { count: "exact", head: true }).eq("status", "under_review"),
  ]);

  return {
    openEvents: open.count ?? 0,
    criticalEvents: critical.count ?? 0,
    highEvents: high.count ?? 0,
    flaggedSocialEvents: socialFlagged.count ?? 0,
    flaggedOutreachEvents: flaggedOutreach.count ?? 0,
    outreachAbuseIndicators: queuedMessages.count ?? 0,
    underReview: underReview.count ?? 0,
  };
}
