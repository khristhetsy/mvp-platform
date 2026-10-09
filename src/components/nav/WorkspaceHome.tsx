"use client";

/**
 * A workspace home page that is the app grid itself (admin: /admin/home). Same tiles and
 * permission gating as the top menu launcher; a tile opens that hub. The look is one of
 * the 10 approved Home styles, chosen company-wide by a super admin (gear on the top bar).
 */
import { createElement, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import type { WorkspaceId } from "@/lib/workspace-nav";
import type { TopMenuApp } from "@/lib/nav/top-menu";
import { DEFAULT_ADMIN_HOME } from "@/lib/settings/admin-home-shape";
import { useAdminHomeSettings } from "@/lib/ui/admin-home-settings";
import { rememberApp, tileColor, tileIcon, useTopMenuApps } from "@/components/nav/TopMenuBar";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";

/** One line per hub for the "Cards with descriptions" style. */
const DESCRIPTIONS: Record<string, string> = {
  "/admin": "Company overview",
  "/admin/contacts": "Everyone, one list",
  "/admin/sales/contacts": "Everyone, one list",
  "/admin/ceo": "Leadership view",
  "/admin/sales": "Pipeline and deals",
  "/admin/marketing": "Campaigns and lists",
  "/admin/ir": "Projects and matching",
  "/admin/investor-directory": "Public investor data",
  "/admin/social": "Posts and accounts",
  "/admin/events": "Events and sponsors",
  "/admin/voice": "AI calling",
  "/admin/inbox": "Inbox and calendar",
  "/admin/actions": "Funnels, CRM, deals",
  "/admin/companies": "Support queue",
  "/admin/learning": "Courses",
  "/admin/manual": "How we work",
  "/admin/users/manage": "Users and billing",
  "/admin/integrations": "Integrations",
};

/** Groups for the "Grouped by work" style; hubs not listed go under "More". */
const GROUPS: Array<{ label: string; hrefs: string[] }> = [
  { label: "Raise", hrefs: ["/admin", "/admin/ceo", "/admin/ir", "/admin/investor-directory", "/admin/contacts"] },
  { label: "Grow", hrefs: ["/admin/sales", "/admin/marketing", "/admin/social", "/admin/events", "/admin/voice"] },
  { label: "Operate", hrefs: ["/admin/inbox", "/admin/actions", "/admin/companies", "/admin/learning", "/admin/manual"] },
  { label: "Admin", hrefs: ["/admin/users/manage", "/admin/integrations"] },
];

type Tone = "light" | "onBlue" | "dark" | "mono";

/** The hub's tile icon (or a lock while the app is locked). */
function AppIcon({ app, className }: Readonly<{ app: TopMenuApp; className: string }>) {
  return createElement(app.locked ? Lock : tileIcon(app), { className, strokeWidth: 1.75, "aria-hidden": true });
}

// Greeting from the Pacific time clock; the server render says "Welcome".
const noSubscribe = () => () => {};
function greetingNow(): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: PLATFORM_TZ }).format(new Date())) % 24;
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function useGreeting(): string {
  return useSyncExternalStore(noSubscribe, greetingNow, () => "Welcome");
}

