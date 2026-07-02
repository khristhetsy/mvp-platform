import type { MetadataRoute } from "next";

/**
 * Allow all crawlers (search + AI) on public surfaces; keep authenticated app,
 * admin, and API routes out of the index. No blanket Disallow, no AI blocks.
 */
export default function robots(): MetadataRoute.Robots {
  const appDisallow = ["/admin", "/founder", "/investor", "/api", "/auth", "/billing", "/notifications"];
  // AI answer-engine crawlers: explicitly welcomed on public surfaces, and on
  // /learn/* in particular (the AEO pillar pages exist to be cited).
  const aiCrawlers = ["GPTBot", "PerplexityBot", "Google-Extended", "ClaudeBot"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: appDisallow },
      ...aiCrawlers.map((userAgent) => ({
        userAgent,
        allow: ["/", "/learn/"],
        disallow: appDisallow,
      })),
    ],
    sitemap: ["https://icapos.com/sitemap.xml", "https://icapos.com/learn/sitemap.xml"],
    host: "https://icapos.com",
  };
}
