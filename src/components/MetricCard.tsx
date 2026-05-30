export function MetricCard({
  label,
  value,
  detail,
  accent = "indigo",
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  accent?: "indigo" | "violet" | "blue" | "slate";
}>) {
  const accentBar = {
    indigo: "from-indigo-500 to-violet-500",
    violet: "from-violet-500 to-purple-500",
    blue: "from-blue-500 to-indigo-500",
    slate: "from-slate-400 to-slate-500",
  }[accent];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className={`h-1 bg-gradient-to-r ${accentBar}`} />
      <div className="p-5">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
    </div>
  );
}
