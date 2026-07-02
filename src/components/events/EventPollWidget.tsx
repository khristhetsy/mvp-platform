"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PollResults } from "@/lib/icfo-events/polls";

/** Attendee-facing live poll. Polls the API so a newly-launched poll appears
 *  and results update without a page reload. */
export function EventPollWidget({ slug }: { slug: string }) {
  const t = useTranslations("eventsCmp");
  const [data, setData] = useState<PollResults | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/events/${slug}/polls`);
        const json = await res.json();
        if (active) setData(json.poll ? (json as PollResults) : null);
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = setInterval(load, 15000);
    return () => { active = false; clearInterval(t); };
  }, [slug]);

  if (!data?.poll) return null;
  const { poll, counts, total, myVote } = data;

  async function vote(optionIndex: number) {
    if (voting || myVote !== null) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/events/${slug}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, optionIndex }),
      });
      const json = await res.json();
      if (json.poll) setData(json as PollResults);
    } finally {
      setVoting(false);
    }
  }

  const voted = myVote !== null;

  return (
    <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#0F6E56" }}>{t("live_poll")}</p>
      <p className="mt-1 text-sm font-medium text-[var(--navy)]">{poll.question}</p>
      <div className="mt-3 space-y-2">
        {poll.options.map((o, i) => {
          const c = counts[i] ?? 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          const mine = myVote === i;
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={voted || voting}
              className={`relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition ${
                mine ? "border-[var(--indigo)]" : "border-[var(--border-subtle)]"
              } ${voted ? "cursor-default" : "hover:border-[var(--indigo)]"}`}
            >
              {voted && (
                <span className="absolute inset-y-0 left-0 -z-0" style={{ width: `${pct}%`, background: "var(--indigo-soft)" }} aria-hidden />
              )}
              <span className="relative z-10 flex justify-between">
                <span className="text-[var(--navy)]">{o}{mine ? " ✓" : ""}</span>
                {voted && <span className="text-xs text-[var(--text-muted)]">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">{voted ? `${total} vote${total === 1 ? "" : "s"}` : "Tap an option to vote"}</p>
    </div>
  );
}
