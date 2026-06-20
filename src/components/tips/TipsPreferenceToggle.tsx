"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";

/**
 * Settings toggle for the Tip of the Day. Reads the current preference and lets
 * the user turn daily tips on or off — the only way to re-enable after dismissing
 * them from the tip card.
 */
export function TipsPreferenceToggle() {
  const [showTips, setShowTips] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/preferences/tips");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setShowTips(data.showTips !== false);
      } catch {
        if (active) setShowTips(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function toggle() {
    if (showTips === null || saving) return;
    const next = !showTips;
    setSaving(true);
    setShowTips(next); // optimistic
    try {
      const res = await fetch("/api/preferences/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: next ? "enable" : "disable" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setShowTips(!next); // revert
    } finally {
      setSaving(false);
    }
  }

  const on = showTips === true;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 h-5 w-5 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-950">Daily tips</p>
          <p className="text-xs text-slate-500">Show a Tip of the Day on your dashboard.</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Toggle daily tips"
        disabled={showTips === null || saving}
        onClick={() => void toggle()}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[#534AB7]" : "bg-slate-300"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
