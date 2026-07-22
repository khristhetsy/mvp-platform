import type { MetadataRoute } from "next";
import { listPublishedSlugs } from "@/lib/aeo/store";

const SITE = "https://icapos.com";

// Segment sitemap for published AEO pages → served at /learn/sitemap.xml.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Best-effort — never break the build/sitemap when the DB is unreachable
  // (e.g. CI without Supabase env). Matches the guard in the root sitemap.ts.
  try {
    const pages = await listPublishedSlugs();
    return pages.map((p) => ({
      url: `${SITE}/learn/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    return [];
  }
}
