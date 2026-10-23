import { withSentryConfig, type SentryBuildOptions } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Type checking is enforced in CI (.github/workflows/typecheck.yml), not in the
  // Vercel build — this keeps deploys fast and unblocks shipping when a type error
  // is unrelated to the change being deployed.
  typescript: {
    ignoreBuildErrors: true,
  },
  // pdfkit (PDF gen), pdfjs-dist (PDF text extraction), exceljs (XLSX extraction)
  // must stay external — bundling them for the serverless runtime breaks their
  // runtime imports on Vercel (works in dev, fails in prod → no text extracted).
  serverExternalPackages: ["pdfkit", "pdfjs-dist", "exceljs"],
  // pdfjs loads its main-thread worker from this file at runtime. extract-text.ts
  // now imports it statically, and this keeps it in every server bundle as well.
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  turbopack: {
    root: __dirname,
  },
  // Security headers. nosniff and Referrer-Policy are enforced. The CSP ships in
  // report-only mode first (violations show in the browser console, nothing is
  // blocked) so it can be tightened and then switched to enforcing.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://us.i.posthog.com https://us-assets.i.posthog.com https://cdn.plaid.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://*.plaid.com",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://cdn.plaid.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // /login duplicated /auth/sign-in — consolidate to the canonical auth route.
      { source: "/login", destination: "/auth/sign-in", permanent: true },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
} as SentryBuildOptions);
