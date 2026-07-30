import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Outreach Approvals moved into Admin → Investor Relations → Outreach Qualification.
export default async function AdminInvestorOutreachPage() {
  redirect("/admin/outreach-qualification");
}
