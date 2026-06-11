"use client";

import { AppShell } from "@/components/AppShell";

/** Guarantees investor workspace chrome (sidebar + header) on every /investor/* route. */
export default function InvestorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell workspace="investor">{children}</AppShell>;
}
