import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthHandler } from "@/components/AuthHandler";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { GoogleAnalyticsScript } from "@/components/GoogleAnalytics";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { PlatformTimeZoneInit } from "@/components/PlatformTimeZoneInit";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";
import "./globals.css";

const geistSans = localFont({
  src: "../fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://icapos.com"),
  title: {
    default: "iCapOS — The operating system for capital-ready companies",
    template: "%s · iCapOS",
  },
  description:
    "AI diligence, investor readiness, secure data rooms, and a private market where scored founders meet quality investors.",
  applicationName: "iCapOS",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "iCapOS",
    url: "https://icapos.com",
    title: "iCapOS — The operating system for capital-ready companies",
    description:
      "AI diligence, investor readiness, secure data rooms, and a private market where scored founders meet quality investors.",
  },
  twitter: {
    card: "summary_large_image",
    title: "iCapOS — The operating system for capital-ready companies",
    description: "AI diligence, investor readiness, secure data rooms, and a private market.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <PlatformTimeZoneInit />
        <ServiceWorkerRegister />
        <GoogleAnalyticsScript />
        <NextIntlClientProvider messages={messages} timeZone={PLATFORM_TZ}>
          <PostHogProvider>
            <AuthHandler />
            <ToastProvider><ConfirmProvider>{children}</ConfirmProvider></ToastProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
