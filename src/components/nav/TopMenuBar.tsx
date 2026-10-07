"use client";

/**
 * Odoo-style top menu: launcher grid button, current app name, and the app's pages as
 * menu items (groups open as dropdowns; items that don't fit fold into "More"). The
 * launcher opens a full-width tile grid of every app the person can see. A workspace with
 * a home page (admin: /admin/home) shows that grid as its home instead, and the grid
 * icon goes there. Spec: "iCapOS Top Menu Layout Build Spec".
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BookOpen, CalendarDays, ChevronDown, Contact, Crown, GraduationCap, Grip, Headset, Landmark, LayoutDashboard,
  LifeBuoy, Lock, Mail, Megaphone, MessagesSquare, Settings, Share2, ShieldCheck, TrendingUp, Wrench, type LucideIcon,
} from "lucide-react";
import type { WorkspaceId } from "@/lib/workspace-nav";
import { workspaceLabel } from "@/lib/workspace-nav";
import { getWorkspaceNavIcon } from "@/lib/ui/nav-icons";
import { activeHref, currentApp, toApps, type TopMenuApp, type TopMenuEntry, type TopMenuLink } from "@/lib/nav/top-menu";
import { SALES_HUB_TABS } from "@/app/admin/sales/SalesHubTabs";
import { IR_HUB_TABS } from "@/app/admin/ir/IrHubTabs";
import { useGatedNav } from "@/components/nav/useGatedNav";

/** Sales and IR have their own hub tab lists (wider than the sidebar's); they are those apps' menus. */
const MENU_OVERRIDES = { "/admin/sales": SALES_HUB_TABS, "/admin/ir": IR_HUB_TABS };

/** Launcher tile colors (background, icon). Assigned by position, so the grid reads as a set. */
/** One distinct icon per admin hub on the launcher and Home tiles (the sidebar keeps its own icons). */
export const TILE_ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/contacts": Contact,
  "/admin/sales/contacts": Contact,
  "/admin/ceo": Crown,
  "/admin/sales": TrendingUp,
  "/admin/marketing": Megaphone,
  "/admin/ir": Landmark,
  "/admin/social": Share2,
  "/admin/events": CalendarDays,
  "/admin/voice": Headset,
  "/admin/inbox": MessagesSquare,
  "/admin/actions": Wrench,
  "/admin/companies": LifeBuoy,
  "/admin/learning": GraduationCap,
  "/admin/manual": BookOpen,
  "/admin/users/manage": ShieldCheck,
  "/admin/integrations": Settings,
};

/** A tile's colors, fixed per admin hub so they don't shift when someone can't see every hub. */
export function tileColor(app: TopMenuApp, index: number): [string, string] {
  const k = Object.keys(TILE_ICONS).indexOf(app.iconHref);
  return TILE_COLORS[(k >= 0 ? k : index) % TILE_COLORS.length];
}

/** The tile icon for an app: its own hub icon when it has one, else the sidebar's icon. */
export function tileIcon(app: TopMenuApp): LucideIcon {
  return TILE_ICONS[app.iconHref] ?? getWorkspaceNavIcon(app.iconHref);
}

export const TILE_COLORS: Array<[string, string]> = [
  ["#E6F1FB", "#0C447C"], ["#E8F0FD", "#1A6CE4"], ["#FAEEDA", "#633806"], ["#EAF3DE", "#27500A"],
  ["#FBEAF0", "#72243E"], ["#EEEDFE", "#3730A3"], ["#FAECE7", "#712B13"], ["#F1EFE8", "#444441"],
];

const MORE_WIDTH = 76;

const PREFERRED_EVENT = "topmenu-app-change";

function preferredKey(workspace: WorkspaceId) {
  return `topmenu.app.${workspace}`;
}

function subscribePreferred(onChange: () => void) {
  window.addEventListener(PREFERRED_EVENT, onChange);
  return () => window.removeEventListener(PREFERRED_EVENT, onChange);
}

/** Workspaces whose home page is the app grid. The grid icon goes there instead of opening the overlay. */
export const WORKSPACE_HOME: Partial<Record<WorkspaceId, string>> = { admin: "/admin/home" };

