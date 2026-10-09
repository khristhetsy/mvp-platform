"use client";

/** Small shared pieces for the Accounting pages (same look as the Investor Directory pages). */
import type { ReactNode } from "react";
import { Tag } from "@/components/admin/investor-directory/ui";
import { STATUS_LABEL, STATUS_TONE, type DisplayStatus } from "@/lib/accounting/core";

export { Tag, Section, postJson } from "@/components/admin/investor-directory/ui";

export const BLUE = "#1A6CE4";
export const NAVY = "#0A1A40";

export function StatusTag({ status }: Readonly<{ status: DisplayStatus }>) {
  return <Tag tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Tag>;
}

export function Field({ label, children, hint }: Readonly<{ label: string; children: ReactNode; hint?: string }>) {
  return (
    <label className="block text-[12.5px]">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11.5px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 outline-none focus:border-[#1A6CE4]";
export const btnCls = "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const primaryCls = "inline-flex items-center gap-1.5 rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#2E78F5] disabled:opacity-50";
export const dangerCls = "inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";

/** A modal in normal page flow over a dim backdrop. */
export function Modal({ title, onClose, children, footer, width = 520 }: Readonly<{ title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }>) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex items-start justify-center bg-[rgba(10,26,64,.35)] px-4 pt-[10vh]" onClick={onClose}>
      <div className="max-h-[80vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-slate-100 px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#0A1A40]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-slate-400 hover:text-slate-700"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <div className="space-y-3 px-4 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ErrorLine({ text }: Readonly<{ text: string | null }>) {
  return text ? <p className="text-[12.5px] text-red-700">{text}</p> : null;
}

export async function api<T>(url: string, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "GET", payload?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: payload === undefined ? undefined : { "Content-Type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "Something went wrong. Try again." };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Try again." };
  }
}
