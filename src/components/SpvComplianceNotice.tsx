import { spvComplianceDisclaimers } from "@/lib/compliance";

export function SpvComplianceNotice() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-semibold">SPV participation notice</h2>
      <ul className="mt-3 space-y-2">
        {spvComplianceDisclaimers.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </section>
  );
}
