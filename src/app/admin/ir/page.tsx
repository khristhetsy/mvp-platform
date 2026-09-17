import { redirect } from "next/navigation";

/** Dashboard lands in Phase 3 (goals + trend + lifecycle). Until then the hub opens on Projects. */
export default function IrHubPage() {
  redirect("/admin/ir/projects");
}
