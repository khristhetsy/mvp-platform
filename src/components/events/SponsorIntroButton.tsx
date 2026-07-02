"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function SponsorIntroButton({
  sponsorId,
  sponsorName,
  isAuthenticated,
}: {
  sponsorId: string;
  sponsorName: string;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("eventsCmp");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <Link
        href={`/auth/sign-in?next=/events/sponsors/${sponsorId}`}
        className="cap-btn-primary inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
      >
        Sign in to request an intro
      </Link>
    );
  }

  if (done) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
        ✓ Intro requested — our team will follow up
      </span>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/sponsors/${sponsorId}/intro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not request intro.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request intro.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="cap-btn-primary inline-flex items-center rounded-md px-4 py-2 text-sm font-medium">
        Request an intro
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Opt in to an introduction with <span className="font-medium text-[var(--navy)]">{sponsorName}</span>. We&apos;ll
        share your interest with them — no details until you both agree.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={t("optional_a_line_about_what_you_re_looking_fo")}
        className="mt-2 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
      />
      {error && <p className="mt-1 text-sm text-rose-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button onClick={submit} disabled={busy} className="cap-btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          {busy ? "Sending…" : "Send request"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)]">
          Cancel
        </button>
      </div>
    </div>
  );
}
