"use client";

import { useEffect, useState } from "react";
import type { HubLinkedIn, LinkedInAccount } from "@/lib/linkedin/store";
import { LEVELS, dailyAutoCap, hubTokenState, warmUpDay } from "@/lib/linkedin/safety";
import { ErrorLine, Section, Tag, api, btnCls, dangerCls, primaryCls } from "./ui";

const START_FOLDER = "scripts/linkedin-sender";

function ago(iso: string | null, now: number): string {
  if (!iso) return "Not yet";
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} hour${h === 1 ? "" : "s"} ago` : `${Math.round(h / 24)} days ago`;
}

/** Settings › Sender. Makes the key for the program that runs on the owner's computer. */
export function SenderCard({ account, sentToday, hub, onChanged }: Readonly<{ account: LinkedInAccount; sentToday: number; hub: HubLinkedIn | null; onChanged: (a: LinkedInAccount) => void }>) {
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [extInstalled, setExtInstalled] = useState(false);
  const [paired, setPaired] = useState(false);

  // The iCapOS LinkedIn Connect extension answers a ping from this page. Nothing is sent to it until Connect is pressed.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; paired?: boolean } | null;
      if (d?.type !== "icapos-linkedin-extension") return;
      setExtInstalled(true);
      if (d.paired === true) setPaired(true);
    }
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "icapos-linkedin-ping" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const seen = account.worker_last_seen_at;
  const running = account.sender_key_set && !!seen;
  const state: "none" | "key" | "running" = key || (account.sender_key_set && !seen) ? "key" : running ? "running" : "none";
  const warned = account.status === "warning";

  async function make() {
    setBusy(true); setError(null);
    const r = await api<{ key: string }>("/api/admin/linkedin/sender", "POST");
    setBusy(false);
    if (r.ok) { setKey(r.data.key); onChanged({ ...account, sender_key_set: true, worker_last_seen_at: null }); } else setError(r.error);
  }
  async function connect() {
    setBusy(true); setError(null);
    const r = await api<{ key: string }>("/api/admin/linkedin/sender", "POST");
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onChanged({ ...account, sender_key_set: true, worker_last_seen_at: null });
    window.postMessage({ type: "icapos-linkedin-connect", key: r.data.key }, window.location.origin);
  }
  async function remove() {
    setBusy(true); setError(null);
    const r = await api("/api/admin/linkedin/sender", "DELETE");
    setBusy(false);
    if (r.ok) { setKey(null); onChanged({ ...account, sender_key_set: false, worker_last_seen_at: null, status: "not_connected" }); } else setError(r.error);
  }
  async function copy(label: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(label); } catch { setError("Could not copy. Select the text and copy it by hand."); }
  }

  const command = `ICAPOS_URL=${typeof window === "undefined" ? "https://your-domain" : window.location.origin} ICAPOS_SENDER_KEY=${key ?? "lis_…"} npm start`;
  const autoCap = dailyAutoCap({ level: account.safety_level, customDaily: account.custom_daily_cap, customWeekly: account.custom_weekly_cap, manualAllowance: account.manual_allowance, warmUpStartedAt: account.warm_up_started_at ?? new Date(now).toISOString() }, new Date(now));

  return (
    <Section title="Sender" icon="ti-plug-connected">
      <div className="space-y-3 px-4 py-3 text-[13px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-slate-500">A small program on your computer that fills in the invites iCapOS approves. You sign in to LinkedIn yourself, so your password never reaches iCapOS.</p>
          <Tag tone={state === "running" ? "ok" : state === "key" ? "info" : "mute"}>{state === "running" ? "Running" : state === "key" ? "Waiting for first start" : "Not set up"}</Tag>
        </div>

        <p className="text-[12.5px] text-slate-600">
          <span className="font-medium text-slate-800">Hub account:</span>{" "}
          {hub ? (() => {
            const h = hubTokenState(hub.token_expires_at, new Date(now));
            const until = hub.token_expires_at ? new Date(hub.token_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
            return (<>{hub.display_name} in Social Media <Tag tone={h === "ok" && hub.status === "connected" ? "ok" : "warn"}>{h === "expired" ? "Expired, reconnect" : h === "soon" ? `Expires ${until}, reconnect soon` : hub.status === "connected" ? "Connected" : hub.status}</Tag>{" "}<span className="text-slate-500">Posting only. Invites go through the sender.</span></>);
          })() : <span className="text-slate-500">No matching LinkedIn account connected in Social Media.</span>}
        </p>

        {state === "none" ? (
          <>
            <p className="font-medium text-slate-900">How to connect</p>
            <ol className="ml-5 list-decimal space-y-1 text-slate-600">
              <li>{extInstalled ? "The iCapOS LinkedIn Connect extension is installed in this Chrome." : <>Add the iCapOS LinkedIn Connect extension once: unzip it, open <code className="rounded bg-slate-100 px-1.5 py-0.5">chrome://extensions</code>, turn on Developer mode, press Load unpacked and pick the folder. Then reload this page.</>}</li>
              <li>Sign in to LinkedIn in this same Chrome. Your password stays with LinkedIn.</li>
              <li>Click <b>Connect LinkedIn</b>. It starts in dry run: invites are filled in, never sent.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryCls} disabled={busy || !extInstalled} onClick={connect}>Connect LinkedIn</button>
              {!extInstalled ? <button type="button" className={btnCls} onClick={() => window.postMessage({ type: "icapos-linkedin-ping" }, window.location.origin)}>Check again</button> : null}
            </div>
            <details className="text-slate-500">
              <summary className="cursor-pointer text-[12.5px]">Use the computer program instead</summary>
              <ol className="ml-5 mt-2 list-decimal space-y-1 text-slate-600">
                <li>Create your sender key below. It is shown once.</li>
                <li>On your computer run <code className="rounded bg-slate-100 px-1.5 py-0.5">npm install</code> then <code className="rounded bg-slate-100 px-1.5 py-0.5">npm start</code> in the <code className="rounded bg-slate-100 px-1.5 py-0.5">{START_FOLDER}</code> folder.</li>
                <li>Sign in to LinkedIn in the window that opens.</li>
              </ol>
              <button type="button" className={`${btnCls} mt-2`} disabled={busy} onClick={make}>Create sender key</button>
            </details>
          </>
        ) : null}

        {state === "key" ? (
          <>
            {key ? (
              <>
                <p className="font-medium text-slate-900">Your sender key <span className="font-normal text-slate-500">Copy it now. It will not be shown again.</span></p>
                <div className="break-all rounded-lg bg-slate-900 px-3 py-2 font-mono text-[12.5px] text-slate-100">{key}</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primaryCls} onClick={() => copy("key", key)}>{copied === "key" ? "Copied" : "Copy key"}</button>
                  <button type="button" className={btnCls} onClick={() => copy("cmd", command)}>{copied === "cmd" ? "Copied" : "Copy start command"}</button>
                </div>
                <p className="text-[12px] text-slate-500">Start command: <code className="rounded bg-slate-100 px-1.5 py-0.5">{command}</code></p>
              </>
            ) : (
              <p className="text-slate-600">{paired ? "Connected through the extension. Waiting for its first check, this takes about a minute." : "A key exists but the sender has not started yet. Connect again, or start the computer program with your key."}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {!key ? <button type="button" className={btnCls} disabled={busy || !extInstalled} onClick={connect}>Connect again</button> : null}
              <button type="button" className={dangerCls} disabled={busy} onClick={remove}>Remove key</button>
            </div>
          </>
        ) : null}

        {state === "running" ? (
          <>
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-slate-100">
                <tr><th className="w-32 py-1.5 font-medium text-slate-500">Last seen</th><td className="py-1.5">{ago(seen, now)}</td></tr>
                <tr><th className="py-1.5 font-medium text-slate-500">Mode</th><td className="py-1.5">{account.warm_up_started_at ? <Tag tone="ok">Live</Tag> : <Tag tone="warn">Dry run</Tag>} <span className="text-slate-500">{account.warm_up_started_at ? "invites are being sent within your limits." : "invites are filled in, not sent. To send for real, start the sender with DRY_RUN=false."}</span></td></tr>
                <tr><th className="py-1.5 font-medium text-slate-500">Account</th><td className="py-1.5">{account.label} <Tag tone={account.status === "connected" ? "ok" : warned ? "warn" : "mute"}>{account.status === "connected" ? "Connected" : warned ? "LinkedIn warning" : account.status === "paused" ? "Paused" : "Not connected yet"}</Tag></td></tr>
                <tr><th className="py-1.5 font-medium text-slate-500">Sent today</th><td className="py-1.5">{sentToday} of {autoCap} <span className="text-slate-500">automatic invites for your safety level ({account.safety_level === "careful" ? LEVELS.careful.daily : LEVELS.standard.daily} a day in total, day {Math.max(1, Math.min(21, warmUpDay(account.warm_up_started_at, new Date(now))))} of the 21 day start)</span></td></tr>
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnCls} disabled={busy} onClick={make}>Replace key</button>
              <button type="button" className={dangerCls} disabled={busy} onClick={remove}>Remove key (stops the sender)</button>
            </div>
          </>
        ) : null}
        <ErrorLine text={error} />
      </div>
    </Section>
  );
}
