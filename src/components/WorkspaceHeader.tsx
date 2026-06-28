"use client";

import { CapitalOSLogo } from "@/components/CapitalOSLogo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  CreditCard,
  HelpCircle,
  LogOut,
  PieChart,
  Settings,
  Shield,
  Terminal,
  User,
} from "lucide-react";
import { NotificationBellDropdown } from "@/components/NotificationBellDropdown";
import { WorkspaceBreadcrumbs } from "@/components/ui/WorkspaceBreadcrumbs";
import type { WorkspaceId } from "@/lib/workspace-nav";
import { workspaceLabel } from "@/lib/workspace-nav";

type Props = {
  workspace: WorkspaceId;
  profileName: string;
  profileSubtitle?: string;
  profileEmail?: string;
  onMenuClick?: () => void;
};

type MenuItem =
  | { kind: "link"; label: string; href: string; icon: React.ReactNode }
  | { kind: "divider" }
  | { kind: "signout" };

function menuItemsForWorkspace(workspace: WorkspaceId): MenuItem[] {
  if (workspace === "founder") {
    return [
      { kind: "link", label: "Settings", href: "/founder/settings", icon: <Settings className="h-4 w-4" /> },
      { kind: "link", label: "Company onboarding", href: "/founder/onboarding", icon: <Building2 className="h-4 w-4" /> },
      { kind: "link", label: "Capital raise", href: "/founder/capital-raise", icon: <CreditCard className="h-4 w-4" /> },
      { kind: "link", label: "Documents", href: "/founder/documents", icon: <Terminal className="h-4 w-4" /> },
      { kind: "divider" },
      { kind: "link", label: "Help & support", href: "https://docs.icapos.com", icon: <HelpCircle className="h-4 w-4" /> },
      { kind: "divider" },
      { kind: "signout" },
    ];
  }

  if (workspace === "admin") {
    return [
      { kind: "link", label: "Profile", href: "/admin/profile", icon: <User className="h-4 w-4" /> },
      { kind: "link", label: "Platform settings", href: "/admin/integrations", icon: <Shield className="h-4 w-4" /> },
      { kind: "link", label: "System health", href: "/admin/system-health", icon: <Activity className="h-4 w-4" /> },
      { kind: "link", label: "Audit log", href: "/admin/audit", icon: <Terminal className="h-4 w-4" /> },
      { kind: "divider" },
      { kind: "link", label: "Help & support", href: "https://docs.icapos.com", icon: <HelpCircle className="h-4 w-4" /> },
      { kind: "divider" },
      { kind: "signout" },
    ];
  }

  return [
    { kind: "link", label: "Settings", href: "/investor/settings", icon: <Settings className="h-4 w-4" /> },
    { kind: "link", label: "Investor profile", href: "/investor/onboarding", icon: <Briefcase className="h-4 w-4" /> },
    { kind: "link", label: "Portfolio", href: "/investor/portfolio", icon: <PieChart className="h-4 w-4" /> },
    { kind: "link", label: "Watchlist", href: "/investor/watchlist", icon: <Bell className="h-4 w-4" /> },
    { kind: "link", label: "Opportunities", href: "/investor/opportunities", icon: <PieChart className="h-4 w-4" /> },
    { kind: "divider" },
    { kind: "link", label: "Help & support", href: "https://docs.icapos.com", icon: <HelpCircle className="h-4 w-4" /> },
    { kind: "divider" },
    { kind: "signout" },
  ];
}

function ProfileDropdown({
  profileName,
  profileEmail,
  profileSubtitle,
  workspace,
}: Readonly<{
  profileName: string;
  profileEmail?: string;
  profileSubtitle?: string;
  workspace: WorkspaceId;
}>) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const initials = profileName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/auth/logout", { method: "POST" });
      router.push("/");
    } catch {
      setSigningOut(false);
    }
  }

  const items = menuItemsForWorkspace(workspace);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Open user menu"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 hover:border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--blue)] text-[10px] font-semibold text-white shrink-0">
          {initials || "iC"}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium leading-tight text-slate-950">{profileName}</p>
          {profileSubtitle ? <p className="text-[11px] text-slate-500">{profileSubtitle}</p> : null}
        </div>
        <ChevronDown className={`hidden sm:block h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="text-sm font-medium text-slate-950">{profileName}</p>
            {profileEmail ? (
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{profileEmail}</p>
            ) : profileSubtitle ? (
              <p className="text-[11px] text-slate-500 mt-0.5">{profileSubtitle}</p>
            ) : null}
          </div>

          <div className="py-1">
            {items.map((item, i) => {
              if (item.kind === "divider") {
                return <div key={i} className="my-1 border-t border-slate-100" />;
              }
              if (item.kind === "signout") {
                return (
                  <button
                    key="signout"
                    type="button"
                    role="menuitem"
                    disabled={signingOut}
                    onClick={() => void handleSignOut()}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                  >
                    <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                );
              }
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition-colors"
                >
                  <span className="shrink-0 text-slate-400">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceHeader({ workspace, profileName, profileSubtitle, profileEmail, onMenuClick }: Readonly<Props>) {
  const companyLabel = profileSubtitle?.trim() || "Select company";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white shadow-[var(--shadow-sticky)]">
      <div className="flex min-h-[var(--workspace-header-height)] flex-wrap items-center gap-2 px-4 py-2.5 lg:gap-3 lg:px-5">
        <button
          type="button"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
          aria-label="Open workspace menu"
          onClick={onMenuClick}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/" className="flex shrink-0 items-center self-center">
          <CapitalOSLogo height={28} />
        </Link>
        <WorkspaceBreadcrumbs workspace={workspace} />
        <span className="hidden rounded-md bg-[var(--blue-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--blue-hover)] sm:inline">
          {workspaceLabel(workspace)}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {/* Global search trigger */}
          <button
            type="button"
            aria-label="Open global search (⌘K)"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
            className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors md:flex"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="hidden lg:inline">Search</span>
            <kbd className="hidden rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 lg:inline">⌘K</kbd>
          </button>
          <button
            type="button"
            aria-label={`Current company: ${companyLabel}`}
            aria-disabled="true"
            className="hidden max-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-sm font-medium text-slate-950 md:flex lg:max-w-xs"
          >
            <span className="truncate">{companyLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
          </button>
          <NotificationBellDropdown />
          <ProfileDropdown
            profileName={profileName}
            profileEmail={profileEmail}
            profileSubtitle={profileSubtitle}
            workspace={workspace}
          />
        </div>
      </div>
    </header>
  );
}
