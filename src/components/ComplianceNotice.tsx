import { complianceDisclaimers } from "@/lib/compliance";

export function ComplianceNotice() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-semibold">Important compliance notice</h2>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {complianceDisclaimers.map((disclaimer) => (
          <li key={disclaimer}>• {disclaimer}</li>
        ))}
      </ul>
    </section>
  );
}
