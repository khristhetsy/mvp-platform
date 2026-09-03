import type { ReactNode } from "react";

// Option-1 section header used across the company workspace: a Tabler icon + title
// + one-line hint, with a color-coded underline per tone so staff can scan the page
// by group ("At a glance", "Do next", …). Same layout contract as PageSection.

type Tone = "blue" | "purple" | "amber" | "gray" | "red" | "teal" | "green";

const TONES: Record<Tone, { icon: string; line: string }> = {
  blue: { icon: "#185FA5", line: "#B5D4F4" },
  purple: { icon: "#534AB7", line: "#CECBF6" },
  amber: { icon: "#BA7517", line: "#FAC775" },
  gray: { icon: "#5F5E5A", line: "#D3D1C7" },
  red: { icon: "#A32D2D", line: "#F0C7C7" },
  teal: { icon: "#0F6E56", line: "#9FE1CB" },
  green: { icon: "#3B6D11", line: "#C0DD97" },
};

export function WorkspaceSection({
  icon,
  tone = "blue",
  title,
  subtitle,
  action,
  children,
  className = "",
}: Readonly<{
  icon: string;
  tone?: Tone;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  const c = TONES[tone];
  return (
    <section className={`space-y-4 ${className}`}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 pb-2" style={{ borderColor: c.line }}>
        <div className="flex min-w-0 items-center gap-2.5">
          <i className={`ti ${icon} text-[18px]`} style={{ color: c.icon }} aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
