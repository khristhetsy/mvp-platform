import { useTranslations } from "next-intl";
export function FounderVideoScriptPanel({
  script,
  narrationText,
}: Readonly<{
  script: string | null;
  narrationText: string | null;
}>) {
  const t = useTranslations("sharedCmp");
  if (!script) {
    return <p className="text-sm text-slate-500">{t("generate_a_script_to_view_the_lesson_narrati")}</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("full_script")}</p>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-slate-800">
          {script}
        </pre>
      </div>
      {narrationText ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("narration_text")}</p>
          <p className="mt-2 leading-6 text-slate-700">{narrationText}</p>
        </div>
      ) : null}
    </div>
  );
}
