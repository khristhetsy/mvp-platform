import { unstable_cache } from "next/cache";
import { getSiteDefaultView, SITE_DEFAULT_VIEW_TAG, type SiteDefaultView } from "@/lib/settings/platform-settings";

/**
 * Admin-chosen landing experience for the marketing site. Cached and tagged so
 * marketing pages stay static; the admin save revalidates the tag, so a change
 * applies on the next page load.
 */
export const loadSiteDefaultView = unstable_cache(
  async (): Promise<SiteDefaultView> => getSiteDefaultView(),
  ["marketing-site-default-view"],
  { revalidate: 3600, tags: [SITE_DEFAULT_VIEW_TAG] },
);
