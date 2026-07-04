import { redirect } from "next/navigation";

// Relocated into the Marketing Hub Prospects wizard (classify runs as part of intake).
export default function LegacyClassifyRedirect() {
  redirect("/admin/marketing/prospects?step=approach");
}
