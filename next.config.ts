import { withSentryConfig, type SentryBuildOptions } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: __dirname,
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
} as SentryBuildOptions);
