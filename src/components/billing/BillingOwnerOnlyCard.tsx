import { getTranslations } from "next-intl/server";

/** Shown instead of the billing page to anyone who is not the account Owner. */
export async function BillingOwnerOnlyCard() {
  const t = await getTranslations("appPages");
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-slate-900">{t("billing_owner_only_title")}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t("billing_owner_only_body")}</p>
    </section>
  );
}
