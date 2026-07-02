import { getTranslations } from "next-intl/server";
export default async function ConfigurationErrorPage() {
  const t = await getTranslations("appPages");
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">{t("configuration_error")}</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">iCapOS is not configured</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Required Supabase environment variables are missing in this deployment. Protected workspaces cannot
        be secured until <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set.
      </p>
      <p className="mt-3 text-sm text-slate-500">{t("contact_your_platform_administrator_or_check_v")}</p>
    </main>
  );
}
