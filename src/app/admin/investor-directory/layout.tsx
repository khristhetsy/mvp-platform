import type { ReactNode } from "react";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";
import { INVESTOR_DIRECTORY_FEATURE_KEY } from "@/lib/investor-directory/types";

/** The admin Investor Directory console follows its switch in Admin › Feature controls. */
export default async function AdminInvestorDirectoryLayout({ children }: Readonly<{ children: ReactNode }>) {
  await assertFeatureEnabled("admin", INVESTOR_DIRECTORY_FEATURE_KEY, "/admin");
  return <>{children}</>;
}
