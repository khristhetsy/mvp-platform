"use client";

import { useState } from "react";
import { DoneCard, WizardFrame } from "@/components/founder/social/LaunchFrame";
import { PLATFORM_LABEL, btn, btnPrimary, type Account } from "@/components/founder/social/FounderSocialShared";

const NETWORKS: { key: string; note: string }[] = [
  { key: "linkedin", note: "Your profile or company page" },
  { key: "facebook", note: "A Facebook page. Also needed for Instagram" },
  { key: "instagram", note: "Needs a Facebook page, posts need an image" },
  { key: "reddit", note: "Posts go to the communities you pick" },
];
const LABELS = ["Network", "Approve", "Confirm"];

export type ConnectResult = { network: string; status: string; message: string | null } | null;

/** Part 1 of Launch my social media: connect one account, one step at a time. */
export function ConnectWizard({ accounts, acting, result, onExit, onNext }: {
  accounts: Account[]; acting: boolean; result: ConnectResult; onExit: () => void; onNext: () => void;
}) {
  // Coming back from the network with a connected result lands on Confirm.
  const [step, setStep] = useState(result?.status === "connected" ? 2 : result ? 1 : 0);
  const [network, setNetwork] = useState(result?.network ?? "linkedin");
  const [finished, setFinished] = useState(false);
  const label = PLATFORM_LABEL[network] ?? network;
  const mine = accounts.filter((a) => a.platform === network && a.status !== "disconnected");
  const connected = (key: string) => accounts.some((a) => a.platform === key && a.status !== "disconnected");

  if (finished) {
    return (
      <DoneCard title={`${label} connected`} body="Next, create a campaign so your posts roll up to one goal.">
        <button type="button" className={btnPrimary} onClick={onNext}>Create a campaign</button>
        <button type="button" className={btn} onClick={onExit}>Back to home</button>
      </DoneCard>
    );
  }

  const failed = result && result.status !== "connected" && step === 1;
  return (
    <WizardFrame title="Connect an account" part="Launch my social media, part 1 of 4" labels={LABELS} step={step}
      onBack={() => setStep((s) => Math.max(0, s - 1))} onNext={() => (step === 2 ? setFinished(true) : setStep((s) => s + 1))}
      nextLabel={step === 2 ? "Finish" : "Next"} nextDisabled={step === 2 && mine.length === 0} hideNext={step === 1} onExit={onExit}>
      {step === 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Which account do you want to connect?</h3>
          <p className="mt-1 text-sm text-slate-600">You can add more later.</p>
          <div className="mt-3 grid gap-2">
            {NETWORKS.map((n) => (
              <label key={n.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${network === n.key ? "border-2 border-[#1A6CE4] bg-blue-50" : "border-slate-200 bg-white"}`}>
                <input type="radio" name="network" className="mt-1" checked={network === n.key} onChange={() => setNetwork(n.key)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{PLATFORM_LABEL[n.key]}</span>
                  <span className="block text-xs text-slate-500">{n.note}</span>
                </span>
                {connected(n.key) && <span className="text-xs font-medium text-emerald-700">Connected</span>}
              </label>
            ))}
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Approve access on {label}</h3>
          <p className="mt-1 text-sm text-slate-600">You go to {label}, sign in, and tap Allow. You come back here automatically. We never see your password.</p>
          {failed && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              {result?.status === "unconfigured" ? `${label} is not set up on this account yet. Try another network.` : `${label} did not connect${result?.message ? `: ${result.message.replace(/_/g, " ")}` : ""}. Try again.`}
            </p>
          )}
          {acting ? (
            <p className="mt-3 text-sm text-slate-600">Only the founder can approve access to their own accounts.</p>
          ) : (
            <a href={`/api/founder/social/connect?platform=${network}`} className={`${btnPrimary} mt-4 inline-block`}>Approve on {label}</a>
          )}
        </div>
      )}
      {step === 2 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Check the account</h3>
          <p className="mt-1 text-sm text-slate-600">This is the account your posts will use.</p>
          {mine.length === 0 ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">{label} is not connected yet. Go back and approve access.</p>
          ) : (
            <div className="mt-3 rounded-lg border border-slate-200">
              {mine.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2 first:border-t-0">
                  <span className="text-sm text-slate-900">{label}{a.displayName ? `, ${a.displayName}` : ""}</span>
                  <span className="text-xs font-medium text-emerald-700">Connected</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WizardFrame>
  );
}
