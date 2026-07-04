import { redirect } from "next/navigation";

// Relocated into the Marketing Hub Prospects wizard.
export default function LegacyAudienceRedirect() {
  redirect("/admin/marketing/prospects?step=approach");
}
