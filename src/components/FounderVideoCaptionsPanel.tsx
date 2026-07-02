import { useTranslations } from "next-intl";
export function FounderVideoCaptionsPanel({ captions }: Readonly<{ captions: string | null }>) {
  const t = useTranslations("sharedCmp");
  if (!captions) {
    return <p className="text-sm text-slate-500">{t("captions_will_appear_after_script_generation")}</p>;
  }

  return (
    <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
      {captions}
    </pre>
  );
}
