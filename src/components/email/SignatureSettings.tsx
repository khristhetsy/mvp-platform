"use client";

import { useEffect, useState } from "react";
import { PenLine, Check } from "lucide-react";

/**
 * Settings field for the email signature, auto-appended to outgoing inbox mail.
 */
export function SignatureSettings() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/preferences/signature");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setValue(data.signature ?? "");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/preferences/signature", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: value }),
      });
      if (!res.ok) throw new Error("Save failed.");
      setMsg("Signature saved.");
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setMsg("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="mb-2 flex items-center gap-2">
        <PenLine className="h-5 w-5 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-950">Email signature</p>
          <p className="text-xs text-slate-500">Appended to messages you send from the inbox.</p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            placeholder={"Khris Thetsy\nFounder, CapitalOS\nkhris@capitalos.io"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save signature"}
            </button>
            {msg ? <span className={`text-xs ${msg.includes("saved") ? "text-emerald-700" : "text-red-700"}`}>{msg}</span> : null}
          </div>
        </>
      )}
    </div>
  );
}
