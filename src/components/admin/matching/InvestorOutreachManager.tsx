"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutreachRecipient } from "@/lib/outreach/investor-outreach";
import type { OutreachCampaignSummary } from "@/app/api/admin/investor-outreach/route";

type CampaignAction = "approve" | "pause" | "resume" | "cap";

const STATUS_BADGE: Record<
  OutreachCampaignSummary["status"],
  { label: string; className: string }
> = {
  pending_approval: {
    label: "Pending approval",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  paused: {
    label: "Paused",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  completed: {
    label: "Completed",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
  },
};

function StatusBadge({ campaign }: { campaign: OutreachCampaignSummary }) {
  // A paused-but-approved campaign reads more usefully as "Paused".
  const key = campaign.paused && campaign.status === "approved" ? "paused" : campaign.status;
  const badge = STATUS_BADGE[key];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

const RECIPIENT_STATUS_LABEL: Record<OutreachRecipient["status"], string> = {
  queued: "Queued",
  sent: "Sent",
  skipped: "Skipped",
};

function LockedTemplatePreview() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Locked template · <span className="font-mono text-xs">intro_fit_v1</span>
        </h3>
        <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          locked · counsel-approved
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Read-only preview. Only company / sector / stage are substituted at send time — the body and
        disclaimer are fixed.
      </p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
        <p className="font-medium text-slate-900">
          Subject: A potential fit for your thesis — {"{{company}}"} ({"{{stage}}"}, {"{{sector}}"})
        </p>
        <p className="mt-3">Hi there,</p>
        <p className="mt-2">
          Our fit scoring flagged <span className="font-medium">{"{{company}}"}</span>, a{" "}
          {"{{stage}}"} company in {"{{sector}}"}, as a strong match for your stated preferences. We
          thought a light-touch introduction might be worthwhile.
        </p>
        <p className="mt-2">
          If you&apos;d like the overview, reply here and we&apos;ll share what the founder has made
          available. No obligation either way.
        </p>
        <p className="mt-2">Best regards,<br />The iCFO team</p>
        <p className="mt-4 border-t border-slate-200 pt-3 text-[11px] leading-5 text-slate-400">
          This message is an introduction based on fit scoring and is not investment advice, a
          recommendation, or a solicitation to buy or sell any security. Locked · counsel-approved
          disclaimer.
        </p>
      </div>
    </div>
  );
}

function SendLog({ campaignId }: { campaignId: string }) {
  const [recipients, setRecipients] = useState<OutreachRecipient[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/investor-outreach/${campaignId}`);
        if (!res.ok) throw new Error("Failed to load send log.");
        const data = (await res.json()) as { recipients: OutreachRecipient[] };
        if (active) {
          setRecipients(data.recipients);
          setError(null);
        }
      } catch {
        if (active) setError("Could not load the send log.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [campaignId]);

  if (loading) return <p className="px-4 py-3 text-xs text-slate-500">Loading send log…</p>;
  if (error) return <p className="px-4 py-3 text-xs text-rose-600">{error}</p>;
  if (!recipients || recipients.length === 0) {
    return <p className="px-4 py-3 text-xs text-slate-500">No recipients in this campaign.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2">Investor</th>
            <th className="px-4 py-2">Match</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Sent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {recipients.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/60">
              <td className="px-4 py-2 font-medium text-slate-800">{r.investor_name}</td>
              <td className="px-4 py-2 text-slate-600">{Math.round(r.match_score)}%</td>
              <td className="px-4 py-2 text-slate-600">{RECIPIENT_STATUS_LABEL[r.status]}</td>
              <td className="px-4 py-2 whitespace-nowrap text-slate-600">{formatDate(r.sent_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignCard({
  campaign,
  onAction,
}: {
  campaign: OutreachCampaignSummary;
  onAction: (id: string, action: CampaignAction, cap?: number) => Promise<void>;
}) {
  const [capValue, setCapValue] = useState<number>(campaign.weekly_cap);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);

  async function run(action: CampaignAction, cap?: number) {
    if (busy) return;
    setBusy(true);
    try {
      await onAction(campaign.id, action, cap);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{campaign.companyName}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Template <span className="font-mono">{campaign.template_key}</span> · last run{" "}
            {formatDate(campaign.last_run_at)}
          </p>
        </div>
        <StatusBadge campaign={campaign} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-lg font-semibold text-slate-900">{campaign.audienceCount}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Audience</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-lg font-semibold text-slate-900">{campaign.queuedCount}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Queued</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-lg font-semibold text-slate-900">{campaign.sentCount}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Sent</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        {campaign.status === "pending_approval" ? (
          <button
            type="button"
            onClick={() => run("approve")}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Approve &amp; queue
          </button>
        ) : null}

        <div>
          <label
            className="mb-1 block text-[11px] font-medium text-slate-600"
            htmlFor={`cap-${campaign.id}`}
          >
            Weekly cap
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`cap-${campaign.id}`}
              type="number"
              min={5}
              max={20}
              value={capValue}
              onChange={(e) => setCapValue(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
            <button
              type="button"
              onClick={() => run("cap", capValue)}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Save cap
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => run(campaign.paused ? "resume" : "pause")}
          disabled={busy}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {campaign.paused ? "Resume" : "Pause"}
        </button>

        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          {showLog ? "Hide send log" : "View send log"}
        </button>
      </div>

      {showLog ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/40">
          <SendLog campaignId={campaign.id} />
        </div>
      ) : null}
    </div>
  );
}

export function InvestorOutreachManager() {
  const [campaigns, setCampaigns] = useState<OutreachCampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/investor-outreach");
      if (!res.ok) {
        setError("Failed to load campaigns.");
        return;
      }
      const data = (await res.json()) as { campaigns: OutreachCampaignSummary[] };
      setCampaigns(data.campaigns);
      setError(null);
    } catch {
      setError("Network error loading campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const handleAction = useCallback(
    async (id: string, action: CampaignAction, cap?: number) => {
      const res = await fetch(`/api/admin/investor-outreach/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, cap }),
      });
      if (!res.ok) {
        setError("Action failed. Please try again.");
        return;
      }
      await load();
    },
    [load],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-900">
        <p>
          These are introductions based on fit scoring — <span className="font-medium">not</span>{" "}
          investment advice or solicitation. Copy is a locked, counsel-approved template; only
          company / sector / stage are dynamic.
        </p>
        <p className="mt-1 font-medium">
          Live email sending is currently OFF (<span className="font-mono">INVESTOR_OUTREACH_LIVE</span>).
        </p>
      </div>

      <LockedTemplatePreview />

      {loading ? (
        <p className="text-sm text-slate-500">Loading campaigns…</p>
      ) : error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No outreach campaigns yet. Drafts are created automatically from strong company matches.
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}
