import type { WorkspaceId } from "@/lib/workspace-nav";
import { getWorkspaceNav, workspaceLabel } from "@/lib/workspace-nav";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function buildWorkspaceBreadcrumbs(
  pathname: string,
  workspace: WorkspaceId,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: workspaceLabel(workspace), href: getWorkspaceNav(workspace)[0]?.href },
  ];

  const nav = getWorkspaceNav(workspace);
  const match = nav.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  if (match && pathname !== match.href) {
    items.push({ label: match.label, href: match.href });
    const rest = pathname.slice(match.href.length + 1);
    if (rest) {
      const segment = rest.split("/")[0];
      items.push({
        label: segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }
  } else if (match) {
    items.push({ label: match.label });
  } else {
    const segment = pathname.split("/").filter(Boolean).pop();
    if (segment) {
      items.push({
        label: segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }
  }

  return items;
}
