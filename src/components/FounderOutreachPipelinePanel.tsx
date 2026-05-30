"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EnrichedOutreachTarget } from "@/lib/founder-crm/outreach";
import type { OutreachReadinessResult } from "@/lib/founder-crm/outreach-readiness";
import type { OutreachCampaignRecord } from "@/lib/founder-crm/types";

const PIPELINE_STATUSES = [
  "all",
  "recommended",
  "selected",
  "intro_requested",
  "contacted",
  "responded",
  "meeting_scheduled",
  "declined",
] as const;

type Props = {
  targets: EnrichedOutreachTarget[];
  campaigns: OutreachCampaignRecord[];
  readiness: OutreachReadinessResult;
  companyName: string;
  onTargetsChange: (targets: EnrichedOutreachTarget[]) => void;
  onMessage: (message: string | null) => void;
};

export function FounderOutreachPipelinePanel({
  targets: initialTargets,
  campaigns,
  readiness,
  companyName,
  onTargetsChange,
  onMessage,
}: Readonly<Props>) {
  const router = useRouter();
  const [targets, setTargets] = useState(initialTargets);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === "all") {
      return targets;
    }
    return targets.filter((row) => row.status === statusFilter);
  }, [targets, statusFilter]);

  const contactTargets = useMemo(
    () => targets.filter((row) => row.contact_id && row.status === "selected"),
    [targets],
  );

  async function updateTargetStatus(targetId: string, status: string) {
    setLoading(true);
    onMessage(null);
    const response = await fetch(`/api/founder/outreach/targets/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = (await response.json().catch(() => null)) as {
      target?: EnrichedOutreachTarget;
      error?: string;
    } | null;
    setLoading(false);
    if (!response.ok || !body?.target) {
      onMessage(body?.error ?? "Unable to update pipeline status.");
      return;
    }
    const prev = targets.find((row) => row.id === targetId);
    const nextRow: EnrichedOutreachTarget = {
      ...(prev ?? body.target),
      ...body.target,
      displayName: prev?.displayName ?? "Target",
      displaySubtitle: prev?.displaySubtitle ?? null,
      targetKind: prev?.targetKind ?? "unknown",
    };
    setTargets((rows) => rows.map((row) => (row.id === targetId ? nextRow : row)));
    onTargetsChange(targets.map((row) => (row.id === targetId ? nextRow : row)));
    onMessage("Pipeline status updated.");
  }

  async function archiveTarget(targetId: string) {
    setLoading(true);
    const response = await fetch(`/api/founder/outreach/targets/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    setLoading(false);
    if (!response.ok) {
      onMessage("Unable to archive pipeline target.");
      return;
    }
    const next = targets.filter((row) => row.id !== targetId);
    setTargets(next);
    onTargetsChange(next);
    onMessage("Removed from pipeline.");
    router.refresh();
  }

  async function requestIntro(targetId: string) {
    setLoading(true);
    onMessage(null);
    const response = await fetch(`/api/founder/outreach/targets/${targetId}/intro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await response.json().catch(() => null)) as {
      threadUrl?: string;
      error?: string;
    } | null;
    setLoading(false);
    if (!response.ok) {
      onMessage(body?.error ?? "Unable to request intro.");
      return;
    }
    setTargets((rows) =>
      rows.map((row) => (row.id === targetId ? { ...row, status: "intro_requested" } : row)),
    );
    onMessage(
      body?.threadUrl
        ? "Intro requested — open your message thread to continue."
        : "Intro requested via platform messaging.",
    );
    router.refresh();
  }

  async function draftCampaignFromPipeline() {
    if (!readiness.allowed) {
      onMessage("Complete outreach readiness requirements first.");
      return;
    }

    const targetIds = contactTargets.map((row) => row.id);
    if (targetIds.length === 0) {
      onMessage("Add private CRM contacts to the pipeline (selected status) to draft email messages.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/founder/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${companyName} pipeline outreach ${new Date().toLocaleDateString("en-US")}`,
        targetIds,
        draftKind: "intro",
      }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string; complianceNotice?: string };
    setLoading(false);
    if (!response.ok) {
      onMessage(body?.error ?? "Unable to create campaign.");
      return;
    }
    onMessage(body?.complianceNotice ?? "Campaign drafted from pipeline targets (no emails sent).");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Outreach pipeline ({filtered.length})</h2>
        <p className="mt-1 text-sm text-slate-600">
          Private CRM contacts and platform matches you selected for outreach. Platform intros use messaging only — no
          private investor data is shared with other founders.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            {PIPELINE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : status}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              No pipeline targets yet. Use Select for outreach on CRM contacts or platform matches.
            </p>
          ) : (
            filtered.map((row) => (
              <div key={row.id} className="py-3 text-sm">
                <p className="font-medium text-slate-900">
                  {row.displayName}
                  {row.displaySubtitle ? (
                    <span className="font-normal text-slate-500"> · {row.displaySubtitle}</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.targetKind === "platform" ? "Platform investor" : "Private CRM"} · {row.status} · {row.source}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={row.status}
                    disabled={loading}
                    onChange={(event) => void updateTargetStatus(row.id, event.target.value)}
                    className="rounded border px-2 py-0.5 text-xs"
                  >
                    {PIPELINE_STATUSES.filter((s) => s !== "all").map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  {row.targetKind === "platform" ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void requestIntro(row.id)}
                      className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-800"
                    >
                      Request intro
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void archiveTarget(row.id)}
                    className="rounded border px-2 py-0.5 text-xs text-amber-800"
                  >
                    Archive from pipeline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Campaign from pipeline</h2>
        <p className="mt-1 text-xs text-slate-600">
          Drafts email messages for private CRM contacts in selected pipeline status ({contactTargets.length} eligible).
          Platform-only targets are tracked here but use messaging for intros.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void draftCampaignFromPipeline()}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Draft campaign from selected pipeline contacts
        </button>
        {campaigns.length > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            {campaigns.length} campaign(s) on file — manage drafts in CRM &amp; outreach tab.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-amber-800">Internal queue only — no external email sending.</p>
      </section>

      <p className="text-xs text-slate-500">
        After requesting an intro, continue in{" "}
        <Link href="/founder/messages" className="text-indigo-600 underline">
          Messages
        </Link>
        .
      </p>
    </div>
  );
}
