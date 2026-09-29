"use client";

import { useState } from "react";
import type { Attendee, EventAttendees as Data } from "@/lib/icfo-events/attendees";

/** Chips at rest. Beyond this the group offers the four-column list instead. */
const CHIP_LIMIT = 8;

function initials(name: string): string {
  return name.split(/\s+/).filter((w) => /[a-z]/i.test(w)).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

function Avatar({ investor, text }: Readonly<{ investor: boolean; text: string }>) {
  return (
    <span className={`flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full text-[8.2px] font-extrabold ${
      investor ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
    }`}>
      {text}
    </span>
  );
}

/**
 * One group — investors or founders.
 *
 * Collapsed it is chips, which suit a handful of names. Expanded it becomes a
 * four-column list, because a hundred pills is not a list. Each group expands
 * on its own: opening the investors shouldn't disturb four founders that
 * already fit.
 */
function Group({ label, people }: Readonly<{ label: string; people: Attendee[] }>) {
  const [open, setOpen] = useState(false);
  if (people.length === 0) return null;

  const investor = label === "Investors";
  // A group that already shows everyone never offers to show more.
  const overflows = people.length > CHIP_LIMIT;
  const chips = overflows ? people.slice(0, CHIP_LIMIT) : people;

  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-baseline gap-2">
        <p className="text-[10.4px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">{label}</p>
        <span className="text-[10.4px] text-slate-300">{people.length}</span>
        {open ? (
          <button type="button" onClick={() => setOpen(false)}
            className="ml-auto text-[11.5px] font-semibold text-[var(--blue)] hover:underline">
            Collapse ↑
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {people.map((a) => (
            <span key={`${label}-${a.name}`} className="flex min-w-0 items-center gap-2 py-1">
              <Avatar investor={investor} text={initials(a.name)} />
              {/* Ellipsis rather than wrap, so rows stay aligned across columns. */}
              <span className="min-w-0 flex-1 truncate text-[12.3px] text-slate-800">{a.name}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((a) => (
            <span key={`${label}-${a.name}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white py-1 pl-1 pr-2.5 text-[11.8px] text-slate-800">
              <Avatar investor={investor} text={initials(a.name)} />
              {a.name}
              {/* The badge is worth repeating on a chip and not in the expanded
                  list, where the heading and the avatar colour already say it. */}
              <span className={`rounded px-1.5 py-px text-[8.4px] font-extrabold uppercase tracking-wide ${
                investor ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
              }`}>
                {a.badge}
              </span>
            </span>
          ))}
          {overflows ? (
            <button type="button" onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50/60 px-3 py-1 text-[11.7px] font-semibold text-[var(--blue)] hover:bg-sky-50">
              Show all {people.length} ↓
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Who's attending — name and badge, nothing else.
 *
 * Everyone registered as an investor or a founder is named; registration is
 * the qualifier.
 */
export function EventAttendees({ data }: Readonly<{ data: Data }>) {
  if (data.investors.length === 0 && data.founders.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--navy)]">Who&rsquo;s attending</h2>
        <span className="text-[11.6px] text-[var(--text-muted)]">{data.total} registered</span>
      </div>

      <Group label="Investors" people={data.investors} />
      <Group label="Founders" people={data.founders} />
    </section>
  );
}
