"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Form = { name: string; from_name: string; from_email: string; reply_to: string };

const input: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", boxSizing: "border-box" };
const label: React.CSSProperties = { fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 };

/** Step 1 of a Match campaign, inside the existing New campaign form. Creates the
 *  campaign, then continues in the Match step flow at the founder list. */
export function MatchCreateFields<F extends Form>({ form, setForm, onCancel }: { form: F; setForm: (f: F) => void; onCancel: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = Boolean(form.name.trim() && form.from_name.trim() && form.from_email.trim());

  async function next() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/marketing/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, from_name: form.from_name, from_email: form.from_email, reply_to: form.reply_to }),
      });
      const data = (await res.json()) as { campaign?: { id: string }; error?: string };
      if (!res.ok || !data.campaign) throw new Error(data.error ?? "Could not create the campaign.");
      router.push(`/admin/marketing/campaigns/match/${data.campaign.id}?step=2`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the campaign.");
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={label}>Campaign name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
        </div>
        <div>
          <label style={label}>From name</label>
          <input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} style={input} />
        </div>
        <div>
          <label style={label}>Reply to</label>
          <input type="email" value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} style={input} />
        </div>
        <div>
          <label style={label}>From email</label>
          <input type="email" value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} style={input} />
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "10px 0 0" }}>
        Match campaigns email founders only. No email goes to investors.
      </p>
      {error && <p style={{ fontSize: 12, color: "#A32D2D", margin: "8px 0 0" }}>{error}</p>}
      <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button type="button" onClick={onCancel} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>Cancel</button>
        <button type="button" onClick={() => void next()} disabled={!ready || saving}
          style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#1A6CE4", color: "#fff", cursor: "pointer", opacity: !ready || saving ? 0.5 : 1 }}>
          {saving ? "Creating…" : "Next: founder list"}
        </button>
      </div>
    </div>
  );
}
