"use client";

import { useCallback, useEffect, useState } from "react";
import type { CollaborationCommentView, CollaborationEntityType, CollaborationVisibility } from "@/lib/collaboration/types";
import { CollaborationCommentForm } from "@/components/collaboration/CollaborationCommentForm";
import { CollaborationCommentList } from "@/components/collaboration/CollaborationCommentList";
import { CollaborationEmptyState } from "@/components/collaboration/CollaborationEmptyState";

export function CollaborationDiscussionPanel({
  entityType,
  entityId,
  title = "Discussion",
  className,
  threadContext,
}: Readonly<{
  entityType: CollaborationEntityType;
  entityId: string;
  title?: string;
  className?: string;
  threadContext?: { companyId?: string | null; investorProfileId?: string | null; spvId?: string | null };
}>) {
  const [comments, setComments] = useState<CollaborationCommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allowedVisibilities, setAllowedVisibilities] = useState<CollaborationVisibility[]>(["internal"]);
  const [defaultVisibility, setDefaultVisibility] = useState<CollaborationVisibility>("internal");
  const [canInternalNote, setCanInternalNote] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ entityType, entityId });
      const res = await fetch(`/api/collaboration?${params.toString()}`);
      if (res.status === 401) {
        setLoadError("Sign in to view discussion.");
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Unable to load discussion.");
      }
      const data = (await res.json()) as {
        comments: CollaborationCommentView[];
        allowedVisibilities?: CollaborationVisibility[];
        defaultVisibility?: CollaborationVisibility;
        canInternalNote?: boolean;
      };
      setComments(data.comments ?? []);
      setAllowedVisibilities(data.allowedVisibilities ?? ["internal"]);
      setDefaultVisibility(data.defaultVisibility ?? "internal");
      setCanInternalNote(Boolean(data.canInternalNote));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load discussion.");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- refresh discussion thread when entity changes */
    void refresh();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh]);

  async function handleSubmit(input: {
    body: string;
    visibility: CollaborationVisibility;
    isInternalNote: boolean;
  }) {
    const res = await fetch("/api/collaboration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType,
        entityId,
        body: input.body,
        visibility: input.visibility,
        isInternalNote: input.isInternalNote,
        threadContext,
      }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? "Unable to post comment.");
    }
    await refresh();
  }

  return (
    <div className={`rounded-xl border border-slate-200/80 bg-slate-50/30 px-4 py-3 ${className ?? ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">Entity-scoped collaboration — not messaging.</p>

      {loading ? <p className="mt-3 text-xs text-slate-500">Loading discussion…</p> : null}
      {loadError ? (
        <p className="mt-3 text-xs text-red-800" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError ? (
        <div className="mt-3 space-y-3">
          {comments.length > 0 ? <CollaborationCommentList comments={comments} /> : <CollaborationEmptyState />}
          <CollaborationCommentForm
            allowedVisibilities={allowedVisibilities}
            defaultVisibility={defaultVisibility}
            canInternalNote={canInternalNote}
            onSubmit={handleSubmit}
            disabled={Boolean(loadError)}
          />
        </div>
      ) : null}
    </div>
  );
}
