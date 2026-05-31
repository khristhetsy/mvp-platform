export function FounderVideoScriptPanel({
  script,
  narrationText,
}: Readonly<{
  script: string | null;
  narrationText: string | null;
}>) {
  if (!script) {
    return <p className="text-sm text-slate-500">Generate a script to view the lesson narration outline.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full script</p>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-slate-800">
          {script}
        </pre>
      </div>
      {narrationText ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Narration text</p>
          <p className="mt-2 leading-6 text-slate-700">{narrationText}</p>
        </div>
      ) : null}
    </div>
  );
}
