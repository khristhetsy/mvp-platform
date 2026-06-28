"use client";

import { useState, useEffect } from "react";
import type { FounderAnalyticsSnapshot } from "@/lib/analytics/founder-analytics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DrawerKey =
  | "onboarding"
  | "readiness"
  | "contacts"
  | "pledges"
  | "remediation"
  | "learning"
  | "messages"
  | "outreach";

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------
function IcoCheck({ c = "#3B6D11" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
function IcoShield({ c = "#534AB7" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function IcoUsers({ c = "#0369a1" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function IcoDollar({ c = "#854F0B" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function IcoWrench({ c = "#A32D2D" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
}
function IcoBook({ c = "#534AB7" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
}
function IcoMail({ c = "#0369a1" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function IcoSend({ c = "#3B6D11" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}

// ---------------------------------------------------------------------------
// Clickable analytics card
// ---------------------------------------------------------------------------
function ACard({
  label,
  value,
  detail,
  icon,
  iconBg,
  valColor,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  iconBg: string;
  valColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99]"
      style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: iconBg }}>
          {icon}
        </div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: valColor }}>{value}</p>
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      <p className="mt-3 text-xs font-semibold text-indigo-700">View breakdown →</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Drawer primitives
// ---------------------------------------------------------------------------
function DStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

type BVariant = "success" | "medium" | "high" | "neutral" | "critical";
const BCLS: Record<BVariant, string> = {
  success:  "bg-[#EAF3DE] text-[#1E6D3C]",
  medium:   "bg-[#EEEDFE] text-[#3C3489]",
  high:     "bg-[#FAEEDA] text-[#854F0B]",
  neutral:  "bg-slate-100 text-slate-600",
  critical: "bg-[#FCEBEB] text-[#A32D2D]",
};

function BRow({ name, badge, variant = "neutral" }: { name: string; badge: string; variant?: BVariant }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-xs last:border-0">
      <span className="min-w-0 flex-1 truncate text-slate-800">{name}</span>
      <span className={`ml-3 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${BCLS[variant]}`}>
        {badge}
      </span>
    </div>
  );
}

function AdviceBox({ lines }: { lines: string[] }) {
  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "#1e1b4b" }}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "#534AB7" }}>
          AI
        </div>
        <span className="text-sm font-medium" style={{ color: "#e0e7ff" }}>Founder Intelligence</span>
      </div>
      <div className="space-y-2.5">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 text-xs leading-relaxed">
            <span className="shrink-0 font-semibold" style={{ color: "#818cf8" }}>{i + 1}.</span>
            <span style={{ color: "#c7d2fe" }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer content
// ---------------------------------------------------------------------------
function DrawerContent({
  drawerKey,
  a,
  onClose,
}: {
  drawerKey: DrawerKey;
  a: FounderAnalyticsSnapshot;
  onClose: () => void;
}) {
  const closeBtn = (
    <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close">✕</button>
  );

  const totalOutreach = Object.values(a.outreachByStatus).reduce((s, v) => s + v, 0);

  // ── Onboarding ─────────────────────────────────────────────────────────────
  if (drawerKey === "onboarding") {
    const remaining = 100 - a.onboardingPercent;
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div><p className="text-base font-semibold text-slate-900">Onboarding progress</p><p className="mt-0.5 text-xs text-slate-500">Steps completed toward a live listing</p></div>
          {closeBtn}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Progress" value={`${a.onboardingPercent}%`} />
          <DStatBox label="Remaining" value={`${remaining}%`} />
          <DStatBox label="Completed" value={a.onboardingCompletedAt ? "Yes" : "No"} />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-500">Completion</span><span className="font-semibold" style={{ color: "#3B6D11" }}>{a.onboardingPercent}%</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${a.onboardingPercent}%`, background: "#3B6D11" }} /></div>
        </div>
        <p className="mt-5 text-xs font-semibold text-slate-900">Status breakdown</p>
        <div className="mt-2">
          <BRow name="Onboarding completion" badge={`${a.onboardingPercent}%`} variant={a.onboardingPercent >= 80 ? "success" : a.onboardingPercent >= 50 ? "medium" : "high"} />
          <BRow name="Fully completed" badge={a.onboardingCompletedAt ? new Date(a.onboardingCompletedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not yet"} variant={a.onboardingCompletedAt ? "success" : "neutral"} />
          <BRow name="Readiness score" badge={a.readinessScore != null ? `${a.readinessScore}/100` : "Not yet assessed"} variant={a.readinessScore != null && a.readinessScore >= 80 ? "success" : a.readinessScore != null && a.readinessScore >= 50 ? "medium" : "neutral"} />
          <BRow name="Learning modules" badge={`${a.learningModulesCompleted}/${a.learningModulesPublished}`} variant={a.learningModulesCompleted === a.learningModulesPublished && a.learningModulesPublished > 0 ? "success" : "neutral"} />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {a.onboardingPercent === 100 ? "Onboarding is fully complete. Your profile is ready for investor review and marketplace publishing." : `You're ${a.onboardingPercent}% through onboarding with ${remaining}% remaining. ${a.onboardingPercent < 50 ? "Early-stage onboarding limits your marketplace visibility — investors see incomplete profiles as higher risk." : "You're past the halfway point. The final steps typically involve uploading financial documents and submitting for review."}`}
          </p>
        </div>
        <AdviceBox lines={[
          a.onboardingPercent < 100 ? `You're at ${a.onboardingPercent}% — the remaining ${remaining}% is blocking full marketplace visibility. Prioritise the next incomplete step today to move the needle quickly.` : "Onboarding complete. Keep your documents current and your profile updated — investors check upload dates during diligence.",
          a.onboardingPercent < 80 ? "Investors on iCapOS filter for profiles that are at least 80% complete. Crossing that threshold significantly increases your discoverability in search results." : a.onboardingPercent < 100 ? "You're in the top tier of completion. The remaining steps are typically quick wins — document uploads or profile text — rather than large tasks." : `Completed on ${a.onboardingCompletedAt ? new Date(a.onboardingCompletedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "record"}. Focus energy on investor engagement now that setup is done.`,
          a.readinessScore != null ? `Your readiness score of ${a.readinessScore}/100 is the investor-facing quality signal. Aim for 80+ to maximise first-meeting conversion rate.` : "Complete onboarding to unlock your first diligence report and readiness score — the key metric institutional investors use to filter listings.",
        ]} />
      </div>
    );
  }

  // ── Readiness ──────────────────────────────────────────────────────────────
  if (drawerKey === "readiness") {
    const snapshotCount = a.readinessSnapshots.length;
    const latestScore = a.readinessScore;
    const prevScore = snapshotCount >= 2 ? a.readinessSnapshots[1]?.score : null;
    const trend = latestScore != null && prevScore != null ? latestScore - prevScore : null;
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div><p className="text-base font-semibold text-slate-900">Readiness score</p><p className="mt-0.5 text-xs text-slate-500">Investor-readiness across all diligence factors</p></div>
          {closeBtn}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Current score" value={latestScore != null ? `${latestScore}/100` : "—"} />
          <DStatBox label="Reports" value={String(snapshotCount)} />
          <DStatBox label="Trend" value={trend != null ? (trend > 0 ? `+${trend}` : String(trend)) : "—"} />
        </div>
        <p className="mt-5 text-xs font-semibold text-slate-900">Score history</p>
        <div className="mt-2">
          {snapshotCount === 0 ? (
            <p className="py-2 text-xs text-slate-500">No diligence reports yet. Complete onboarding to generate your first report.</p>
          ) : (
            a.readinessSnapshots.slice(0, 5).map((snap, i) => (
              <BRow
                key={snap.createdAt}
                name={new Date(snap.createdAt).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}
                badge={snap.score != null ? `${snap.score}/100` : "—"}
                variant={snap.score != null && snap.score >= 80 ? "success" : snap.score != null && snap.score >= 50 ? "medium" : i === 0 ? "high" : "neutral"}
              />
            ))
          )}
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {latestScore == null ? "No readiness score yet. Your score is generated from diligence reports which require a complete data room and company profile." : latestScore >= 80 ? `A score of ${latestScore}/100 places you in the top tier — institutional investors typically require 80+ before taking a first meeting.` : latestScore >= 60 ? `A score of ${latestScore}/100 means you have the core narrative in place but are missing verification documents. Closing document gaps is the fastest path to improving this score.` : `A score of ${latestScore}/100 indicates significant diligence gaps. Most institutional investors filter below 60, so improving this is a prerequisite to marketplace success.`}
          </p>
        </div>
        <AdviceBox lines={[
          latestScore == null ? "Generate your first diligence report by completing your data room — upload your pitch deck, financial model, and executive summary to unlock the score." : latestScore >= 80 ? `Your score of ${latestScore} is strong. Focus on keeping documents current — investors check upload timestamps and outdated financials are a common red flag.` : `Your current score is ${latestScore}. Each missing document adds approximately 5–10 points when uploaded — identify the 2–3 with the highest impact and upload them this week.`,
          trend != null && trend > 0 ? `Your score improved by ${trend} points since the previous report — good momentum. Maintain this pace and you'll reach 80 within ${Math.ceil((80 - (latestScore ?? 0)) / trend)} more reports.` : trend != null && trend < 0 ? `Your score dropped by ${Math.abs(trend)} points since last time. This usually means a document expired or a review flagged new gaps. Review the latest report for specifics.` : snapshotCount > 0 ? "Run a fresh diligence report after uploading documents to get an updated score — scores don't update automatically." : "Request your first diligence report from the Readiness page to establish your baseline.",
          latestScore != null && latestScore < 90 ? `Getting to ${Math.min(100, (latestScore ?? 0) + 15)} requires closing your remaining document gaps and ensuring your pitch deck references audited numbers. Set a 2-week target.` : latestScore != null ? "Score of 90+: the marginal return from further score improvements is low. Shift focus to investor engagement and meeting conversion." : "A readiness score above 80 is the single biggest lever for improving your investor conversion rate on the platform.",
        ]} />
      </div>
    );
  }

  // ── Private contacts ───────────────────────────────────────────────────────
  if (drawerKey === "contacts") {
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div><p className="text-base font-semibold text-slate-900">Private contacts</p><p className="mt-0.5 text-xs text-slate-500">Investors in your personal CRM</p></div>
          {closeBtn}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Contacts" value={String(a.privateContactCount)} />
          <DStatBox label="Outreach targets" value={String(totalOutreach)} />
          <DStatBox label="Queued messages" value={String(a.queuedMessageCount)} />
        </div>
        <p className="mt-5 text-xs font-semibold text-slate-900">Outreach by status</p>
        <div className="mt-2">
          {Object.keys(a.outreachByStatus).length === 0 ? (
            <p className="py-2 text-xs text-slate-500">No outreach targets yet.</p>
          ) : (
            Object.entries(a.outreachByStatus).map(([status, count]) => (
              <BRow
                key={status}
                name={status.replace(/_/g, " ")}
                badge={String(count)}
                variant={status === "responded" || status === "converted" ? "success" : status === "contacted" ? "medium" : status === "bounced" || status === "unsubscribed" ? "critical" : "neutral"}
              />
            ))
          )}
          {a.privateContactCount > 0 && (
            <BRow name="Private CRM contacts" badge={String(a.privateContactCount)} variant="medium" />
          )}
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {a.privateContactCount === 0 ? "No private contacts yet. Your personal CRM is separate from the platform marketplace — these are investors you've added directly for targeted outreach." : `You have ${a.privateContactCount} private contact${a.privateContactCount === 1 ? "" : "s"} in your CRM with ${totalOutreach} outreach target${totalOutreach === 1 ? "" : "s"} across ${Object.keys(a.outreachByStatus).length} status${Object.keys(a.outreachByStatus).length === 1 ? "" : "es"}. Private contacts enable personalised outreach that converts at higher rates than cold marketplace discovery.`}
          </p>
        </div>
        <AdviceBox lines={[
          a.privateContactCount === 0 ? "Build your private contact list from your existing network — angels, former colleagues at investment funds, and warm intros are 4× more likely to invest than cold contacts." : `You have ${a.privateContactCount} private contact${a.privateContactCount === 1 ? "" : "s"}. Founders who actively manage 20–50 targeted contacts close rounds faster than those relying solely on marketplace discovery.`,
          totalOutreach > 0 ? `${totalOutreach} outreach target${totalOutreach === 1 ? "" : "s"} across your pipeline. Focus on contacts in "contacted" status — following up within 5 days of first contact has the highest conversion rate.` : "Add outreach targets from your contacts to begin tracking your personal fundraising pipeline alongside the platform activity.",
          a.queuedMessageCount > 0 ? `${a.queuedMessageCount} message${a.queuedMessageCount === 1 ? " is" : "s are"} queued. Review them before they send to ensure each is personalised — generic messages have a 60% lower response rate than tailored ones.` : "Use the outreach tools to queue personalised messages to your contacts. Batching outreach in weekly sessions is more effective than ad-hoc messaging.",
        ]} />
      </div>
    );
  }

  // ── Investor pledges ───────────────────────────────────────────────────────
  if (drawerKey === "pledges") {
    const totalActivity = a.investorInterestCount + a.introRequestCount + a.savedByInvestorsCount;
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div><p className="text-base font-semibold text-slate-900">Investor pledges</p><p className="mt-0.5 text-xs text-slate-500">Indicative interest from platform investors</p></div>
          {closeBtn}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Total pledged" value={a.pledgeTotalDisplay} />
          <DStatBox label="Investors" value={String(a.pledgeInvestorCount)} />
          <DStatBox label="Activity" value={String(totalActivity)} />
        </div>
        <p className="mt-5 text-xs font-semibold text-slate-900">Activity breakdown</p>
        <div className="mt-2">
          <BRow name="Indicative pledges" badge={a.pledgeTotalDisplay} variant={a.pledgeInvestorCount > 0 ? "success" : "neutral"} />
          <BRow name="Investors pledging" badge={`${a.pledgeInvestorCount} investor${a.pledgeInvestorCount === 1 ? "" : "s"}`} variant={a.pledgeInvestorCount > 0 ? "success" : "neutral"} />
          <BRow name="Expressed interest" badge={`${a.investorInterestCount} investor${a.investorInterestCount === 1 ? "" : "s"}`} variant={a.investorInterestCount > 0 ? "medium" : "neutral"} />
          <BRow name="Intro requests" badge={`${a.introRequestCount} pending`} variant={a.introRequestCount > 0 ? "high" : "neutral"} />
          <BRow name="Saved deals" badge={`${a.savedByInvestorsCount} investor${a.savedByInvestorsCount === 1 ? "" : "s"}`} variant="neutral" />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {a.pledgeInvestorCount === 0 ? "No pledges yet. Pledges are non-binding expressions of financial intent — they appear once investors formally signal interest in your listing after reviewing your data room." : `${a.pledgeTotalDisplay} in indicative pledges from ${a.pledgeInvestorCount} investor${a.pledgeInvestorCount === 1 ? "" : "s"}. You also have ${totalActivity} total platform interactions across interest, intros, and saves. These are non-binding signals — the next step is converting them to meetings and commitments.`}
          </p>
        </div>
        <AdviceBox lines={[
          a.pledgeInvestorCount === 0 ? "No pledges yet. Complete your data room and publish your listing — investors pledge after reviewing documents, so an empty data room is the most common blocker." : `${a.pledgeInvestorCount} investor${a.pledgeInvestorCount === 1 ? " has" : "s have"} pledged ${a.pledgeTotalDisplay}. Schedule a follow-up call with each this week — pledges convert to commitments at 3× the rate after a direct conversation.`,
          a.introRequestCount > 0 ? `${a.introRequestCount} intro request${a.introRequestCount === 1 ? " is" : "s are"} pending — these investors are actively trying to reach you. Reply within 48 hours; every day of delay reduces conversion probability significantly.` : a.investorInterestCount > 0 ? `${a.investorInterestCount} investor${a.investorInterestCount === 1 ? " has" : "s have"} expressed interest but haven't requested an intro yet. Send each a short personalised message to prompt the next step.` : "Focus on completing your data room to attract first interest — investors express interest most when they can see your pitch deck and financial model.",
          a.savedByInvestorsCount > 0 ? `${a.savedByInvestorsCount} investor${a.savedByInvestorsCount === 1 ? " has" : "s have"} saved your deal but haven't converted to active interest. Post a meaningful update — a new financial milestone or document — to trigger re-engagement.` : a.pledgeInvestorCount > 0 ? `Use your ${a.pledgeInvestorCount} pledge${a.pledgeInvestorCount === 1 ? "" : "s"} as social proof in outreach: "we have investor interest at similar levels" increases conversion with new prospects by up to 40%.` : "Once you receive your first pledge, use it strategically — it creates a FOMO dynamic that accelerates subsequent investor decisions.",
        ]} />
      </div>
    );
  }

  // ── Remediation ────────────────────────────────────────────────────────────
  if (drawerKey === "remediation") {
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div><p className="text-base font-semibold text-slate-900">Remediation tasks</p><p className="mt-0.5 text-xs text-slate-500">Gaps identified and tracked for resolution</p></div>
          {closeBtn}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Active" value={String(a.remediation.active)} />
          <DStatBox label="Completed" value={String(a.remediation.completed)} />
          <DStatBox label="Total" value={String(a.remediation.total)} />
        </div>
        <p className="mt-5 text-xs font-semibold text-slate-900">Task breakdown</p>
        <div className="mt-2">
          <BRow name="Open tasks" badge={String(a.remediation.open)} variant={a.remediation.open > 0 ? "critical" : "success"} />
          <BRow name="In progress" badge={String(a.remediation.inProgress)} variant={a.remediation.inProgress > 0 ? "high" : "neutral"} />
          <BRow name="Completed" badge={String(a.remediation.completed)} variant={a.remediation.completed > 0 ? "success" : "neutral"} />
          <BRow name="Dismissed" badge={String(a.remediation.dismissed)} variant="neutral" />
          <BRow name="Active (open + in-progress)" badge={String(a.remediation.active)} variant={a.remediation.active > 0 ? "high" : "success"} />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {a.remediation.active === 0 ? "No active remediation tasks. These tasks appear when diligence reports or document reviews identify specific gaps that need addressing before investor meetings." : `You have ${a.remediation.active} active remediation task${a.remediation.active === 1 ? "" : "s"} (${a.remediation.open} open, ${a.remediation.inProgress} in progress). Each task represents a specific investor-readiness gap — completing them directly improves your readiness score.`}
          </p>
        </div>
        <AdviceBox lines={[
          a.remediation.active === 0 ? "No active tasks — a clean slate. Use this time to request a fresh diligence report to check for new gaps before your next investor meeting." : a.remediation.open > 0 ? `${a.remediation.open} task${a.remediation.open === 1 ? " hasn't" : "s haven't"} been started yet. Each open task is a known gap that investors can find during diligence — closing them proactively reduces friction in the due diligence process.` : `${a.remediation.inProgress} task${a.remediation.inProgress === 1 ? " is" : "s are"} in progress. Completing in-progress tasks is faster than starting new ones — focus on finishing before starting new remediation work.`,
          a.remediation.completed > 0 ? `You've completed ${a.remediation.completed} remediation task${a.remediation.completed === 1 ? "" : "s"} — each one is a diligence risk you've eliminated. Request a new readiness report to see the score impact.` : a.remediation.active > 0 ? "Completing remediation tasks typically improves your readiness score by 5–15 points per task, depending on severity. Start with the highest-impact ones." : "Staying ahead of remediation is a strong operational signal for institutional investors who conduct structured due diligence.",
          a.remediation.total > 0 ? `Overall completion: ${a.remediation.total > 0 ? Math.round((a.remediation.completed / a.remediation.total) * 100) : 0}% of all identified tasks resolved. ${a.remediation.active > 3 ? "Batching similar tasks (all document-related together) reduces context-switching and gets more done in less time." : "Keep resolving tasks to maintain momentum toward a clean diligence record."}` : "Remediation tasks are generated automatically from your diligence reports. Complete onboarding and request a report to identify your specific gaps.",
        ]} />
      </div>
    );
  }

  // ── Learning ───────────────────────────────────────────────────────────────
  if (drawerKey === "learning") {
    const remaining = a.learningModulesPublished - a.learningModulesCompleted;
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div><p className="text-base font-semibold text-slate-900">Learning progress</p><p className="mt-0.5 text-xs text-slate-500">Institutional readiness modules</p></div>
          {closeBtn}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Progress" value={`${a.learningPercent}%`} />
          <DStatBox label="Completed" value={String(a.learningModulesCompleted)} />
          <DStatBox label="Remaining" value={String(remaining)} />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-500">Modules completed</span><span className="font-semibold" style={{ color: "#534AB7" }}>{a.learningModulesCompleted}/{a.learningModulesPublished}</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${a.learningPercent}%`, background: "#534AB7" }} /></div>
        </div>
        <p className="mt-5 text-xs font-semibold text-slate-900">Module breakdown</p>
        <div className="mt-2">
          <BRow name="Modules completed" badge={String(a.learningModulesCompleted)} variant={a.learningModulesCompleted > 0 ? "success" : "neutral"} />
          <BRow name="Modules remaining" badge={String(remaining)} variant={remaining > 0 ? "medium" : "success"} />
          <BRow name="Total published" badge={String(a.learningModulesPublished)} variant="neutral" />
          <BRow name="Overall progress" badge={`${a.learningPercent}%`} variant={a.learningPercent >= 80 ? "success" : a.learningPercent >= 50 ? "medium" : "high"} />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {a.learningModulesPublished === 0 ? "No learning modules available yet. The learning track covers institutional fundraising, data room preparation, and investor communication." : a.learningPercent === 100 ? `All ${a.learningModulesCompleted} modules completed. You've built the full institutional fundraising knowledge base — apply it in your investor conversations.` : `You've completed ${a.learningModulesCompleted} of ${a.learningModulesPublished} module${a.learningModulesPublished === 1 ? "" : "s"} (${a.learningPercent}%). ${remaining} module${remaining === 1 ? " remains" : "s remain"} — each one builds knowledge that directly improves your investor conversation quality.`}
          </p>
        </div>
        <AdviceBox lines={[
          a.learningPercent === 100 ? "All modules complete — excellent. Revisit the investor communication modules before key meetings as a refresher on objection handling." : remaining > 0 ? `${remaining} module${remaining === 1 ? "" : "s"} remaining. Complete 1 module per week and you'll finish in ${remaining} week${remaining === 1 ? "" : "s"} — well within a typical fundraise cycle.` : "No modules to complete yet. Check back as new content is published.",
          a.learningModulesCompleted > 0 ? `${a.learningModulesCompleted} completed module${a.learningModulesCompleted === 1 ? "" : "s"} represent real fundraising knowledge you can apply immediately. Founders who complete the full track convert investor meetings at 2× the rate.` : "Starting the learning track now builds a foundation that compounds throughout your raise — earlier completion means more time to apply the knowledge.",
          a.learningPercent > 0 && a.learningPercent < 100 ? `At ${a.learningPercent}%, you're in the ${a.learningPercent >= 75 ? "final stretch" : a.learningPercent >= 50 ? "middle" : "early stages"}. Keep the momentum — ${remaining} module${remaining === 1 ? "" : "s"} left to reach 100% and unlock the full knowledge baseline.` : a.learningPercent === 100 ? "Full completion signals operational discipline to institutional investors who review founder profiles during due diligence." : "Completing the first module is the hardest step — once you start, each subsequent module builds naturally on the last.",
        ]} />
      </div>
    );
  }

  // ── Messages ───────────────────────────────────────────────────────────────
  if (drawerKey === "messages") {
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div><p className="text-base font-semibold text-slate-900">Message threads</p><p className="mt-0.5 text-xs text-slate-500">Conversations and scheduled meetings</p></div>
          {closeBtn}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Threads" value={String(a.messageThreadCount)} />
          <DStatBox label="Meetings" value={String(a.meetingsScheduled)} />
          <DStatBox label="Contacts" value={String(a.privateContactCount)} />
        </div>
        <p className="mt-5 text-xs font-semibold text-slate-900">Communication breakdown</p>
        <div className="mt-2">
          <BRow name="Active message threads" badge={String(a.messageThreadCount)} variant={a.messageThreadCount > 0 ? "medium" : "neutral"} />
          <BRow name="Meetings scheduled" badge={String(a.meetingsScheduled)} variant={a.meetingsScheduled > 0 ? "success" : "neutral"} />
          <BRow name="Intro requests" badge={String(a.introRequestCount)} variant={a.introRequestCount > 0 ? "high" : "neutral"} />
          <BRow name="Queued outreach messages" badge={String(a.queuedMessageCount)} variant={a.queuedMessageCount > 0 ? "medium" : "neutral"} />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {a.messageThreadCount === 0 ? "No message threads yet. Conversations begin when investors request intros or when you initiate outreach through the platform." : `${a.messageThreadCount} active thread${a.messageThreadCount === 1 ? "" : "s"} with ${a.meetingsScheduled} meeting${a.meetingsScheduled === 1 ? "" : "s"} scheduled. Each thread represents an active investor relationship — response time and quality here are the biggest drivers of deal close.`}
          </p>
        </div>
        <AdviceBox lines={[
          a.messageThreadCount === 0 ? "No threads yet. Once your listing is published, investor intro requests create message threads automatically. You can also initiate from your private contacts." : `${a.messageThreadCount} active thread${a.messageThreadCount === 1 ? "" : "s"} — respond to all within 24 hours. Founders with sub-24-hour response times book meetings at 3× the rate of those who take 48+ hours.`,
          a.meetingsScheduled === 0 && a.messageThreadCount > 0 ? `You have threads but no meetings scheduled yet. The next step for each thread is a calendar invite — even a 20-minute intro call moves the relationship forward significantly.` : a.meetingsScheduled > 0 ? `${a.meetingsScheduled} meeting${a.meetingsScheduled === 1 ? "" : "s"} scheduled is excellent progress. Prepare a tight 5-minute update for each call and send materials 24 hours in advance.` : "Meetings are the primary conversion point in fundraising. Every conversation you have now is an opportunity to generate a warm referral to another investor.",
          a.introRequestCount > 0 ? `${a.introRequestCount} intro request${a.introRequestCount === 1 ? "" : "s"} pending — these convert to message threads once you accept. Don't leave them waiting: intro requests decay in quality after 72 hours without a response.` : a.queuedMessageCount > 0 ? `${a.queuedMessageCount} message${a.queuedMessageCount === 1 ? "" : "s"} queued for outreach. Review each before sending — personalised first lines increase response rates by 40%.` : "Keep your inbox active by checking weekly even during quiet periods — investor timing is unpredictable and fast response creates a strong first impression.",
        ]} />
      </div>
    );
  }

  // ── Queued outreach ────────────────────────────────────────────────────────
  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div><p className="text-base font-semibold text-slate-900">Queued outreach</p><p className="mt-0.5 text-xs text-slate-500">Draft and scheduled messages to investors</p></div>
        {closeBtn}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <DStatBox label="Queued" value={String(a.queuedMessageCount)} />
        <DStatBox label="Drafts" value={String(a.campaignDraftCount)} />
        <DStatBox label="Active" value={String(a.campaignQueuedCount)} />
      </div>
      <p className="mt-5 text-xs font-semibold text-slate-900">Outreach breakdown</p>
      <div className="mt-2">
        <BRow name="Queued messages" badge={String(a.queuedMessageCount)} variant={a.queuedMessageCount > 0 ? "medium" : "neutral"} />
        <BRow name="Campaign drafts" badge={String(a.campaignDraftCount)} variant={a.campaignDraftCount > 0 ? "neutral" : "neutral"} />
        <BRow name="Queued / active campaigns" badge={String(a.campaignQueuedCount)} variant={a.campaignQueuedCount > 0 ? "high" : "neutral"} />
        <BRow name="Social drafts generated" badge={String(a.socialDraftGenerated)} variant={a.socialDraftGenerated > 0 ? "medium" : "neutral"} />
        <BRow name="Social drafts copied" badge={String(a.socialDraftCopied)} variant={a.socialDraftCopied > 0 ? "success" : "neutral"} />
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
        <p className="text-xs leading-relaxed text-slate-600">
          {a.queuedMessageCount === 0 && a.campaignDraftCount === 0 ? "No outreach queued yet. Use the outreach tools to create personalised messages to your private contacts or run campaigns to segments of your investor pipeline." : `${a.queuedMessageCount} message${a.queuedMessageCount === 1 ? "" : "s"} queued across ${a.campaignDraftCount} draft and ${a.campaignQueuedCount} active campaign${a.campaignQueuedCount === 1 ? "" : "s"}. Outreach at this stage directly drives new investor interest and meeting volume.`}
        </p>
      </div>
      <AdviceBox lines={[
        a.queuedMessageCount === 0 ? "No messages queued. Build a list of 10–20 warm investor contacts and queue personalised outreach to each — this is the highest-leverage activity for early fundraise momentum." : `${a.queuedMessageCount} message${a.queuedMessageCount === 1 ? "" : "s"} in your queue. Review each before it sends to verify the personalisation is specific — mentioning a mutual connection or recent investment increases open rates by 35%.`,
        a.campaignDraftCount > 0 ? `${a.campaignDraftCount} draft campaign${a.campaignDraftCount === 1 ? "" : "s"} sitting unpublished. Activate them or delete them — draft fatigue is real and old drafts lose relevance quickly.` : a.campaignQueuedCount > 0 ? `${a.campaignQueuedCount} active campaign${a.campaignQueuedCount === 1 ? "" : "s"} running. Monitor response rates after the first 48 hours and pause any campaign where open rate drops below 20%.` : "Create your first campaign by segmenting your contacts by investor type — angels, micro-VCs, and family offices respond to different messaging.",
        a.socialDraftGenerated > 0 ? `${a.socialDraftGenerated} social draft${a.socialDraftGenerated === 1 ? "" : "s"} generated, ${a.socialDraftCopied} copied. ${a.socialDraftCopied === 0 ? "Copy and post your drafts — social proof from a founder who communicates publicly attracts inbound investor interest." : "Your social drafts are being used. Posting 1–2 times per week during a raise builds credibility with investors who research you before meetings."}` : "Use the social draft generator to create LinkedIn content about your raise milestones — public updates create inbound investor interest without direct outreach cost.",
      ]} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function AnalyticsCardsClient({ analytics: a }: { analytics: FounderAnalyticsSnapshot }) {
  const [open, setOpen] = useState<DrawerKey | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Row 1 */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ACard label="Onboarding progress" value={`${a.onboardingPercent}%`} detail={a.onboardingCompletedAt ? `Completed ${new Date(a.onboardingCompletedAt).toLocaleDateString("en-US")}` : "Current snapshot"} icon={<IcoCheck />} iconBg="#E1F5EE" valColor="#3B6D11" onClick={() => setOpen("onboarding")} />
        <ACard label="Readiness score" value={a.readinessScore != null ? `${a.readinessScore}` : "—"} detail="Latest diligence report" icon={<IcoShield />} iconBg="#EEEDFB" valColor="#3C3489" onClick={() => setOpen("readiness")} />
        <ACard label="Private contacts" value={String(a.privateContactCount)} detail="Founder CRM contacts" icon={<IcoUsers />} iconBg="#E0F2FE" valColor="#0369a1" onClick={() => setOpen("contacts")} />
        <ACard label="Investor pledges" value={a.pledgeTotalDisplay} detail={`${a.pledgeInvestorCount} investors · platform activity`} icon={<IcoDollar />} iconBg="#FEF3CD" valColor="#854F0B" onClick={() => setOpen("pledges")} />
      </section>

      {/* Row 2 */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ACard label="Remediation active" value={String(a.remediation.active)} detail={`${a.remediation.completed} completed · ${a.remediation.open} open`} icon={<IcoWrench />} iconBg="#FCEBEB" valColor={a.remediation.active > 0 ? "#A32D2D" : "#0c2340"} onClick={() => setOpen("remediation")} />
        <ACard label="Learning progress" value={`${a.learningPercent}%`} detail={`${a.learningModulesCompleted}/${a.learningModulesPublished} modules`} icon={<IcoBook />} iconBg="#EEEDFB" valColor="#3C3489" onClick={() => setOpen("learning")} />
        <ACard label="Message threads" value={String(a.messageThreadCount)} detail={`${a.meetingsScheduled} meetings scheduled`} icon={<IcoMail />} iconBg="#E0F2FE" valColor="#0369a1" onClick={() => setOpen("messages")} />
        <ACard label="Queued outreach" value={String(a.queuedMessageCount)} detail={`${a.campaignDraftCount} draft · ${a.campaignQueuedCount} queued`} icon={<IcoSend />} iconBg="#E1F5EE" valColor="#3B6D11" onClick={() => setOpen("outreach")} />
      </section>

      {/* Centered slide-up drawer — 448 × 536 px */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 200ms" }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(12, 35, 64, 0.35)" }} onClick={() => setOpen(null)} />
        <div
          className="relative w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
          style={{ maxWidth: 448, maxHeight: 536, transform: open ? "translateY(0)" : "translateY(40px)", transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {open && <DrawerContent drawerKey={open} a={a} onClose={() => setOpen(null)} />}
        </div>
      </div>
    </>
  );
}
