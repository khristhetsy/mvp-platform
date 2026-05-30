"use client";

import { AppShell } from "@/components/AppShell";

export default function FounderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell workspace="founder">{children}</AppShell>;
}
