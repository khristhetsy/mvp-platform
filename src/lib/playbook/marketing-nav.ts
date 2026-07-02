// Surface set for the MARKETING Daily Console. Unlike the admin console (which
// reads the live admin nav), this is a curated list of the 11 marketing operating
// modules from the spec, each pointing at the real hub surface where the work is
// done. Keys are namespaced `mkt:` so these rows never mix into the admin console
// or its drift report.

import type { PlaybookNavSurface } from "./nav";

export const MARKETING_SURFACES: PlaybookNavSurface[] = [
  { id: "mkt:dashboard", label: "Dashboard", group: "Marketing", href: "/admin/marketing" },
  { id: "mkt:action-center", label: "Action Center", group: "Marketing", href: "/admin/marketing/campaigns" },
  { id: "mkt:reply-inbox", label: "Reply Inbox", group: "Marketing", href: "/admin/inbox" },
  { id: "mkt:lead-pipeline", label: "Lead Pipeline", group: "Marketing", href: "/admin/marketing/contacts" },
  { id: "mkt:campaigns", label: "Email Campaigns", group: "Marketing", href: "/admin/marketing/campaigns" },
  { id: "mkt:phone", label: "Phone Follow-up", group: "Marketing", href: "/admin/crm/outreach" },
  { id: "mkt:assets", label: "Content & Assets", group: "Marketing", href: "/admin/marketing/templates" },
  { id: "mkt:brand", label: "Brand Consistency", group: "Marketing", href: "/admin/marketing" },
  { id: "mkt:cmo", label: "AI CMO Advisory", group: "Marketing", href: "/admin/marketing/plan" },
  { id: "mkt:seo-aeo", label: "SEO / AEO", group: "Marketing", href: "/admin/marketing/aeo" },
  { id: "mkt:eod", label: "End of Day", group: "Marketing", href: "/admin/marketing/analytics" },
];

export function marketingSurfaceIds(): Set<string> {
  return new Set(MARKETING_SURFACES.map((s) => s.id));
}

export const MARKETING_KEY_PREFIX = "mkt:";
