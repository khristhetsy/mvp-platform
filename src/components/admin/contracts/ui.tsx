"use client";

import type { CSSProperties, ReactNode } from "react";
import { STATUS_LABEL, type ContractStatus } from "@/lib/contracts/types";

export const NAVY = "#0A1A40";
export const BLUE = "#2E78F5";
export const MUTED = "#5a6b87";
export const LINE = "#e2e6ed";

const PILL: Record<ContractStatus, { bg: string; fg: string }> = {
  draft: { bg: "#f1f3f7", fg: "#5a6b87" },
  sent: { bg: "#e8f0fe", fg: "#185FA5" },
  viewed: { bg: "#fff4d6", fg: "#8a6500" },
  changes_requested: { bg: "#fff4d6", fg: "#8a6500" },
  awaiting_countersign: { bg: "#EEF2FF", fg: "#4338CA" },
  signed: { bg: "#e6f6ec", fg: "#1a7f43" },
  declined: { bg: "#fdecec", fg: "#A32D2D" },
  cancelled: { bg: "#f1f3f7", fg: "#5a6b87" },
  expired: { bg: "#f1f3f7", fg: "#5a6b87" },
};

export function StatusPill({ status, archived }: { status: ContractStatus; archived?: boolean }) {
  const c = archived ? { bg: "#f1f3f7", fg: "#8a93a6" } : PILL[status] ?? PILL.draft;
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 10, whiteSpace: "nowrap" }}>
      {archived ? "Archived" : STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const btn = (primary = false, danger = false): CSSProperties => ({
  fontSize: 12.5,
  fontWeight: 600,
  padding: "7px 13px",
  borderRadius: 7,
  cursor: "pointer",
  border: primary ? "none" : "0.5px solid #d5deea",
  background: primary ? BLUE : "#fff",
  color: primary ? "#fff" : danger ? "#A32D2D" : "#3a4a63",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  textDecoration: "none",
});

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 8px", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#6a7690", textTransform: "uppercase", letterSpacing: ".06em" }}>{children}</span>
      {right ? <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{right}</span> : null}
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: "#fff", border: `0.5px solid ${LINE}`, borderRadius: 12, ...style }}>{children}</div>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const c = { info: ["#f6f9ff", "#c8d6ea", "#3a4a63"], warn: ["#fffbe9", "#e0a800", "#6a5600"], error: ["#FCEBEB", "#F3C6C6", "#A32D2D"], ok: ["#e6f6ec", "#b5e0c4", "#1a7f43"] }[tone];
  return <div style={{ background: c[0], border: `0.5px solid ${c[1]}`, color: c[2], borderRadius: 8, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.6 }}>{children}</div>;
}

/** Why Preview, PDF and Send are off for this staff member, with the link that fixes it. */
export function RenderNotice({ message, href }: { message: string | null | undefined; href: string | null | undefined }) {
  return (
    <Notice tone="warn">
      {message ?? "Contract PDFs are unavailable."} Editing and saving work now.{" "}
      {href ? <a href={href} style={{ color: "#6a5600", fontWeight: 600, textDecoration: "underline" }}>Connect Google</a> : null}
    </Notice>
  );
}

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}
