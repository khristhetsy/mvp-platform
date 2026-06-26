import type { MetadataRoute } from "next";

/**
 * Allow all crawlers (search + AI) on public surfaces; keep authenticated app,
 * admin, and API routes out of the index. No blanket Disallow, no AI blocks.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/founder", "/investor", "/api", "/auth", "/billing", "/notifications"],
      },
    ],
    sitemap: "https://icapos.com/sitemap.xml",
    host: "https://icapos.com",
  };
}
