"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PURPLE = "#534AB7";

type PageRow = {
  id: string; slug: string; status: "draft" | "in_review" | "published";
  h1: string; complianceStatus: "unreviewed" | "cleared" | "flagged"; publishedAt?: string;
};
type Blocker = { id: string; label: string; detail: string; resolved: boolean };

const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" };
const STATUS_STYLE: Record<string, { bg: string; c: string }> = {
  published: { bg: "#E1F5EE", c: "#0F6E56" },
  in_review: { bg: "#E6F1FB", c: "#185FA5" },
  draft: { bg: "#F1EFE8", c: "#5F5E5A" },
};
const COMP_STYLE: Record<string, { bg: string; c: string; label: string }> = {
  cleared: { bg: "#E1F5EE", c: "#0F6E56", label: "Cleared" },
  flagged: { bg: "#FCEBEB", c: "#A32D2D", label: "Flagged" },
  unreviewed: { bg: "#F1EFE8", c: "#5F5E5A", label: "Unreviewed" },
};

export function AeoListClient() {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [exposureOk, setExposureOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newH1, setNewH1] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        fetch("/api/aeo/pages").then((r) => r.json()),
        fetch("/api/aeo/settings").then((r) => r.json()),
      ]);
      setPages(p.pages ?? []);
      setBlockers(s.exposure?.blockers ?? []);
      setExposureOk(!!s.exposure?.ok);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const toggleBlocker = async (id: string, resolved: boolean) => {
    const key = id === "deal_names" ? "deal_names_masked" : "security_page_noindexed";
    const res = await fetch("/api/aeo/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: resolved }),
    });
    const d = await res.json();
    if (res.ok) { setBlockers(d.exposure?.blockers ?? []); setExposureOk(!!d.exposure?.ok); }
  };

  const create = async () => {
    setCreating(true); setMsg(null);
    try {
      const res = await fetch("/api/aeo/pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug.trim(), h1: newH1.trim() || "Untitled" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Create failed.");
      router.push(`/admin/marketing/aeo/${d.page.id}/edit`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Exposure gate */}
      <div style={{ ...card, borderColor: exposureOk ? "#BEE7D6" : "#EDD3A6", background: exposureOk ? "#F1FAF6" : "#FBF4E6", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: exposureOk ? "#0F6E56" : "#854F0B" }}>
            {exposureOk ? "Exposure gate: clear" : "Exposure gate: blocking publish"}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#5f5e5a", margin: "0 0 12px" }}>
          Publishing is blocked until both fix-first exposures are confirmed resolved. Crawlers cache what they find — resolve these before driving traffic.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {blockers.map((b) => (
            <label key={b.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={b.resolved} onChange={(e) => void toggleBlocker(b.id, e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "#0f2147" }}>{b.label}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#7a8494" }}>{b.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Create */}
      <div style={{ ...card, padding: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#0f2147", margin: "0 0 10px" }}>{t("new_pillar_page")}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder={t("slug_e_g_capital_readiness_rating")}
            style={{ flex: "1 1 240px", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid #d7dce4" }} />
          <input value={newH1} onChange={(e) => setNewH1(e.target.value)} placeholder={t("h1_title")}
            style={{ flex: "1 1 240px", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid #d7dce4" }} />
          <button type="button" onClick={() => void create()} disabled={creating || !newSlug.trim()}
            style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: creating ? "default" : "pointer", opacity: !newSlug.trim() ? 0.5 : 1 }}>
            {creating ? "Creating…" : "Create draft"}
          </button>
        </div>
        {msg ? <p style={{ fontSize: 12, color: "#A32D2D", margin: "8px 0 0" }}>{msg}</p> : null}
      </div>

      {/* List */}
      <div style={{ ...card, overflow: "hidden" }}>
        {loading ? (
          <p style={{ fontSize: 13, color: "#5f5e5a", padding: 20 }}>{t("loading_2")}</p>
        ) : pages.length === 0 ? (
          <p style={{ fontSize: 13, color: "#5f5e5a", padding: 20 }}>{t("no_pages_yet_create_your_first_pillar_page_a")}</p>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#7a8494", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 14px", fontWeight: 600 }}>Page</th>
                <th style={{ padding: "10px 14px", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "10px 14px", fontWeight: 600 }}>Compliance</th>
                <th style={{ padding: "10px 14px", fontWeight: 600 }}>Published</th>
                <th style={{ padding: "10px 14px", fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.draft;
                const cs = COMP_STYLE[p.complianceStatus] ?? COMP_STYLE.unreviewed;
                return (
                  <tr key={p.id} style={{ borderTop: "0.5px solid #f2f4f7" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontWeight: 500, color: "#0f2147" }}>{p.h1}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "#7a8494" }}>/learn/{p.slug}</span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ background: st.bg, color: st.c, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>{p.status}</span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ background: cs.bg, color: cs.c, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>{cs.label}</span>
                    </td>
                    <td style={{ padding: "11px 14px", color: "#5f5e5a" }}>{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—"}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link href={`/admin/marketing/aeo/${p.id}/edit`} style={{ color: PURPLE, fontWeight: 500, marginRight: 12, textDecoration: "none" }}>Edit</Link>
                      <Link href={`/admin/marketing/aeo/${p.id}/preview`} style={{ color: "#5f5e5a", fontWeight: 500, textDecoration: "none" }}>Preview</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
