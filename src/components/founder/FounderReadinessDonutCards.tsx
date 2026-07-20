"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { DocumentChecklistItem, ProfileCompletionItem } from "@/lib/data/founder-readiness";

type DrawerKey = "score" | "profile" | "docs" | "diligence";

interface Props {
  readinessScore: number;
  readinessDetail: string;
  profilePercent: number;
  profileItems: ProfileCompletionItem[];
  uploadedCount: number;
  checklistTotal: number;
  checklist: DocumentChecklistItem[];
  missingCount: number;
  reviewStatusFormatted: string;
  isPublished: boolean;
  reviewFeedback: string | null;
}

function DonutChart({
  pct,
  color,
  size = 48,
}: {
  pct: number;
  color: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.375;
  const sw = size * 0.125;
  const safeP = Math.max(0.01, Math.min(0.999, pct));
  const a1 = -Math.PI / 2;
  const a2 = safeP * 2 * Math.PI - Math.PI / 2;
  const x1 = (cx + r * Math.cos(a1)).toFixed(2);
  const y1 = (cy + r * Math.sin(a1)).toFixed(2);
  const x2 = (cx + r * Math.cos(a2)).toFixed(2);
  const y2 = (cy + r * Math.sin(a2)).toFixed(2);
  const large = safeP > 0.5 ? 1 : 0;
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#EEEDFE"
        strokeWidth={sw}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatusBadge({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

export function FounderReadinessDonutCards({
  readinessScore,
  readinessDetail,
  profilePercent,
  profileItems,
  uploadedCount,
  checklistTotal,
  checklist,
  missingCount,
  reviewStatusFormatted,
  isPublished,
  reviewFeedback,
}: Props) {
  const t = useTranslations("founderCmp");
  const [open, setOpen] = useState<DrawerKey | null>(null);

  const profileComplete = profileItems.filter((i) => i.complete).length;
  const profileMissing = profileItems.filter((i) => !i.complete).length;
  const needsReviewCount = checklist.filter((i) => i.status === "needs_review").length;

  /* ---------- advice generators ---------- */
  function scoreAdvice(): string[] {
    const pts = [
      missingCount > 0
        ? `Upload your ${missingCount} missing document${missingCount > 1 ? "s" : ""} — each one adds up to 6 points toward the 80 threshold investors expect before a first meeting.`
        : "Your documents are complete. Focus on profile fields and responding to admin review feedback to push past 90.",
      needsReviewCount > 0
        ? `${needsReviewCount} document${needsReviewCount > 1 ? "s are" : " is"} awaiting review — follow up with your admin reviewer to accelerate approval.`
        : "No documents are pending review. Prioritize uploading any missing items to maintain momentum.",
      readinessScore < 80
        ? `You are ${80 - readinessScore} points from the 80/100 threshold. Closing your document gaps is the fastest path — most investors filter below that level.`
        : "You are above the 80/100 benchmark. Focus on profile completion and diligence review to reach institutional-grade status.",
    ];
    return pts;
  }

  function profileAdvice(): string[] {
    const incomplete = profileItems.filter((i) => !i.complete).map((i) => i.label);
    return [
      profileMissing > 0
        ? `Complete ${incomplete[0] ?? "the missing fields"} — it only takes a few minutes and improves your visibility ranking on the marketplace.`
        : "Your profile is 100% complete. This maximises your visibility to investors browsing the marketplace.",
      profilePercent < 100
        ? `${profileMissing} field${profileMissing > 1 ? "s" : ""} ${profileMissing > 1 ? "are" : "is"} missing: ${incomplete.slice(0, 3).join(", ")}. Each missing field reduces search filter matches.`
        : "Investors can see all your key information. Keep it updated as your company details change.",
      profilePercent >= 100
        ? "Full profiles receive 40% more investor views on average. Your listing is fully optimised."
        : "At 100% profile completion, iCapOS boosts your marketplace visibility score by a full tier — worth the 5-minute effort.",
    ];
  }

  function docsAdvice(): string[] {
    const missing = checklist.filter((i) => i.status === "missing").map((i) => i.label);
    return [
      missing.length > 0
        ? `Start with ${missing[0]} — it is the most commonly requested document in investor due diligence and unblocks the most match filters.`
        : "All documents are uploaded. Keep them current, especially your financial model and pitch deck.",
      missing.length > 1
        ? `You still need: ${missing.slice(0, 3).join(", ")}. Each missing document reduces the number of investors who see your listing in filtered searches.`
        : missing.length === 1
        ? `Only ${missing[0]} is missing. Upload it to reach full document coverage.`
        : "Your document coverage is complete. Focus on keeping files up to date.",
      needsReviewCount > 0
        ? `${needsReviewCount} document${needsReviewCount > 1 ? "s are" : " is"} marked as needing review — follow up with your admin to clear them.`
        : "No documents are in review. Your data room is clean.",
    ];
  }

  function diligenceAdvice(): string[] {
    return [
      reviewFeedback
        ? "You have admin review feedback — respond to all notes within 24 hours to keep the review cycle moving."
        : "Check your admin review status regularly. Responding promptly to any feedback is the fastest way to move through the cycle.",
      !isPublished
        ? "Your listing is not yet published. Complete the review process to go live and start receiving investor activity."
        : "Your listing is live. Investor activity (views, saves, interests) will increase as you close remaining document and profile gaps.",
      "Upload any outstanding documents before the review cycle completes — reviewers flag incomplete data rooms and this can delay approval by a full cycle.",
    ];
  }

  type DrawerConfig = {
    title: string;
    sub: string;
    stats: { v: string; l: string }[];
    breakdown: { label: string; status: string; bg: string; color: string }[];
    meaning: string;
    advice: string[];
    href?: string;
  };

  function buildConfig(key: DrawerKey): DrawerConfig {
    switch (key) {
      case "score":
        return {
          title: "Readiness score",
          sub: readinessDetail,
          stats: [
            { v: `${readinessScore}/100`, l: "Overall score" },
            { v: `${uploadedCount}/${checklistTotal}`, l: "Docs uploaded" },
            { v: String(missingCount), l: "Missing docs" },
          ],
          breakdown: checklist.map((item) => ({
            label: item.label,
            status:
              item.status === "uploaded"
                ? "Uploaded"
                : item.status === "needs_review"
                ? "Needs review"
                : item.status === "not_applicable"
                ? "N/A"
                : "Missing",
            bg:
              item.status === "uploaded"
                ? "#EAF3DE"
                : item.status === "needs_review"
                ? "#FAEEDA"
                : item.status === "not_applicable"
                ? "#F1F5F9"
                : "#FCEBEB",
            color:
              item.status === "uploaded"
                ? "#3B6D11"
                : item.status === "needs_review"
                ? "#854F0B"
                : item.status === "not_applicable"
                ? "#64748B"
                : "#A32D2D",
          })),
          meaning:
            `A score of ${readinessScore} means ${readinessScore >= 80 ? "your profile is above the institutional benchmark — continue strengthening your data room" : `your core materials are present but key verification documents are missing. Institutional investors typically require 80+ before taking a first meeting`}.`,
          advice: scoreAdvice(),
          href: "/founder/readiness",
        };

      case "profile":
        return {
          title: "Profile completion",
          sub: `${profileComplete} of ${profileItems.length} fields complete`,
          stats: [
            { v: `${profilePercent}%`, l: "Complete" },
            { v: String(profileComplete), l: "Fields done" },
            { v: String(profileMissing), l: "Fields missing" },
          ],
          breakdown: profileItems.map((item) => ({
            label: item.label,
            status: item.complete ? "Complete" : "Missing",
            bg: item.complete ? "#EAF3DE" : "#FCEBEB",
            color: item.complete ? "#3B6D11" : "#A32D2D",
          })),
          meaning:
            profilePercent >= 100
              ? "Your profile is fully complete. Investors can see all your key information when browsing the marketplace."
              : `At ${profilePercent}%, your profile is mostly complete. The ${profileMissing} missing field${profileMissing > 1 ? "s" : ""} reduce${profileMissing === 1 ? "s" : ""} how often you appear in investor search filters.`,
          advice: profileAdvice(),
          href: "/founder/settings",
        };

      case "docs":
        return {
          title: "Documents uploaded",
          sub: `${uploadedCount} of ${checklistTotal} required documents`,
          stats: [
            { v: `${uploadedCount}/${checklistTotal}`, l: "Uploaded" },
            { v: String(missingCount), l: "Missing" },
            { v: String(needsReviewCount), l: "Needs review" },
          ],
          breakdown: checklist.map((item) => ({
            label: item.label,
            status:
              item.status === "uploaded"
                ? "Uploaded"
                : item.status === "needs_review"
                ? "Needs review"
                : item.status === "not_applicable"
                ? "N/A"
                : "Missing",
            bg:
              item.status === "uploaded"
                ? "#EAF3DE"
                : item.status === "needs_review"
                ? "#FAEEDA"
                : item.status === "not_applicable"
                ? "#F1F5F9"
                : "#FCEBEB",
            color:
              item.status === "uploaded"
                ? "#3B6D11"
                : item.status === "needs_review"
                ? "#854F0B"
                : item.status === "not_applicable"
                ? "#64748B"
                : "#A32D2D",
          })),
          meaning:
            missingCount === 0
              ? "All required documents are uploaded. Your data room is complete — keep files current as your business evolves."
              : `You have ${missingCount} missing document${missingCount > 1 ? "s" : ""}. ${missingCount > 2 ? "These are the items investors most commonly request during due diligence." : "Uploading them completes your data room."}`,
          advice: docsAdvice(),
          href: "/founder/readiness/documents",
        };

      case "diligence":
        return {
          title: "Diligence review",
          sub: isPublished ? "Published to marketplace" : "Pending admin review and publication",
          stats: [
            { v: reviewStatusFormatted, l: "Status" },
            { v: isPublished ? "Live" : "Pending", l: "Marketplace" },
            { v: reviewFeedback ? "Yes" : "None", l: "Admin notes" },
          ],
          breakdown: [
            {
              label: "Marketplace listing",
              status: isPublished ? "Published" : "Not published",
              bg: isPublished ? "#EAF3DE" : "#FCEBEB",
              color: isPublished ? "#3B6D11" : "#A32D2D",
            },
            {
              label: "Admin review",
              status: reviewStatusFormatted,
              bg:
                reviewStatusFormatted.toLowerCase().includes("approv")
                  ? "#EAF3DE"
                  : reviewStatusFormatted.toLowerCase().includes("reject")
                  ? "#FCEBEB"
                  : "#FAEEDA",
              color:
                reviewStatusFormatted.toLowerCase().includes("approv")
                  ? "#3B6D11"
                  : reviewStatusFormatted.toLowerCase().includes("reject")
                  ? "#A32D2D"
                  : "#854F0B",
            },
            {
              label: "Document coverage",
              status: missingCount === 0 ? "Complete" : `${missingCount} missing`,
              bg: missingCount === 0 ? "#EAF3DE" : "#FAEEDA",
              color: missingCount === 0 ? "#3B6D11" : "#854F0B",
            },
            {
              label: "Profile fields",
              status: profilePercent === 100 ? "Complete" : `${profilePercent}%`,
              bg: profilePercent === 100 ? "#EAF3DE" : "#EEEDFE",
              color: profilePercent === 100 ? "#3B6D11" : "#1A6CE4",
            },
          ],
          meaning:
            isPublished
              ? `Your listing is live. ${reviewStatusFormatted === "Approved" ? "The review is complete — focus on investor engagement." : "Admin review is ongoing — respond to any feedback to maintain active status."}`
              : "Your listing is not yet published. Completing the review process unlocks full investor visibility and match notifications.",
          advice: diligenceAdvice(),
          href: "/founder/readiness/diligence",
        };
    }
  }

  const config = open ? buildConfig(open) : null;

  const cards: {
    key: DrawerKey;
    label: string;
    value: string;
    detail: string;
    pct: number;
    color: string;
    href: string;
  }[] = [
    {
      key: "score",
      label: "Readiness score",
      value: `${readinessScore}/100`,
      detail: readinessDetail,
      pct: readinessScore / 100,
      color: "#2E78F5",
      href: "/founder/readiness",
    },
    {
      key: "profile",
      label: "Profile completion",
      value: `${profilePercent}%`,
      detail: `${profileComplete} of ${profileItems.length} fields complete`,
      pct: profilePercent / 100,
      color: "#7F77DD",
      href: "/founder/settings",
    },
    {
      key: "docs",
      label: "Documents uploaded",
      value: `${uploadedCount}/${checklistTotal}`,
      detail: `${missingCount} key ${missingCount === 1 ? "document" : "documents"} missing`,
      pct: checklistTotal > 0 ? uploadedCount / checklistTotal : 0,
      color: "#2E78F5",
      href: "/founder/readiness/documents",
    },
    {
      key: "diligence",
      label: "Diligence review",
      value: reviewStatusFormatted,
      detail: isPublished ? "Published to marketplace" : "Pending review",
      pct: isPublished ? 0.6 : 0.3,
      color: "#854F0B",
      href: "/founder/readiness/diligence",
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setOpen(open === card.key ? null : card.key)}
            className="group flex min-h-[8.75rem] flex-col rounded-xl border border-slate-200/80 bg-white p-5 text-left shadow-[var(--shadow-card)] transition hover:border-[#2E78F5]/50 hover:shadow-[var(--shadow-panel)]"
            aria-expanded={open === card.key}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">
              {card.label}
            </p>
            <div className="mt-2 flex flex-1 items-end justify-between gap-2">
              <div>
                <p className="font-mono text-xl font-semibold tabular-nums text-slate-950">
                  {card.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600 line-clamp-2">
                  {card.detail}
                </p>
              </div>
              <DonutChart pct={card.pct} color={card.color} />
            </div>
            <p className="mt-3 text-[10px] font-medium" style={{ color: "#2E78F5" }}>
              {open === card.key ? "Close ↑" : "Details →"}
            </p>
          </button>
        ))}
      </div>

      {/* Modal overlay */}
      {open && config ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
          role="dialog"
          aria-modal
          aria-label={config.title}
        >
          <div
            className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white"
            style={{ maxHeight: "65vh" }}
          >
            <div className="px-5 pb-6 pt-5">
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-slate-950">{config.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{config.sub}</p>
                </div>
                <div className="flex items-center gap-2">
                  {config.href ? (
                    <Link
                      href={config.href}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#2E78F5] hover:bg-[#EEEDFE]"
                      onClick={() => setOpen(null)}
                    >
                      Open page →
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                    aria-label="Close drawer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="mb-5 grid grid-cols-1 min-[360px]:grid-cols-3 gap-3">
                {config.stats.map((s) => (
                  <div
                    key={s.l}
                    className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100"
                  >
                    <p className="font-mono text-xl font-semibold text-slate-950">{s.v}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{s.l}</p>
                  </div>
                ))}
              </div>

              {/* Breakdown */}
              <p className="mb-2 text-[11px] font-semibold text-slate-950">{t("data_breakdown")}</p>
              <div className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {config.breakdown.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <span className="text-slate-800">{item.label}</span>
                    <StatusBadge label={item.status} bg={item.bg} color={item.color} />
                  </div>
                ))}
              </div>

              {/* What this means */}
              <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3">
                <p className="mb-1 text-[10px] font-semibold text-slate-950">{t("what_this_means")}</p>
                <p className="text-xs leading-[1.65] text-slate-600">{config.meaning}</p>
              </div>

              {/* AI advice box */}
              <div className="rounded-xl px-4 py-4" style={{ background: "#0c2340" }}>
                <div className="mb-3 flex items-center gap-2.5">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ background: "#2E78F5" }}
                  >
                    AI
                  </div>
                  <p className="text-xs font-semibold" style={{ color: "#EEEDFE" }}>
                    Founder intelligence
                  </p>
                </div>
                <ol className="space-y-2.5">
                  {config.advice.map((item, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-[1.6]" style={{ color: "#AFA9EC" }}>
                      <span className="shrink-0 font-semibold" style={{ color: "#7F77DD" }}>
                        {i + 1}.
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
