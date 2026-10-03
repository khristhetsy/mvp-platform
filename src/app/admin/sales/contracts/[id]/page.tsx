import { redirect } from "next/navigation";

// The template send flow was retired (Oct 3, 2026): contracts are uploaded
// manually on Sales Hub › Contracts and sent through e-signature.
export default function RetiredContractsPage() {
  redirect("/admin/sales/contracts");
}
