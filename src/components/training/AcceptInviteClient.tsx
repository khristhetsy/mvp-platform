"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/training/staff/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (r.ok) { router.push("/training/staff"); return; }
    setErr(j.error ?? "Could not accept the invitation."); setBusy(false);
  }
  return (
    <div>
      <button type="button" onClick={accept} disabled={busy} className="rounded-lg bg-[#1A6CE4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50">Accept invitation</button>
      {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
