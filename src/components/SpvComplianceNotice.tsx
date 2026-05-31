import {
  spvChecklistDisclaimers,
  spvComplianceDisclaimers,
  spvIntakeDisclaimers,
  spvClosingDisclaimers,
  spvPackageDisclaimers,
  spvUploadDisclaimers,
} from "@/lib/compliance";

export function SpvComplianceNotice({
  showChecklistNotice = false,
  showIntakeNotice = false,
  showUploadNotice = false,
  showPackageNotice = false,
  showClosingNotice = false,
}: Readonly<{
  showChecklistNotice?: boolean;
  showIntakeNotice?: boolean;
  showUploadNotice?: boolean;
  showPackageNotice?: boolean;
  showClosingNotice?: boolean;
}>) {
  const lines = [
    ...spvComplianceDisclaimers,
    ...(showChecklistNotice ? spvChecklistDisclaimers : []),
    ...(showIntakeNotice ? spvIntakeDisclaimers : []),
    ...(showUploadNotice ? spvUploadDisclaimers : []),
    ...(showPackageNotice ? spvPackageDisclaimers : []),
    ...(showClosingNotice ? spvClosingDisclaimers : []),
  ];

  const title = showClosingNotice
    ? "SPV participation & operational closing notice"
    : showPackageNotice
    ? "SPV participation & document package notice"
    : showUploadNotice
      ? "SPV participation & document upload notice"
      : showIntakeNotice
        ? "SPV participation & document intake notice"
        : showChecklistNotice
          ? "SPV participation & checklist notice"
          : "SPV participation notice";

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {lines.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </section>
  );
}
