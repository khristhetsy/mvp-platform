import { redirect } from "next/navigation";

// Relocated into the Marketing Hub Prospects wizard.
export default function LegacyVerifyRedirect() {
  redirect("/admin/marketing/prospects?step=verify");
}
