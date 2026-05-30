"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceId } from "@/lib/workspace-nav";
import { getWorkspaceNav, workspaceLabel } from "@/lib/workspace-nav";

export function WorkspaceSidebar({ workspace }: Readonly<{ workspace: WorkspaceId }>) {
  const pathname = usePathname();
  const items = getWorkspaceNav(workspace);
  const label = workspaceLabel(workspace);

  return (
    <aside className="sticky top-0 z-30 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-slate-50">
      <div className="border-b border-slate-200/80 bg-white px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-sm">
            C
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-950">CapitalOS</span>
        </Link>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600">{label}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-l-2 border-indigo-600 bg-white text-indigo-800 shadow-sm ring-1 ring-slate-200/80"
                  : "border-l-2 border-transparent text-slate-600 hover:bg-white/80 hover:text-slate-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200/80 bg-white px-5 py-4">
        <p className="text-xs leading-5 text-slate-500">One platform. Specialized workspaces.</p>
      </div>
    </aside>
  );
}
