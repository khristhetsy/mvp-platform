import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthHandler } from "@/components/AuthHandler";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DiligenceVault | AI Due Diligence Platform",
  description: "AI due diligence and campaign review portal for founders, admins, analysts, and approved investors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthHandler />
        {children}
      </body>
    </html>
  );
}
