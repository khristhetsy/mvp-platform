"use client";

import { useState } from "react";

type InviteRole = "founder" | "investor";

export function AdminBetaOnboardingTools() {
  const [role, setRole] = useState<InviteRole>("founder");
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateInvite(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInviteUrl(null);
    setInstructions(null);

    try {
      const response = await fetch("/api/admin/beta-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          email: email.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Unable to generate invite link.");
        return;
      }
      setInviteUrl(String(payload.inviteUrl ?? ""));
      setInstructions(typeof payload.instructions === "string" ? payload.instructions : null);
    } catch {
      setError("Unable to generate invite link.");
    } finally {
      setLoading(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={generateInvite} className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Invite role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as InviteRole)}
            className="rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="founder">Founder</option>
            <option value="investor">Investor</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Email prefill (optional)</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="investor@firm.com"
            className="rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate invite link"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {instructions ? <p className="text-sm text-slate-600">{instructions}</p> : null}

      {inviteUrl ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invite URL</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-800">{inviteUrl}</p>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Copy link
          </button>
        </div>
      ) : null}

      <ul className="text-xs leading-5 text-slate-500">
        <li>Founder invites: onboarding → company profile → documents → readiness.</li>
        <li>Investor invites: onboarding → staff approval required before full marketplace access.</li>
        <li>Links are audit-logged; no credentials are sent automatically.</li>
      </ul>
    </div>
  );
}