function Tile({ app, index, tone, round, label, onPick }: Readonly<{
  app: TopMenuApp; index: number; tone: Tone; round?: boolean; label: string; onPick: (a: TopMenuApp) => void;
}>) {
  const [bg, fg] =
    tone === "onBlue" ? ["#ffffff", tileColor(app, index)[1]]
      : tone === "dark" ? ["#13275A", "#7FB0FF"]
        : tone === "mono" ? ["#E8F0FD", BLUE]
          : tileColor(app, index);
  const text = tone === "onBlue" ? "text-white" : tone === "dark" ? "text-slate-100" : "text-slate-800";
  const hover = tone === "onBlue" || tone === "dark" ? "hover:bg-white/10" : "hover:bg-white";
  return (
    <button type="button" onClick={() => onPick(app)} title={app.locked ? "Unlocks at a later stage" : undefined}
      className={`flex flex-col items-center gap-2 rounded-xl px-1.5 py-4 text-center text-[12.5px] transition-colors ${text} ${hover} ${app.locked ? "opacity-55" : ""}`}>
      <span className={`flex h-14 w-14 items-center justify-center ${round ? "rounded-full" : "rounded-2xl"}`} style={{ background: bg, color: fg }}>
        <AppIcon app={app} className={app.locked ? "h-6 w-6" : "h-7 w-7"} />
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function Grid({ apps, tone = "light", round, tLabel, onPick, all }: Readonly<{
  apps: TopMenuApp[]; tone?: Tone; round?: boolean; tLabel: (s: string) => string; onPick: (a: TopMenuApp) => void; all?: TopMenuApp[];
}>) {
  const order = all ?? apps;
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
      {apps.map((a) => <Tile key={a.id} app={a} index={order.indexOf(a)} tone={tone} round={round} label={tLabel(a.label)} onPick={onPick} />)}
    </div>
  );
}

export function WorkspaceHome({ workspace, profileName }: Readonly<{ workspace: WorkspaceId; profileName?: string }>) {
  const router = useRouter();
  const { apps, tLabel } = useTopMenuApps(workspace);
  const settings = useAdminHomeSettings(workspace === "admin") ?? DEFAULT_ADMIN_HOME;
  const greeting = useGreeting();
  const firstName = (profileName ?? "").trim().split(/\s+/)[0];
  const hello = firstName ? `${greeting}, ${firstName}` : greeting;

  const pick = (app: TopMenuApp) => { rememberApp(workspace, app.id); router.push(app.href); };
  const grid = (list: TopMenuApp[], tone?: Tone, round?: boolean) =>
    <Grid apps={list} all={apps} tone={tone} round={round} tLabel={tLabel} onPick={pick} />;

  const shell = "min-h-[calc(100vh-6rem)] overflow-hidden rounded-xl";

  switch (settings.style) {
    case 2: // Brand blue
      return (
        <div className={shell} style={{ background: BLUE }}>
          <h1 className="sr-only">Home</h1>
          <div className="px-6 py-8">{grid(apps, "onBlue")}</div>
        </div>
      );
    case 3: // Navy night
      return (
        <div className={shell} style={{ background: "#0E2150" }}>
          <h1 className="sr-only">Home</h1>
          <div className="px-6 py-8">{grid(apps, "dark")}</div>
        </div>
      );
    case 4: // Centered search
      return (
        <div className={`${shell} bg-white px-6 py-8 text-center`}>
          <h1 className="sr-only">Home</h1>
          {grid(apps)}
        </div>
      );
    case 5: { // Grouped by work
      const used = new Set<string>();
      const sections = GROUPS.map((g) => {
        const list = apps.filter((a) => g.hrefs.includes(a.iconHref));
        list.forEach((a) => used.add(a.id));
        return { label: g.label, list };
      });
      const rest = apps.filter((a) => !used.has(a.id));
      if (rest.length) sections.push({ label: "More", list: rest });
      return (
        <div className={`${shell} bg-slate-50 px-6 py-6`}>
          <h1 className="sr-only">Home</h1>
          {sections.filter((s) => s.list.length).map((s) => (
            <section key={s.label} className="mt-4">
              <h2 className="mx-auto mb-1 max-w-5xl px-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: BLUE }}>{s.label}</h2>
              {grid(s.list)}
            </section>
          ))}
        </div>
      );
    }
    case 6: // Brand rail
      return (
        <div className={`${shell} flex bg-slate-50`}>
          <aside className="hidden w-60 shrink-0 flex-col p-6 text-white md:flex" style={{ background: NAVY }}>
            <p className="mt-8 text-[17px] font-semibold">{hello}</p>
            <p className="mt-1 text-[12px] text-white/70">Admin workspace</p>
          </aside>
          <div className="flex-1 px-4 py-8"><h1 className="sr-only">Home</h1>{grid(apps)}</div>
        </div>
      );
    case 7: // Emblem watermark
      return (
        <div className={`${shell} relative bg-slate-50 px-6 py-8`}>
          <h1 className="sr-only">Home</h1>
          <span aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 block h-[420px] w-[420px] bg-contain bg-no-repeat opacity-[0.06]"
            style={{ backgroundImage: "url(/icapos-icon-512.svg)" }} />
          <div className="relative">{grid(apps)}</div>
        </div>
      );
    case 8: // Cards with descriptions
      return (
        <div className={`${shell} bg-slate-50 px-6 py-6`}>
          <h1 className="sr-only">Home</h1>
          <div className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {apps.map((a, i) => {
              const [bg, fg] = tileColor(a, i);
              return (
                <button key={a.id} type="button" onClick={() => pick(a)}
                  className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:shadow-sm ${a.locked ? "opacity-55" : ""}`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: bg, color: fg }}>
                    <AppIcon app={a} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-slate-900">{tLabel(a.label)}</span>
                    {DESCRIPTIONS[a.iconHref] ? <span className="block truncate text-[12px] text-slate-500">{DESCRIPTIONS[a.iconHref]}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    case 9: // Brand blue icons
      return (
        <div className={`${shell} bg-white`}>
          <h1 className="sr-only">Home</h1>
          <div className="h-1" style={{ background: BLUE }} />
          <div className="px-6 py-8">{grid(apps, "mono", true)}</div>
        </div>
      );
    case 10: // Split hero
      return (
        <div className={`${shell} bg-slate-50`}>
          <h1 className="sr-only">Home</h1>
          <div className="px-6 pb-24 pt-8 text-center text-white" style={{ background: BLUE }}>
            <p className="mt-2 text-[14px] text-white/85">{hello}</p>
          </div>
          <div className="mx-4 -mt-16 mb-6 rounded-2xl border border-slate-200 bg-white px-2 py-6 sm:mx-8">{grid(apps)}</div>
        </div>
      );
    default: // 1. Navy banner
      return (
        <div className={`${shell} bg-slate-50`}>
          <h1 className="sr-only">Home</h1>
          <div className="flex flex-wrap items-center gap-4 px-6 py-6 text-white" style={{ background: NAVY }}>
            <div className="ml-auto text-right">
              <p className="text-[17px] font-semibold">{hello}</p>
              <p className="text-[12px] text-white/70">Admin workspace</p>
            </div>
          </div>
          <div className="px-4 py-8">{grid(apps)}</div>
        </div>
      );
  }
}
