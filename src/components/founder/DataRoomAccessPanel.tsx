"use client";

import { useEffect, useState } from "react";

type Grant = {
  id: string;
  investorId: string;
  scope: string;
  expiresAt: string | null;
  revokedAt: string | null;
  investorName: string | null;
  investorEmail: string | null;
  active: boolean;
};

function statusLabel(g: Grant): string {
  if (g.revokedAt) return "Revoked";
  if (!g.active) return "Expired";
  if (g.expiresAt) {
    const days = Math.max(0, Math.ceil((new Date(g.expiresAt).getTime() - Date.now()) / 86_400_000));
    return `Active · expires in ${days} day${days === 1 ? "" : "s"}`;
  }
  return "Active · no expiry";
}

export function DataRoomAccessPanel() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [email, setEmail] = useState("");
  const [expiry, setExpiry] = useState("30");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/founder/data-room/access")
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data?.grants)) setGrants(data.grants as Grant[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function grant() {
    if (!email.trim() || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/data-room/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), expiresInDays: expiry === "0" ? null : Number(expiry) }),
      });
      const data = (await res.json().catch(() => null)) as { grants?: Grant[]; error?: string } | null;
      if (!res.ok) {
        setMessage(data?.error ?? "Could not grant access.");
        return;
      }
      setEmail("");
      setMessage("Access granted.");
      if (Array.isArray(data?.grants)) setGrants(data.grants);
    } finally {
      setLoading(false);
    }
  }

  async function revoke(investorId: string) {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/data-room/access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorId }),
      });
      const data = (await res.json().catch(() => null)) as { grants?: Grant[] } | null;
      if (res.ok && Array.isArray(data?.grants)) setGrants(data.grants);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      <h2 className="text-base font-semibold text-slate-950">Investor access</h2>
      <p className="mt-1 text-sm text-slate-600">
        Grant a specific investor access to your data room. Access is optional-expiry and you can revoke it anytime.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="investor@email.com"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="0">No expiry</option>
        </select>
        <button
          type="button"
          onClick={grant}
          disabled={loading || !email.trim()}
          className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Working…" : "Grant access"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}

      <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
        {grants.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">No investors have been granted access yet.</p>
        ) : (
          grants.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{g.investorName ?? g.investorEmail ?? "Investor"}</p>
                <p className="truncate text-xs text-slate-500">{statusLabel(g)}</p>
              </div>
              {g.active ? (
                <button
                  type="button"
                  onClick={() => revoke(g.investorId)}
                  disabled={loading}
                  className="flex-none rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Revoke
                </button>
              ) : (
                <span className="flex-none text-xs text-slate-400">—</span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
