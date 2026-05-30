"use client";

import { AppShell } from "@/components/AppShell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell workspace="admin">{children}</AppShell>;
}
