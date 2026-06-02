"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  profileId: string;
  role: "founder" | "investor";
  companyId?: string | null;
  investorProfileId?: string | null;
  loginLink: string;
  signupLink: string;
};

export function AdminBetaSupportActions({
  profileId,
  role,
  companyId,
  investorProfileId,
  loginLink,
  signupLink,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setStatus(`${label} copied.`);
  }

  async function sendReminder() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/beta-support/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, role }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(typeof payload.error === "string" ? payload.error : "Reminder failed.");
        return;
      }
      setStatus("Onboarding reminder notification queued.");
    } catch {
      setStatus("Reminder failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copyText(loginLink, "Login link")}
        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
      >
        Copy {role} login link
      </button>
      <button
        type="button"
        onClick={() => void copyText(signupLink, "Invite link")}
        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
      >
        Copy {role} invite link
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => void sendReminder()}
        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Remind onboarding"}
      </button>
      {role === "founder" && companyId ? (
        <Link href={`/admin/companies/${companyId}`} className="text-xs font-semibold text-indigo-700 hover:underline">
          Open company
        </Link>
      ) : null}
      {role === "investor" ? (
        <Link href="/admin/investors" className="text-xs font-semibold text-indigo-700 hover:underline">
          Open investors
        </Link>
      ) : null}
      {role === "founder" && companyId ? (
        <Link href={`/admin/deal-rooms?company=${companyId}`} className="text-xs font-semibold text-indigo-700 hover:underline">
          Deal rooms
        </Link>
      ) : role === "investor" ? (
        <Link href="/admin/deal-rooms" className="text-xs font-semibold text-indigo-700 hover:underline">
          Deal rooms
        </Link>
      ) : null}
      {status ? <span className="text-xs text-slate-500">{status}</span> : null}
    </div>
  );
}
