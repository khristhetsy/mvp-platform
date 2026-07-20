"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveListing, rejectListing } from "@/app/admin/marketplace/actions";

export type ReviewListing = {
  id: string;
  companyName: string;
  briefDescription: string;
  industry: string | null;
  location: string | null;
  securityType: string | null;
  portalName: string;
  portalUrl: string;
  portalFlagged: boolean;
  createdAt: string;
};

export function ListingReviewRow({ listing }: Readonly<{ listing: ReviewListing }>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<null | "approved" | "rejected">(null);
  const [pending, startTransition] = useTransition();

  function act(kind: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      const res = kind === "approve" ? await approveListing(listing.id) : await rejectListing(listing.id);
      if (res.ok) {
        setResolved(kind === "approve" ? "approved" : "rejected");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (resolved) {
    return (
      <div className={`rounded-xl border px-4 py-3 text-sm ${resolved === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
        {listing.companyName} — {resolved === "approved" ? "published to marketplace" : "rejected"}.
      </div>
    );
  }

  const meta = [listing.industry, listing.location, listing.securityType].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{listing.companyName}</p>
          {meta ? <p className="text-xs text-slate-500">{meta}</p> : null}
        </div>
        {listing.portalFlagged ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Portal not on allowlist</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-slate-700">{listing.briefDescription}</p>
      <p className="mt-2 text-xs text-slate-500">
        Portal: <span className="font-medium text-slate-700">{listing.portalName}</span> ·{" "}
        <span className="break-all font-mono text-[11px]">{listing.portalUrl}</span>
      </p>

      {error ? <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("approve")}
          className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Approve &amp; publish
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("reject")}
          className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
