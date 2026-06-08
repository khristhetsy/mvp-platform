"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceId } from "@/lib/workspace-nav";
import { buildWorkspaceBreadcrumbs } from "@/lib/ui/workspace-breadcrumbs";

export function WorkspaceBreadcrumbs({ workspace }: Readonly<{ workspace: WorkspaceId }>) {
  const pathname = usePathname() ?? "";
  const items = buildWorkspaceBreadcrumbs(pathname, workspace);

  return (
    <nav aria-label="Breadcrumb" className="hidden text-xs text-slate-500 md:flex md:items-center md:gap-1.5">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-slate-300">/</span> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="font-medium text-slate-600 hover:text-slate-900">
                {item.label}
              </Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined} className={isLast ? "font-medium text-slate-800" : "text-slate-600"}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