/** Remember the app a person opened, so pages shared by two apps stay in the one they came from. */
export function rememberApp(workspace: WorkspaceId, id: string) {
  try { window.sessionStorage.setItem(preferredKey(workspace), id); } catch { /* ignore */ }
  window.dispatchEvent(new Event(PREFERRED_EVENT));
}

/** The launcher apps this person can see (same gating as the menus). */
export function useTopMenuApps(workspace: WorkspaceId) {
  const nav = useGatedNav(workspace);
  const { isLocked, tLabel, lockHint } = nav;
  const apps = useMemo(
    () => toApps(nav.sections, { isLocked, menuOverrides: workspace === "admin" ? MENU_OVERRIDES : undefined }),
    [nav.sections, workspace, isLocked],
  );
  return { apps, tLabel, lockHint };
}

export function TopMenuBar({ workspace }: Readonly<{ workspace: WorkspaceId }>) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apps, tLabel, lockHint } = useTopMenuApps(workspace);
  const homePath = WORKSPACE_HOME[workspace];
  const onHome = Boolean(homePath) && pathname === homePath;

  // The app last opened from the launcher or menu, so shared pages stay in that app (per tab).
  const preferred = useSyncExternalStore(
    subscribePreferred,
    () => { try { return window.sessionStorage.getItem(preferredKey(workspace)); } catch { return null; } },
    () => null,
  );
  const remember = useCallback((id: string) => rememberApp(workspace, id), [workspace]);

  const app = onHome ? null : currentApp(apps, pathname, preferred);
  const active = app ? activeHref(app, pathname) : null;

  // Open menus belong to the page they were opened on, so navigating closes them.
  const [launcherAt, setLauncherAt] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{ at: string; v: number | "more" } | null>(null);
  const launcherOpen = launcherAt === pathname;
  const openMenu = menuState?.at === pathname ? menuState.v : null;
  const setOpenMenu = useCallback((v: number | "more" | null) => setMenuState(v === null ? null : { at: pathname, v }), [pathname]);
  const setLauncherOpen = useCallback(
    (v: boolean | ((open: boolean) => boolean)) => setLauncherAt((at) => {
      const next = typeof v === "function" ? v(at === pathname) : v;
      return next ? pathname : null;
    }),
    [pathname],
  );

  // Alt+H toggles the launcher (e.code, so macOS Option+H works); Esc closes anything open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "KeyH") {
        e.preventDefault();
        setOpenMenu(null);
        if (homePath) router.push(homePath);
        else setLauncherOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpenMenu(null);
        setLauncherOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpenMenu, setLauncherOpen, homePath, router]);

  // Sales keeps the View Me / Team selection across its tabs (as the compact hub tabs did).
  const viewAs = searchParams?.get("viewAs");
  const hrefFor = (link: TopMenuLink) =>
    app?.href.startsWith("/admin/sales") && viewAs && viewAs !== "team" && !link.href.endsWith("/settings")
      ? `${link.href}?viewAs=${encodeURIComponent(viewAs)}`
      : link.href;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {homePath ? (
        <Link
          href={homePath}
          aria-label="Home"
          aria-current={onHome ? "page" : undefined}
          title="Home (Alt+H)"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${onHome ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
        >
          <Grip className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </Link>
      ) : (
        <button
          type="button"
          aria-label="Apps"
          aria-expanded={launcherOpen}
          title="Apps (Alt+H)"
          onClick={() => { setOpenMenu(null); setLauncherOpen((v) => !v); }}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${launcherOpen ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
        >
          <Grip className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </button>
      )}
      <span className="shrink-0 truncate px-1.5 text-[14px] font-semibold text-slate-950">
        {onHome ? "Home" : app ? tLabel(app.label) : workspaceLabel(workspace)}
      </span>

      {app && app.entries.length > 0 && !launcherOpen ? (
        <MenuRow
          key={app.id}
          entries={app.entries}
          active={active}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          hrefFor={hrefFor}
          tLabel={tLabel}
          lockHint={lockHint}
          onNavigate={() => remember(app.id)}
        />
      ) : <div className="flex-1" />}

      {launcherOpen ? (
        <AppLauncher
          apps={apps}
          current={app?.id ?? null}
          tLabel={tLabel}
          onPick={(a) => { remember(a.id); setLauncherOpen(false); router.push(a.href); }}
          onClose={() => setLauncherOpen(false)}
        />
      ) : null}
    </div>
  );
}

