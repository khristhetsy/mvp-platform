import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { NotificationsSettings } from "@/components/marketing/notifications/NotificationsSettings";

export const dynamic = "force-dynamic";

export default async function MarketingNotificationsSettingsPage() {
  const t = await getTranslations("adminPages");
  await requireRole(["admin"]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em", color: "#534AB7", margin: 0 }}>
          Settings · Notifications
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0f2147", margin: "6px 0 4px" }}>{t("notificationsReminders")}</h1>
        <p style={{ fontSize: 13, color: "#5f5e5a", margin: 0, maxWidth: 640 }}>
          Choose which alerts and reminders reach you, how they&apos;re delivered, and when. Changes apply only to your account.
        </p>
      </div>
      <NotificationsSettings />
    </div>
  );
}
