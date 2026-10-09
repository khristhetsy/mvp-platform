"use client";

/** Small shared pieces for the Investor Directory admin pages. */
import type { ReactNode } from "react";
import { useVocabulary } from "@/lib/vocabulary/provider";
import type { VocabularyList } from "@/lib/vocabulary/lists";
import type { Tone } from "@/lib/investor-directory/format";

export const BLUE = "#1A6CE4";
export const STEEL = "#185FA5";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: "#EAF3DE", fg: "#27500A" },
  warn: { bg: "#FAEEDA", fg: "#633806" },
  bad: { bg: "#FCEBEB", fg: "#791F1F" },
  info: { bg: "#E6F1FB", fg: "#0C447C" },
  pro: { bg: "#EEEDFE", fg: "#3C3489" },
  mute: { bg: "#F1F5F9", fg: "#475569" },
};
export type { Tone } from "@/lib/investor-directory/format";

export function Tag({ tone = "mute", children }: Readonly<{ tone?: Tone; children: ReactNode }>) {
  const t = TONES[tone];
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: t.bg, color: t.fg, whiteSpace: "nowrap", fontWeight: 500 }}>
      {children}
    </span>
  );
}

export function Section({ title, icon, action, children }: Readonly<{ title: string; icon?: string; action?: ReactNode; children: ReactNode }>) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        {icon ? <i className={`ti ${icon} text-slate-500`} aria-hidden="true" /> : null}
        <h2 className="text-[13.5px] font-semibold text-slate-800">{title}</h2>
        {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export const verificationTone: Record<string, Tone> = {
  verified: "ok", unverified: "mute", needs_input: "warn", bounced: "bad", opt_out: "bad",
};
export const verificationLabel: Record<string, string> = {
  verified: "Verified", unverified: "Unverified", needs_input: "Needs input", bounced: "Bounced", opt_out: "Opt-out",
};
export const statusTone: Record<string, Tone> = { published: "ok", draft: "info", suppressed: "bad" };
export const statusLabel: Record<string, string> = { published: "Published", draft: "Draft", suppressed: "Suppressed" };

export { fmtPT, money } from "@/lib/investor-directory/format";

/** Labels for stored option slugs, from the shared vocabulary lists. */
export function OptionLabels({ list, values, empty = "—" }: Readonly<{ list: VocabularyList; values: string[]; empty?: string }>) {
  const { label } = useVocabulary(list, values);
  if (values.length === 0) return <span className="text-slate-400">{empty}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {values.map((v) => (
        <span key={v} className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700">{label(v)}</span>
      ))}
    </span>
  );
}

/** Toggle chips over one vocabulary list. */
export function OptionPicker({ list, values, onChange }: Readonly<{ list: VocabularyList; values: string[]; onChange: (next: string[]) => void }>) {
  const { options } = useVocabulary(list, values);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = values.includes(o.slug);
        return (
          <button
            key={o.slug}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onChange(on ? values.filter((v) => v !== o.slug) : [...values, o.slug])}
            className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${on ? "border-[#378ADD] bg-[#E6F1FB] text-[#0C447C]" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export async function postJson<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "Something went wrong. Try again." };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Try again." };
  }
}