function MenuRow({
  entries,
  active,
  openMenu,
  setOpenMenu,
  hrefFor,
  tLabel,
  lockHint,
  onNavigate,
}: Readonly<{
  entries: TopMenuEntry[];
  active: string | null;
  openMenu: number | "more" | null;
  setOpenMenu: (v: number | "more" | null) => void;
  hrefFor: (link: TopMenuLink) => string;
  tLabel: (label: string) => string;
  lockHint: (minStage?: string) => string | undefined;
  onNavigate: () => void;
}>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(entries.length);

  // Fit as many entries as the row allows; the rest go under "More".
  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const calc = () => {
      const avail = row.clientWidth;
      const widths = Array.from(measure.children).map((c) => (c as HTMLElement).offsetWidth + 2);
      const total = widths.reduce((a, b) => a + b, 0);
      if (total <= avail) { setVisible(entries.length); return; }
      let used = MORE_WIDTH;
      let n = 0;
      while (n < widths.length && used + widths[n] <= avail) { used += widths[n]; n++; }
      setVisible(n);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(row);
    return () => ro.disconnect();
  }, [entries]);

  // Click outside closes an open dropdown.
  useEffect(() => {
    if (openMenu === null) return;
    const onDown = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMenu, setOpenMenu]);

  const shown = entries.slice(0, visible);
  const overflow = entries.slice(visible);
  const containsActive = (e: TopMenuEntry) => (e.kind === "group" ? e.items.some((i) => i.href === active) : e.href === active);

  const itemClass = (on: boolean) =>
    `flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
      on ? "font-semibold text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
    }`;

  return (
    <div ref={rowRef} className="relative hidden min-w-0 flex-1 items-center lg:flex" role="menubar">
      {/* Off-screen copy used only to measure item widths. */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex">
        {entries.map((e, i) => (
          <span key={i} className={itemClass(containsActive(e))}>
            {tLabel(e.label)}
            {e.kind === "group" ? <ChevronDown className="h-3.5 w-3.5" /> : null}
          </span>
        ))}
      </div>

      {shown.map((e, i) => {
        const on = containsActive(e);
        if (e.kind === "link") {
          return (
            <Link key={e.href + e.label} href={hrefFor(e)} role="menuitem" onClick={onNavigate}
              aria-current={on ? "page" : undefined} title={e.locked ? lockHint(e.minStage) : undefined}
              className={`${itemClass(on)} ${e.locked ? "opacity-55" : ""}`}>
              {tLabel(e.label)}
              {e.locked ? <Lock className="h-3 w-3 text-slate-400" aria-hidden /> : null}
            </Link>
          );
        }
        return (
          <div key={`g-${e.label}`} className="relative">
            <button type="button" role="menuitem" aria-haspopup="true" aria-expanded={openMenu === i}
              onClick={() => setOpenMenu(openMenu === i ? null : i)}
              className={`${itemClass(on)} ${openMenu === i ? "bg-slate-100 text-slate-950" : ""}`}>
              {tLabel(e.label)}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            </button>
            {openMenu === i ? (
              <Dropdown links={e.items} active={active} hrefFor={hrefFor} tLabel={tLabel} lockHint={lockHint} onNavigate={onNavigate} />
            ) : null}
          </div>
        );
      })}

      {overflow.length ? (
        <div className="relative">
          <button type="button" role="menuitem" aria-haspopup="true" aria-expanded={openMenu === "more"}
            onClick={() => setOpenMenu(openMenu === "more" ? null : "more")}
            className={`${itemClass(overflow.some(containsActive))} ${openMenu === "more" ? "bg-slate-100 text-slate-950" : ""}`}>
            More
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          </button>
          {openMenu === "more" ? (
            <div role="menu" className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] min-w-[200px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              {overflow.map((e) => e.kind === "link" ? (
                <MenuLink key={e.href + e.label} link={e} active={active} hrefFor={hrefFor} tLabel={tLabel} lockHint={lockHint} onNavigate={onNavigate} />
              ) : (
                <div key={`mg-${e.label}`} className="pt-1">
                  <p className="px-2.5 pb-0.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">{tLabel(e.label)}</p>
                  {e.items.map((l) => (
                    <MenuLink key={l.href + l.label} link={l} active={active} hrefFor={hrefFor} tLabel={tLabel} lockHint={lockHint} onNavigate={onNavigate} />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Dropdown(props: Readonly<{
  links: TopMenuLink[];
  active: string | null;
  hrefFor: (link: TopMenuLink) => string;
  tLabel: (label: string) => string;
  lockHint: (minStage?: string) => string | undefined;
  onNavigate: () => void;
}>) {
  return (
    <div role="menu" className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] min-w-[190px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
      {props.links.map((l) => <MenuLink key={l.href + l.label} link={l} {...props} />)}
    </div>
  );
}

function MenuLink({ link, active, hrefFor, tLabel, lockHint, onNavigate }: Readonly<{
  link: TopMenuLink;
  active: string | null;
  hrefFor: (link: TopMenuLink) => string;
  tLabel: (label: string) => string;
  lockHint: (minStage?: string) => string | undefined;
  onNavigate: () => void;
}>) {
  const on = link.href === active;
  return (
    <Link href={hrefFor(link)} role="menuitem" onClick={onNavigate} aria-current={on ? "page" : undefined}
      title={link.locked ? lockHint(link.minStage) : undefined}
      className={`flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] ${
        on ? "bg-[var(--blue-muted)] font-semibold text-[var(--blue-hover)]" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
      } ${link.locked ? "opacity-55" : ""}`}>
      <span className="flex-1">{tLabel(link.label)}</span>
      {link.locked ? <Lock className="h-3 w-3 text-slate-400" aria-hidden /> : null}
    </Link>
  );
}

function AppLauncher({ apps, current, tLabel, onPick, onClose }: Readonly<{
  apps: TopMenuApp[];
  current: string | null;
  tLabel: (label: string) => string;
  onPick: (app: TopMenuApp) => void;
  onClose: () => void;
}>) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 overflow-y-auto bg-slate-50"
      style={{ top: "var(--workspace-header-height, 2.75rem)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-label="Apps"
    >
      <AppGrid apps={apps} current={current} tLabel={tLabel} onPick={onPick} />
    </div>
  );
}

/** The tile grid shared by the launcher overlay and a workspace's home page. */
export function AppGrid({ apps, current, tLabel, onPick }: Readonly<{
  apps: TopMenuApp[];
  current: string | null;
  tLabel: (label: string) => string;
  onPick: (app: TopMenuApp) => void;
}>) {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 px-6 py-10">
      {apps.map((a, i) => {
        const Icon = tileIcon(a);
        const [bg, fg] = tileColor(a, i);
        return (
          <button key={a.id} type="button" onClick={() => onPick(a)}
            title={a.locked ? "Unlocks at a later stage" : undefined}
            className={`flex flex-col items-center gap-2 rounded-xl px-1.5 py-4 text-center text-[12.5px] text-slate-800 transition-colors hover:bg-white ${a.id === current ? "bg-white ring-1 ring-slate-200" : ""} ${a.locked ? "opacity-55" : ""}`}>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: bg, color: fg }}>
              {a.locked ? <Lock className="h-6 w-6" strokeWidth={1.75} aria-hidden /> : <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />}
            </span>
            <span className="leading-tight">{tLabel(a.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Messages icon for the top bar's right side, with the unread inbox count (polled like the sidebar's badge). */
// Spelled out (not `/${workspace}/inbox`) so the static link audit can verify each route.
const INBOX_HREF: Record<WorkspaceId, string> = {
  admin: "/admin/inbox",
  founder: "/founder/inbox",
  investor: "/investor/inbox",
};

export function TopMenuInboxButton({ workspace }: Readonly<{ workspace: WorkspaceId }>) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/email/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setUnread(Number(d.count ?? 0)); })
      .catch(() => { /* badge just won't show */ });
    void load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return (
    <Link href={INBOX_HREF[workspace]} aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"} title="Inbox"
      className="relative hidden h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950 md:flex">
      <Mail className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden />
      {unread > 0 ? (
        <span className="absolute -right-0.5 top-0 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2E78F5] px-1 text-[10px] font-semibold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
