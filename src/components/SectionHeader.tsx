export function SectionHeader({
  eyebrow,
  title,
  description,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
}>) {
  return (
    <div>
      {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p> : null}
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
      {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">{description}</p> : null}
    </div>
  );
}
