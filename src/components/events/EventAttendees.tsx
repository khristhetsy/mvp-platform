import type { Attendee, EventAttendees as Data } from "@/lib/icfo-events/attendees";

function initials(name: string): string {
  return name.split(/\s+/).filter((w) => /[a-z]/i.test(w)).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

function Chip({ a }: Readonly<{ a: Attendee }>) {
  const investor = a.badge === "Investor";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white py-1 pl-1 pr-2.5 text-[11.8px] text-slate-800">
      <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-slate-100 text-[8.2px] font-extrabold text-slate-500">
        {initials(a.name)}
      </span>
      {a.name}
      <span className={`rounded px-1.5 py-px text-[8.4px] font-extrabold uppercase tracking-wide ${
        investor ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
      }`}>
        {a.badge}
      </span>
    </span>
  );
}

function Group({ label, people, hidden }: Readonly<{ label: string; people: Attendee[]; hidden: number }>) {
  if (people.length === 0 && hidden === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[10.2px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
        {label} · {people.length + hidden}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {people.map((a) => <Chip key={`${a.badge}-${a.name}`} a={a} />)}
        {hidden > 0 ? (
          <span className="inline-flex items-center rounded-full border border-dashed border-slate-300 bg-slate-50/60 px-2.5 py-1 text-[11.6px] text-slate-400">
            + {hidden} attending privately
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Who's attending — name and badge, nothing else.
 *
 * The dashed chip is the point: it says how many more are coming without
 * naming anyone who didn't agree to be named. A signed-in registrant sees
 * everybody, so for them it disappears on its own.
 */
export function EventAttendees({ data, viewerIsRegistered }: Readonly<{
  data: Data;
  viewerIsRegistered: boolean;
}>) {
  const named = data.investors.length + data.founders.length;
  const hidden = data.privateInvestors + data.privateFounders;
  if (named === 0 && hidden === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--navy)]">Who&rsquo;s attending</h2>
        <span className="text-[11.6px] text-[var(--text-muted)]">{data.total} registered</span>
      </div>

      <Group label="Investors" people={data.investors} hidden={data.privateInvestors} />
      <Group label="Founders" people={data.founders} hidden={data.privateFounders} />

      {!viewerIsRegistered && hidden > 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5 text-[11.8px] text-[var(--text-secondary)]">
          Register to see everyone attending.
        </p>
      ) : null}
    </section>
  );
}
