"use client";

import { AppShell } from "@/components/AppShell";

export default function InvestorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell workspace="investor">{children}</AppShell>;
}
