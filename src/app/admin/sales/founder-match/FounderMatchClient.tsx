"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type MatchInvestor = { id: string; name: string; company: string | null };
export type FounderRow = {
  id: string;
  name: string;
  industry: string | null;
  revenueStage: string | null;
  fundingAmount: number | null;
  score: number;
  reasons: string[];
};

function money(n: number | null): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}
function scoreColor(s: number): string {
  return s >= 75 ? "#0F6E56" : s >= 50 ? "#BA7517" : "#993C1D";
}

export function FounderMatchClient({
  investors,
  selectedId,
  rows,
}: {
  investors: MatchInvestor[];
  selectedId: string | null;
  rows: FounderRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.industry ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div style={{ padding: "8px 4px" }}>
      <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".07em", color: "#4338CA", textTransform: "uppercase", margin: 0 }}>
        Admin · Founders
      </p>
      <h1 style={{ fontSize: 20, fontWeight: 500, color: "#0c2340", margin: "3px 0 4px" }}>Founder search &amp; match</h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px", maxWidth: 640, lineHeight: 1.5 }}>
        Pick an investor to rank founder companies by fit to that investor&apos;s structured preferences (check size,
        use of funds, stage).
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select
          value={selectedId ?? ""}
          onChange={(e) => router.push(e.target.value ? `?investor=${e.target.value}` : "?")}
          style={{ minWidth: 260, border: "0.5px solid var(--border, #d7dbe3)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "#fff" }}
        >
          <option value="">Match from an investor…</option>
          {investors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {i.company ? ` · ${i.company}` : ""}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies, sector…"
          style={{ flex: 1, minWidth: 200, border: "0.5px solid var(--border, #d7dbe3)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "#fff" }}
        />
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "24px 0" }}>
          {selectedId ? "No companies to rank." : "Pick an investor above to rank founder companies by fit."}
        </p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
            <b style={{ color: "var(--foreground)" }}>{filtered.length}</b> companies · sorted by fit
          </p>
          {filtered.map((r) => (
            <div key={r.id} style={{ border: "0.5px solid #eef1f5", borderRadius: 12, background: "#fff", padding: "13px 15px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: "#EEEDFE", color: "#3C3489", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                  {r.name.slice(0, 2).toUpperCase()}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#0c2340", margin: 0 }}>{r.name}</p>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "1px 0 0" }}>
                    {[r.industry, r.revenueStage, `Raise ${money(r.fundingAmount)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: scoreColor(r.score), lineHeight: 1 }}>{r.score}%</div>
                  <div style={{ fontSize: 9, textTransform: "uppercase", color: "var(--muted-foreground)" }}>fit</div>
                </div>
              </div>
              {r.reasons.length ? (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 }}>
                  {r.reasons.map((v) => (
                    <span key={v} style={{ fontSize: 11, borderRadius: 6, padding: "3px 8px", background: "#E1F5EE", color: "#0F6E56" }}>
                      {v}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
