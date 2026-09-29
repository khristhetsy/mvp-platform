"use client";

import { SalesHubTabs } from "./SalesHubTabs";
import { useAdminChrome } from "@/lib/ui/admin-chrome";

/**
 * The View Me / Team / Someone-else control, placed at the far right of a Sales page's
 * toolbar. In classic chrome the header's tab row still carries it, so this renders
 * nothing there — one control on screen either way.
 */
export function SalesViewControl() {
  const chrome = useAdminChrome();
  if (chrome !== "compact") return null;
  return <SalesHubTabs viewOnly inline />;
}
