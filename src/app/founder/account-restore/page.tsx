import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { RestoreButton } from "./RestoreButton";

export const dynamic = "force-dynamic";

/** Landing page for a founder whose account is inside the 30 day deletion window. */
export default async function AccountRestorePage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("accountDelete");

  const { data } = await createServiceRoleClient()
    .from("profiles")
    .select("deletion_scheduled_for")
    .eq("id", profile.id)
    .single();

  if (!data?.deletion_scheduled_for) redirect("/founder/dashboard");

  const date = new Date(data.deletion_scheduled_for).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{t("restore_title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("restore_body", { date })}</p>
        <div className="mt-5">
          <RestoreButton />
        </div>
      </div>
    </main>
  );
}
