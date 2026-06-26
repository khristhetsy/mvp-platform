import type { MetadataRoute } from "next";

const SITE = "https://icapos.com";

/** Public marketing + trust routes. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }[] = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/founders", changeFrequency: "weekly", priority: 0.8 },
    { path: "/investors", changeFrequency: "weekly", priority: 0.8 },
    { path: "/deals", changeFrequency: "daily", priority: 0.8 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.7 },
    { path: "/submit-company", changeFrequency: "monthly", priority: 0.6 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
    { path: "/security", changeFrequency: "monthly", priority: 0.3 },
  ];

  return routes.map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
