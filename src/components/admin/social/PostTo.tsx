"use client";

import { useEffect, useRef, useState } from "react";
import type { SocialAccount } from "@/lib/social/queries";
import { accountName } from "@/lib/social/account-name";
import { NETWORK_DEFAULTS, type GroupNetwork } from "@/lib/social/group-share";

/**
 * Step "Post to": one multi select dropdown. Accounts post or schedule for you; Groups
 * (Facebook, LinkedIn) are a hand-tapped queue shown below by the parent.
 */
export function PostTo({ accounts, selected, onToggleAccount, groupNets, onToggleGroupNet, groupsEnabled }: {
  accounts: SocialAccount[]; selected: string[]; onToggleAccount: (id: string) => void;
  groupNets: GroupNetwork[]; onToggleGroupNet: (n: GroupNetwork) => void; groupsEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const chosenAccounts = accounts.filter((a) => selected.includes(a.id));
  const empty = chosenAccounts.length === 0 && groupNets.length === 0;
  const head = "sticky top-0 bg-slate-50 px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500";
  const row = "flex cursor-pointer items-center gap-2.5 border-t border-slate-50 px-3 py-2 hover:bg-slate-50";
  return (
    <div ref={ref} className="relative mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[13px]">
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {empty ? <span className="text-slate-400">Choose where to post</span> : null}
          {chosenAccounts.map((a) => <span key={a.id} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[12px] font-semibold text-indigo-700">{accountName(a)}</span>)}
          {groupNets.map((n) => <span key={n} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[12px] font-semibold text-slate-700">{NETWORK_DEFAULTS[n].label}</span>)}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div role="listbox" aria-multiselectable="true" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className={head}>Accounts</div>
          {accounts.length === 0 ? <p className="px-3 py-2 text-[12px] text-slate-400">No accounts connected.</p> : accounts.map((a) => (
            <label key={a.id} className={row}>
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => onToggleAccount(a.id)} />
              <span className="text-[13px]"><b className="block font-semibold text-slate-800">{accountName(a)}{a.is_default ? <span className="ml-1 text-[10px] font-normal opacity-60">default</span> : null}</b><small className="text-slate-500">Posts or schedules for you</small></span>
            </label>
          ))}
          {groupsEnabled ? (
            <>
              <div className={head}>Groups (you tap Post on each)</div>
              {(["facebook", "linkedin"] as GroupNetwork[]).map((n) => (
                <label key={n} className={row}>
                  <input type="checkbox" checked={groupNets.includes(n)} onChange={() => onToggleGroupNet(n)} />
                  <span className="text-[13px]"><b className="block font-semibold text-slate-800">{NETWORK_DEFAULTS[n].label}</b><small className="text-slate-500">Queue with copy and open</small></span>
                </label>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
