"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type MatchCompany = { id: string; name: string; industry: string | null };
export type MatchRow = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  score: number | null;
  reasons: string[];
  investmentSize: string[];
  useOfFunds: string[];
  dealsPerYear: string | null;
  revenueRange: string[];
  activeRating: string | null;
};

function scoreColor(score: number): string {
  if (score >= 75) return "#0F6E56";
  if (score >= 50) return "#BA7517";
  return "#993C1D";
}

export function InvestorMatchClient({
  companies,
  selectedId,
  rows,
  flatFields = [],
}: {
  companies: MatchCompany[];
  selectedId: string | null;
  rows: MatchRow[];
  flatFields?: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q) ||
        r.investmentSize.join(" ").toLowerCase().includes(q) ||
        r.useOfFunds.join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div style={{ padding: "8px 4px" }}>
      <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".07em", color: "#4338CA", textTransform: "uppercase", margin: 0 }}>
        Admin · Investors
      </p>
      <h1 style={{ fontSize: 20, fontWeight: 500, color: "#0c2340", margin: "3px 0 4px" }}>Investor search &amp; match</h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px", maxWidth: 640, lineHeight: 1.5 }}>
        Every investor contact carries structured preferences (investment size, use of funds, deals/year, revenue &amp;
        EBITDA ranges, active rating). Pick a company to rank investors by fit, or search across the directory.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select
          value={selectedId ?? ""}
          onChange={(e) => router.push(e.target.value ? `?company=${e.target.value}` : "?")}
          style={{ minWidth: 240, border: "0.5px solid var(--border, #d7dbe3)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "#fff" }}
        >
          <option value="">Match to a company…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.industry ? ` · ${c.industry}` : ""}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search investors, firm, preference…"
          style={{ flex: 1, minWidth: 200, border: "0.5px solid var(--border, #d7dbe3)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "#fff" }}
        />
      </div>

      {flatFields.length > 0 ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FAEEDA", border: "0.5px solid #EF9F27", borderRadius: 8, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "#633806", lineHeight: 1.5 }}>
          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ marginTop: 1 }} />
          <span>
            <b>{flatFields.length} field{flatFields.length === 1 ? "" : "s"} ignored for scoring</b> — identical across
            every investor, so {flatFields.length === 1 ? "it carries" : "they carry"} no signal (likely need cleanup in
            Odoo): {flatFields.join(", ")}. Matches use only fields that actually differ between investors.
          </span>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "24px 0" }}>
          {selectedId
            ? "No investor contacts with structured preferences to rank yet."
            : "Pick a company above to rank your investor contacts by fit."}
        </p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
            <b style={{ color: "var(--foreground)" }}>{filtered.length}</b> investors
            {selectedId ? " · sorted by fit" : ""}
          </p>
          {filtered.map((r) => (
            <div key={r.id} style={{ border: "0.5px solid #eef1f5", borderRadius: 12, background: "#fff", padding: "13px 15px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#EEEDFE", color: "#3C3489", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                  {r.name.slice(0, 2).toUpperCase()}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={`/admin/sales/contacts/${r.id}`} style={{ fontSize: 14, fontWeight: 500, color: "#0c2340", textDecoration: "none" }}>
                    {r.name}
                  </Link>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "1px 0 0" }}>{r.company ?? r.email ?? ""}</p>
                </div>
                {r.score != null ? (
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 600, color: scoreColor(r.score), lineHeight: 1 }}>{r.score}%</div>
                    <div style={{ fontSize: 9, textTransform: "uppercase", color: "var(--muted-foreground)" }}>match</div>
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 }}>
                {r.activeRating ? <Tag>{r.activeRating}</Tag> : null}
                {r.investmentSize.map((v) => (
                  <Tag key={`s${v}`} hit={r.reasons.includes("Check size fits the raise")}>{v}</Tag>
                ))}
                {r.useOfFunds.map((v) => (
                  <Tag key={`u${v}`} hit={r.reasons.includes("Use-of-funds / stage fit")}>{v}</Tag>
                ))}
                {r.dealsPerYear ? <Tag>{r.dealsPerYear}</Tag> : null}
                {r.revenueRange.map((v) => (
                  <Tag key={`r${v}`} hit={r.reasons.includes("Revenue band matches")}>Rev {v}</Tag>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Tag({ children, hit }: { children: React.ReactNode; hit?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        borderRadius: 6,
        padding: "3px 8px",
        background: hit ? "#E1F5EE" : "#F1EFE8",
        color: hit ? "#0F6E56" : "#5F5E5A",
      }}
    >
      {children}
    </span>
  );
}
