import { withSentryConfig, type SentryBuildOptions } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: __dirname,
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
} as SentryBuildOptions);
