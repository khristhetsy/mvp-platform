"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = { prompt: string; cited: boolean; position: number | null; provider: string };
type Vis = { connected: boolean; provider: string; fetchedAt: string | null; rows: Row[]; shareOfVoice: number | null; note?: string };

const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)", padding: 20 };

export function VisibilityClient() {
  const t = useTranslations("sharedCmp");
  const [data, setData] = useState<Vis | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/aeo/visibility");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (loading) return <p style={{ fontSize: 13, color: "#5f5e5a" }}>{t("loading_2")}</p>;
  if (!data) return null;

  if (!data.connected || data.rows.length === 0) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#0f2147", margin: "0 0 6px" }}>
          {data.connected ? "No cached results yet" : "No visibility provider connected"}
        </p>
        <p style={{ fontSize: 12.5, color: "#5f5e5a", margin: 0, maxWidth: 520, marginInline: "auto" }}>
          {data.note ?? "Connect Frase or Peec to see the Answer Grid and share-of-voice across tracked prompts."}
        </p>
        <p style={{ fontSize: 11, color: "#9aa3b0", margin: "10px 0 0" }}>
          Measurement is a read-only view over a third-party API — no data is shown until a provider is connected.
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f2147" }}>Answer Grid · {data.provider}</span>
        {data.shareOfVoice != null ? <span style={{ fontSize: 12, color: "#2E78F5", fontWeight: 600 }}>Share of voice {Math.round(data.shareOfVoice * 100)}%</span> : null}
      </div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "0.5px solid #f2f4f7" }}>
              <td style={{ padding: "10px 16px", color: "#0f2147" }}>{r.prompt}</td>
              <td style={{ padding: "10px 16px", color: r.cited ? "#0F6E56" : "#9aa3b0" }}>{r.cited ? "Cited" : "Not cited"}</td>
              <td style={{ padding: "10px 16px", color: "#5f5e5a" }}>{r.position ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
