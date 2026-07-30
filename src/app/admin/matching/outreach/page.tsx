import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Outreach Approvals moved into Admin → Feature Controls.
export default async function AdminInvestorOutreachPage() {
  redirect("/admin/feature-controls");
}
