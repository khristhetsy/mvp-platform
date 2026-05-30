import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildRemediationTaskDrafts } from "@/lib/remediation/rules";
import { sortRemediationTasks } from "@/lib/remediation/rules";
import type { RemediationTaskDraft, RemediationTaskRecord, RemediationStatus } from "@/lib/remediation/types";
import { createNotification } from "@/lib/notifications/notifications";
import type { Company, DocumentRecord } from "@/lib/supabase/types";

type DiligenceReportLike = {
  readiness_score: number | null;
  missing_documents: unknown;
  risk_flags: unknown;
  recommendations: string | null;
};

export async function listRemediationTasksForCompany(companyId: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("founder_remediation_tasks")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load remediation tasks: ${error.message}`);
  }

  return sortRemediationTasks((data ?? []) as RemediationTaskRecord[]);
}

export async function syncFounderRemediationTasks(input: {
  company: Company;
  founderId: string;
  documents: DocumentRecord[];
  diligenceReport: DiligenceReportLike | null;
  onboardingPercent: number;
}) {
  const admin = createServiceRoleClient();
  const drafts = buildRemediationTaskDrafts({
    company: input.company,
    documents: input.documents,
    diligenceReport: input.diligenceReport,
    onboardingPercent: input.onboardingPercent,
  });

  const draftKeys = new Set(drafts.map((draft) => draft.source_key));
  const existing = await listRemediationTasksForCompany(input.company.id);
  const now = new Date().toISOString();

  for (const draft of drafts) {
    const current = existing.find((task) => task.source_key === draft.source_key);

    if (!current) {
      const { error } = await admin.from("founder_remediation_tasks").insert({
        company_id: input.company.id,
        founder_id: input.founderId,
        source_type: draft.source_type,
        source_key: draft.source_key,
        category: draft.category,
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        status: "open",
        recommended_action: draft.recommended_action,
        related_feature: draft.related_feature,
        updated_at: now,
      });

      if (error && !error.message.includes("duplicate")) {
        throw new Error(`Failed to create remediation task: ${error.message}`);
      }

      if (!error) {
        void createNotification({
          recipientUserId: input.founderId,
          type: "remediation_task_created",
          title: "New remediation task",
          message: draft.title,
          entityType: "founder_remediation_task",
          entityId: draft.source_key,
        });
      }

      continue;
    }

    if (current.status === "dismissed") {
      continue;
    }

    if (current.status === "open" || current.status === "in_progress") {
      await admin
        .from("founder_remediation_tasks")
        .update({
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          recommended_action: draft.recommended_action,
          related_feature: draft.related_feature,
          updated_at: now,
        })
        .eq("id", current.id);
    }
  }

  for (const task of existing) {
    if (draftKeys.has(task.source_key)) {
      continue;
    }

    if (task.status === "open" || task.status === "in_progress") {
      await admin
        .from("founder_remediation_tasks")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", task.id);
    }
  }

  return listRemediationTasksForCompany(input.company.id);
}

export async function updateRemediationTaskStatus(input: {
  taskId: string;
  founderId: string;
  status: RemediationStatus;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await admin
    .from("founder_remediation_tasks")
    .select("*")
    .eq("id", input.taskId)
    .eq("founder_id", input.founderId)
    .maybeSingle();

  if (loadError || !existing) {
    throw new Error("Remediation task not found.");
  }

  const completed_at =
    input.status === "completed" ? now : input.status === "open" ? null : existing.completed_at;

  const { data, error } = await admin
    .from("founder_remediation_tasks")
    .update({
      status: input.status,
      completed_at,
      updated_at: now,
    })
    .eq("id", input.taskId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update remediation task: ${error?.message ?? "unknown error"}`);
  }

  if (input.status === "completed") {
    void createNotification({
      recipientUserId: input.founderId,
      type: "remediation_task_completed",
      title: "Remediation task completed",
      message: data.title,
      entityType: "founder_remediation_task",
      entityId: data.id,
    });
  }

  return data as RemediationTaskRecord;
}

export function summarizeRemediationTasks(tasks: RemediationTaskRecord[]) {
  return {
    total: tasks.length,
    open: tasks.filter((task) => task.status === "open").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    dismissed: tasks.filter((task) => task.status === "dismissed").length,
    active: tasks.filter((task) => task.status === "open" || task.status === "in_progress").length,
  };
}

export async function getRemediationSummaryForCompanies(companyIds: string[]) {
  const map = new Map<string, ReturnType<typeof summarizeRemediationTasks>>();

  if (companyIds.length === 0) {
    return map;
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("founder_remediation_tasks")
    .select("company_id, status")
    .in("company_id", companyIds);

  if (error) {
    throw new Error(`Failed to load remediation summaries: ${error.message}`);
  }

  const grouped = new Map<string, RemediationTaskRecord[]>();

  for (const row of (data ?? []) as Array<{ company_id: string; status: string }>) {
    const list = grouped.get(row.company_id) ?? [];
    list.push(row as RemediationTaskRecord);
    grouped.set(row.company_id, list);
  }

  for (const companyId of companyIds) {
    map.set(companyId, summarizeRemediationTasks(grouped.get(companyId) ?? []));
  }

  return map;
}
