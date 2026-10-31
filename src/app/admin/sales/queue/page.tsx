import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { ensureQueue, readQueue } from "@/lib/sales-ai/queue-store";
import { SalesHubHeader } from "../SalesHubHeader";
import { QueueClient } from "./QueueClient";

export const dynamic = "force-dynamic";

export default async function SalesAiQueuePage() {
  const profile = await requireRole(["admin", "analyst"]);
  await ensureQueue();
  const { day, items } = await readQueue();
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <QueueClient day={day} initial={items} />
    </AppShell>
  );
}
