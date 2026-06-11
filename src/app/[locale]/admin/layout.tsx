"use client";

import { AppShell } from "@/components/AppShell";

/** Guarantees admin workspace chrome (sidebar + header) on every /admin/* route. */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell workspace="admin">{children}</AppShell>;
}
