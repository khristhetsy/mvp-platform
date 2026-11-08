"use client";

import { useCallback, useEffect, useState } from "react";
import type { CampaignWithStats, HubLinkedIn, LinkedInAccount, ThreadRow } from "@/lib/linkedin/store";
import { CampaignsTab } from "./CampaignsTab";
import { LinkedInInbox } from "./LinkedInInbox";
import { NewCampaignTab } from "./NewCampaignTab";
import { SettingsTab } from "./SettingsTab";
import { ErrorLine, api, btnCls } from "./ui";

type TabId = "campaigns" | "new" | "inbox" | "settings";
const TABS: Array<{ id: TabId; label: string }> = [
  { id: "campaigns", label: "Campaigns" },
  { id: "new", label: "New campaign" },
  { id: "inbox", label: "Inbox" },
  { id: "settings", label: "Settings" },
];

type Overview = { account: LinkedInAccount; campaigns: CampaignWithStats[]; threads: ThreadRow[]; sentToday: number; hub: HubLinkedIn | null };

/** Admin › LinkedIn. Four tabs: Campaigns, New campaign, Inbox, Settings. */
export function LinkedInClient() {
  const [tab, setTab] = useState<TabId>("campaigns");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    api<Overview>("/api/admin/linkedin").then((r) => {
      if (!alive) return;
      if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
    });
    return () => { alive = false; };
  }, [tick]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">LinkedIn</h1>
        <p className="mt-1 text-[13px] text-slate-500">Invite your CRM contacts on LinkedIn, and hand every accepted connection to our AI assistant. Admin pilot.</p>
      </div>
      <div role="tablist" aria-label="LinkedIn" className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-[13.5px] ${tab === t.id ? "border-[#1A6CE4] font-semibold text-[#1A6CE4]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <ErrorLine text={error} />
      {data?.account.status === "warning" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px]">
          <span><b className="text-red-800">Paused by a LinkedIn warning.</b> <span className="text-red-700">Nothing more will be sent. Look at the account in LinkedIn first, then resume here.{data.account.paused_reason ? ` (${data.account.paused_reason})` : ""}</span></span>
          <button type="button" className={btnCls} onClick={() => { void api("/api/admin/linkedin/account", "PUT", { resume: true }).then(load); }}>Resume</button>
        </div>
      ) : null}
      {!data ? (error ? null : <p className="text-[13px] text-slate-500">Loading…</p>) : (
        <>
          {tab === "campaigns" ? <CampaignsTab campaigns={data.campaigns} onNew={() => setTab("new")} onChanged={load} /> : null}
          {tab === "new" ? <NewCampaignTab onSaved={() => { void load(); setTab("campaigns"); }} /> : null}
          {tab === "inbox" ? <LinkedInInbox threads={data.threads} onChanged={load} /> : null}
          {tab === "settings" ? <SettingsTab account={data.account} sentToday={data.sentToday} hub={data.hub} onChanged={(account) => setData({ ...data, account })} /> : null}
        </>
      )}
    </div>
  );
}
