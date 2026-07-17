import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
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
        <ServiceWorkerRegister />
        <GoogleAnalyticsScript />
        <NextIntlClientProvider messages={messages}>
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
