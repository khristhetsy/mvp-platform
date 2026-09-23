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
  turbopack: {
    root: __dirname,
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
