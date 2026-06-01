import type { GmailFoundationStatus } from "@/lib/email/types";
import { PageSection } from "@/components/ui/workspace-layout";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function EmailFoundationSection({ status }: Readonly<{ status: GmailFoundationStatus }>) {
  return (
    <PageSection title="Gmail / email foundation (Phase 1)">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge
          label={status.draftingAvailable ? "Drafting available" : "Unavailable"}
          status={status.draftingAvailable ? "success" : "neutral"}
        />
        <StatusBadge label="Auto-send disabled" status="neutral" />
        {status.googleConnected ? (
          <StatusBadge label="Google connected" status="success" />
        ) : (
          <StatusBadge label="Google not connected" status="neutral" />
        )}
      </div>
      <p className="mt-3 text-xs text-slate-600">{status.message}</p>
      {status.googleEmailHint ? (
        <p className="mt-1 text-xs text-slate-500">Connected account hint: {status.googleEmailHint}</p>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        Workflow flow: event → email draft/template → user confirmation in their own client → tracked via audit logs.
        No OAuth tokens or message bodies are exposed in the admin UI.
      </p>
    </PageSection>
  );
}
