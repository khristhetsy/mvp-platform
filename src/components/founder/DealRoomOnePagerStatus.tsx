"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { founderOnePagerPath } from "@/lib/listing/one-pager-link";

/**
 * Says plainly whether the founder's one pager is live, at the top of Deal rooms.
 * Publishing and unpublishing use the same endpoint as the profile settings card.
 */
export function DealRoomOnePagerStatus({
  isPublished,
  slug,
  publishedAt,
}: {
  isPublished: boolean;
  slug: string | null;
  publishedAt: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(action: "publish" | "unpublish") {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/one-pager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok || json?.error) {
        setError(json?.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const since = publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${isPublished ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${isPublished ? "bg-emerald-600" : "bg-amber-500"}`}
        >
          {isPublished ? "✓" : "!"}
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isPublished ? "text-emerald-900" : "text-amber-900"}`}>
            {isPublished ? "Your one pager is published" : "Your one pager is not published"}
          </p>
          <p className={`mt-0.5 text-xs ${isPublished ? "text-emerald-700" : "text-amber-700"}`}>
            {isPublished
              ? since
                ? `Visible to verified investors since ${since}.`
                : "Visible to verified investors."
              : "Investors cannot find your company yet. Publish it to receive interest and invite investors."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {isPublished ? (
          <>
            {slug ? (
              <Link href={founderOnePagerPath(slug)} className="text-xs font-semibold text-indigo-700 hover:underline">
                View one pager
              </Link>
            ) : null}
            <Link href="/founder/settings" className="text-xs font-semibold text-indigo-700 hover:underline">
              Edit
            </Link>
            <button
              type="button"
              onClick={() => change("unpublish")}
              disabled={loading}
              className="text-xs font-medium text-slate-500 hover:underline disabled:opacity-50"
            >
              {loading ? "Working..." : "Unpublish"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => change("publish")}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Publishing..." : "Publish your one pager"}
            </button>
            <Link href="/founder/preview" className="text-xs font-semibold text-indigo-700 hover:underline">
              Preview one pager
            </Link>
          </>
        )}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-700">
          {error}{" "}
          <Link href="/founder/settings" className="font-semibold underline">
            Open profile settings
          </Link>
        </p>
      ) : null}
    </div>
  );
}
