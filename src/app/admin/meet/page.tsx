import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { MeetPanel } from "@/components/meet/MeetPanel";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminMeetPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("adminPages");
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("meet")}
    >
      <MeetPanel />
    </AppShell>
  );
}
