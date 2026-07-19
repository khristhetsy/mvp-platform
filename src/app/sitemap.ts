import type { MetadataRoute } from "next";
import { listPublishedSlugs } from "@/lib/aeo/store";
import { getLiveSlugs } from "@/lib/marketplace/queries";

const SITE = "https://icapos.com";

/** Public marketing + trust routes, plus published AEO (/learn) pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }[] = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/founders", changeFrequency: "weekly", priority: 0.8 },
    { path: "/investors", changeFrequency: "weekly", priority: 0.8 },
    { path: "/deals", changeFrequency: "daily", priority: 0.8 },
    { path: "/marketplace", changeFrequency: "daily", priority: 0.8 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.7 },
    { path: "/submit-company", changeFrequency: "monthly", priority: 0.6 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
    { path: "/security", changeFrequency: "monthly", priority: 0.3 },
  ];

  const base: MetadataRoute.Sitemap = routes.map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Published AEO pillar pages (best-effort — never break the sitemap on error).
  let learn: MetadataRoute.Sitemap = [];
  try {
    const pages = await listPublishedSlugs();
    learn = pages.map((p) => ({
      url: `${SITE}/learn/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    learn = [];
  }

  // Live marketplace listing detail pages (non-live slugs are never included).
  let listings: MetadataRoute.Sitemap = [];
  try {
    const slugs = await getLiveSlugs();
    listings = slugs.map((slug) => ({
      url: `${SITE}/marketplace/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));
  } catch {
    listings = [];
  }

  return [...base, ...learn, ...listings];
}
