"use client";

// Operations Hub — onboarding + due-diligence completion at a glance.
// Every card, funnel segment, and queue row is a link into the real data so
// nothing falls through the cracks. Server component loads the numbers.

import Link from "next/link";

export type Tile = { label: string; value: number; sub: string; href: string; bg: string; accent: string; text: string; icon: string };
export type FunnelSeg = { label: string; value: number; href: string; color: string; textColor: string; widthPct: number };
export type QueueRow = { id: string; title: string; subtitle: string; href: string; percent?: number; badge?: { text: string; color: string; bg: string; border: string } };

interface Props {
  tiles: Tile[];
  funnel: FunnelSeg[];
  onboardingQueue: QueueRow[];
  onboardingRemaining: number;
  diligenceQueue: QueueRow[];
  diligenceRemaining: number;
}

function lift(e: React.MouseEvent<HTMLElement>, on: boolean) {
  const el = e.currentTarget as HTMLElement;
  el.style.boxShadow = on ? "0 4px 16px rgb(12 35 64 / 0.10)" : "none";
  el.style.transform = on ? "translateY(-1px)" : "none";
}

export function OperationsHubClient({ tiles, funnel, onboardingQueue, onboardingRemaining, diligenceQueue, diligenceRemaining }: Props) {
  return (
    <div>
      {/* Clickable KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}
            onMouseEnter={(e) => lift(e, true)} onMouseLeave={(e) => lift(e, false)}
            style={{ display: "block", background: t.bg, borderRadius: 14, padding: 16, textDecoration: "none", border: "1.5px solid transparent", transition: "box-shadow .15s, transform .1s" }}>
            <div style={{ fontSize: 20, color: t.accent, lineHeight: 1 }}><i className={`ti ${t.icon}`} aria-hidden="true" /></div>
            <div style={{ fontSize: 28, fontWeight: 500, color: t.text, marginTop: 8 }}>{t.value.toLocaleString()}</div>
            <div style={{ fontSize: 11.5, color: t.accent, marginTop: 2 }}>{t.label}</div>
            <div style={{ fontSize: 10.5, color: t.accent, opacity: 0.8, marginTop: 6 }}>{t.sub} →</div>
          </Link>
        ))}
      </div>

      {/* Clickable lifecycle funnel */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 14 }}>Onboarding → diligence funnel</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {funnel.map((f) => (
            <Link key={f.label} href={f.href} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
              <span style={{ width: 92, fontSize: 11.5, color: "var(--muted-foreground)", textAlign: "right", flexShrink: 0 }}>{f.label}</span>
              <div style={{ flex: 1, height: 28, background: "var(--muted)", borderRadius: 7, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(f.widthPct, 6)}%`, background: f.color, borderRadius: 7, display: "flex", alignItems: "center", paddingLeft: 12, fontSize: 12.5, fontWeight: 500, color: f.textColor }}>{f.value.toLocaleString()}</div>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 10 }}>Click any bar to open that stage.</div>
      </div>

      {/* Needs-attention queues — nothing falls through */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <QueuePanel title="Finish onboarding" accent="#185FA5" rows={onboardingQueue} remaining={onboardingRemaining} emptyText="All founders have completed onboarding." allHref="/admin/companies" />
        <QueuePanel title="Diligence needing action" accent="#854F0B" rows={diligenceQueue} remaining={diligenceRemaining} emptyText="No open diligence tasks." allHref="/admin/diligence" />
      </div>
    </div>
  );
}

function QueuePanel({ title, accent, rows, remaining, emptyText, allHref }: { title: string; accent: string; rows: QueueRow[]; remaining: number; emptyText: string; allHref: string }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", borderBottom: "0.5px solid #e2e6ed", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</span>
        {remaining > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, background: "var(--muted)", borderRadius: 20, padding: "1px 8px" }}>{remaining}</span>}
        <Link href={allHref} style={{ marginLeft: "auto", fontSize: 11, color: "#185FA5", textDecoration: "none" }}>View all →</Link>
      </div>
      {rows.length === 0 ? (
        <p style={{ padding: "20px 14px", fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>{emptyText}</p>
      ) : rows.map((r) => (
        <Link key={r.id} href={r.href}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "0.5px solid #eef1f5", textDecoration: "none" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F9FF"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subtitle}</div>
          </div>
          {typeof r.percent === "number" && (
            <div style={{ width: 60, flexShrink: 0 }}>
              <div style={{ height: 5, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${r.percent}%`, background: r.percent >= 90 ? "#0F6E56" : "#2E78F5" }} /></div>
              <div style={{ fontSize: 9.5, color: "var(--muted-foreground)", marginTop: 2, textAlign: "right" }}>{r.percent}%</div>
            </div>
          )}
          {r.badge && <span style={{ fontSize: 10, fontWeight: 600, color: r.badge.color, background: r.badge.bg, border: `0.5px solid ${r.badge.border}`, borderRadius: 6, padding: "2px 7px", flexShrink: 0, whiteSpace: "nowrap" }}>{r.badge.text}</span>}
          <span style={{ color: "var(--muted-foreground)", fontSize: 13, flexShrink: 0 }}>›</span>
        </Link>
      ))}
    </div>
  );
}
