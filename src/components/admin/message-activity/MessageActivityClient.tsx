"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MetricCard } from "@/components/MetricCard";
import { OdooPager } from "@/components/admin/OdooPager";
import { WorkspaceSection } from "@/components/admin/company-workspace/WorkspaceSection";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import {
  MESSAGE_TZ,
  MESSAGE_TZ_LABEL,
  METRICS,
  PERIOD_KINDS,
  PREVIOUS_LABEL,
  addDays,
  daysBetween,
  RECEIVED_COLUMNS,
  SENT_COLUMNS,
  changeVs,
  fmtGoal,
  goalForRange,
  higherIsBetter,
  inRange,
  metricItems,
  metricValue,
  localDay,
  localTime,
  periodLabel,
  receivedType,
  shiftAnchor,
  shortDay,
  sourceLabel,
  type DayRange,
  type GoalEntry,
  type MessageActivityData,
  type MessagePerson,
  type MetricDef,
  type PeriodKind,
  type ReceivedItem,
  type ReceivedType,
  type SentItem,
  type SentKind,
} from "@/lib/analytics/message-activity-metrics";
import { ActivityChart } from "./ActivityChart";
import { ItemDialogs, type OpenList } from "./ItemDialogs";

const PERIOD_LABEL: Record<PeriodKind, string> = {
  day: "Daily", week: "Weekly", month: "Monthly", quarter: "Quarterly", year: "Annually", custom: "Custom",
};

type Audience = "founder" | "investor" | "all";
type PlanFilter = "all" | "professional" | "basic" | "free";

type Row = {
  person: MessagePerson;
  received: ReceivedItem[];
  sent: SentItem[];
  last: string;
};

export function MessageActivityClient({
  data,
  goals,
  goalsTableMissing,
  kind,
  anchor,
  range,
  previous,
  today,
  canEditGoals,
}: Readonly<{
  data: MessageActivityData;
  goals: GoalEntry[];
  goalsTableMissing: boolean;
  kind: PeriodKind;
  anchor: string;
  range: DayRange;
  previous: DayRange;
  today: string;
  canEditGoals: boolean;
}>) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("founder");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(range.start);
  const [to, setTo] = useState(range.end);
  const [list, setList] = useState<OpenList | null>(null);

  const people = useMemo(() => new Map(data.people.map((p) => [p.key, p])), [data.people]);

  const go = (next: { p?: PeriodKind; a?: string; from?: string; to?: string }) => {
    const p = next.p ?? kind;
    const qs = new URLSearchParams({ p });
    if (p === "custom") {
      qs.set("from", next.from ?? range.start);
      qs.set("to", next.to ?? range.end);
    } else {
      qs.set("a", next.a ?? anchor);
    }
    router.push(`/admin/message-activity?${qs.toString()}`);
  };

  // A period still in progress is compared like for like: the same number of days
  // of the previous period, and the goal prorated only up to today.
  const inProgress = range.end > today && range.start <= today;
  const elapsed = inProgress ? daysBetween(range.start, today) : daysBetween(range.start, range.end);
  const compareTo = useMemo<DayRange>(
    () => (inProgress ? { start: previous.start, end: addDays(previous.start, elapsed - 1) } : previous),
    [inProgress, previous, elapsed],
  );
  const goalRange: DayRange = inProgress ? { start: range.start, end: today } : range;
  const vsText = inProgress ? `same point in ${PREVIOUS_LABEL[kind]}` : PREVIOUS_LABEL[kind];

  // Current and previous period rows, split once.
  const split = useMemo(() => {
    const cur = { received: [] as ReceivedItem[], sent: [] as SentItem[] };
    const prev = { received: [] as ReceivedItem[], sent: [] as SentItem[] };
    for (const r of data.received) {
      if (people.get(r.personKey)?.role !== "founder") continue;
      const d = localDay(r.at);
      if (inRange(d, range)) cur.received.push(r);
      else if (inRange(d, compareTo)) prev.received.push(r);
    }
    for (const s of data.sent) {
      const d = localDay(s.at);
      if (inRange(d, range)) cur.sent.push(s);
      else if (inRange(d, compareTo)) prev.sent.push(s);
    }
    return { cur, prev };
  }, [data, people, range, compareTo]);

  const month = range.end.slice(0, 7);

  const card = (m: MetricDef) => {
    const a = metricValue(m.key, split.cur);
    const p = metricValue(m.key, split.prev);
    const up = higherIsBetter(goals, m, month);
    const ch = changeVs(a, p);
    const vs = `vs ${vsText} (${p})`;
    const flag =
      ch.kind === "same"
        ? { text: `No change ${vs}` }
        : ch.kind === "new"
          ? { text: `▲ New ${vs}`, tone: up ? ("good" as const) : ("bad" as const) }
          : {
              text: `${ch.pct > 0 ? "▲ +" : "▼ "}${Math.round(ch.pct)}% ${vs}`,
              tone: (ch.pct > 0) === up ? ("good" as const) : ("bad" as const),
            };
    const g = goalForRange(goals, m.key, goalRange);
    const pct = g && g.goal > 0 ? (a / g.goal) * 100 : null;
    const items = metricItems(m.key, split.cur);
    const byType = new Map<string, number>();
    const byFounder = new Map<string, number>();
    for (const it of items) {
      const label = "channel" in it ? sourceLabel(it.source) + (it.channel === "email" ? " (email)" : "") : `${SENT_COLUMNS.find((c) => c.kind === it.kind)?.label}: ${it.status}`;
      byType.set(label, (byType.get(label) ?? 0) + 1);
      const who = people.get(it.personKey);
      const name = who?.company ?? who?.name ?? "Unknown";
      byFounder.set(name, (byFounder.get(name) ?? 0) + 1);
    }
    const top = (m2: Map<string, number>, n: number) => [...m2.entries()].sort((x, y) => y[1] - x[1]).slice(0, n);
    return (
      <MetricCard
        key={m.key}
        label={m.label}
        value={String(a)}
        unit={g ? `of ${fmtGoal(g.goal)} goal${inProgress ? " to date" : ""}` : "no goal set"}
        detail={m.description}
        accent="blue"
        ring={
          g
            ? {
                percent: pct === null ? null : Math.min(100, pct),
                center: pct === null ? "–" : `${Math.round(pct)}%`,
                sublabel: "of goal",
                color: up ? (pct !== null && pct >= 100 ? "#15803d" : "#1A6CE4") : pct !== null && pct > 100 ? "#b91c1c" : "#15803d",
                title: `${a} of ${fmtGoal(g.goal)} goal`,
              }
            : { percent: null, pending: true, title: "No goal set for this metric" }
        }
        flag={flag}
        audience="admin"
        detailPanel={{
          note:
            (g
              ? `Goal ${fmtGoal(g.goal)} for ${inProgress ? `${periodLabel(kind, range)} up to today` : periodLabel(kind, range)}${g.coveredDays < g.totalDays ? `, covering ${g.coveredDays} of ${g.totalDays} days` : ""}. ${up ? "Higher" : "Lower"} is better.`
              : "No goal set for this metric yet.") +
            (m.key === "f_email" && range.start < data.emailLogStart ? ` Emails are logged from ${shortDay(data.emailLogStart)} ${data.emailLogStart.slice(0, 4)}.` : ""),
          breakdown: [
            ...top(byType, 6).map(([label, v]) => ({ label, value: String(v) })),
            ...top(byFounder, 5).map(([label, v]) => ({ label: `For ${label}`, value: String(v) })),
          ],
          href: "/admin/message-activity/goals",
          hrefLabel: g ? "Edit goal" : "Set goal",
        }}
      />
    );
  };

  // ── People table ────────────────────────────────────────────────────────
  const rows = useMemo<Row[]>(() => {
    const by = new Map<string, Row>();
    const get = (key: string): Row | null => {
      const person = people.get(key);
      if (!person) return null;
      let r = by.get(key);
      if (!r) {
        r = { person, received: [], sent: [], last: "" };
        by.set(key, r);
      }
      return r;
    };
    for (const it of data.received) {
      if (!inRange(localDay(it.at), range)) continue;
      const r = get(it.personKey);
      if (r) { r.received.push(it); if (it.at > r.last) r.last = it.at; }
    }
    for (const it of data.sent) {
      if (!inRange(localDay(it.at), range)) continue;
      const r = get(it.personKey);
      if (r) { r.sent.push(it); if (it.at > r.last) r.last = it.at; }
    }
    return [...by.values()].sort((a, b) => b.received.length + b.sent.length - (a.received.length + a.sent.length));
  }, [data, people, range]);

  const filtered = rows.filter(
    (r) => (audience === "all" || r.person.role === audience) && (plan === "all" || r.person.planGroup === plan),
  );
  const fields: SearchField<Row>[] = [
    { label: "company", get: (r) => r.person.company },
    { label: "name", get: (r) => r.person.name },
    { label: "email", get: (r) => r.person.email },
    { label: "plan", get: (r) => r.person.plan },
  ];
  const result = matchRows(filtered, fields, query);

  const openReceived = (person: MessagePerson | null, type: ReceivedType | "all") => {
    const col = RECEIVED_COLUMNS.find((c) => c.type === type);
    const src = person ? rows.find((r) => r.person.key === person.key)?.received ?? [] : result.rows.flatMap((r) => r.received);
    setList({
      title: type === "all" ? "Everything received" : col?.label ?? "",
      person,
      side: "received",
      received: (type === "all" ? src : src.filter((i) => receivedType(i) === type)).sort((a, b) => (a.at < b.at ? 1 : -1)),
      sent: [],
    });
  };
  const openSent = (person: MessagePerson | null, k: SentKind | "all") => {
    const col = SENT_COLUMNS.find((c) => c.kind === k);
    const src = person ? rows.find((r) => r.person.key === person.key)?.sent ?? [] : result.rows.flatMap((r) => r.sent);
    setList({
      title: k === "all" ? "Everything sent to investors" : col?.label ?? "",
      person,
      side: "sent",
      received: [],
      sent: (k === "all" ? src : src.filter((i) => i.kind === k)).sort((a, b) => (a.at < b.at ? 1 : -1)),
    });
  };

  const cell = (n: number, onClick: () => void, strong = false) =>
    n ? (
      <button
        type="button"
        onClick={onClick}
        className={`tabular-nums underline decoration-dotted underline-offset-4 hover:text-[#2E78F5] ${strong ? "font-semibold text-slate-950" : "text-[#1A6CE4]"}`}
        aria-label={`View ${n} items`}
      >
        {n}
      </button>
    ) : (
      <span className="tabular-nums text-slate-300">0</span>
    );

  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap";
  const thN = `${th} text-right`;
  const colHead = (label: string, onClick: () => void, extra = "", key = label) => (
    <th key={key} className={`${thN} ${extra}`}>
      <button type="button" onClick={onClick} className="uppercase tracking-[0.06em] underline decoration-dotted underline-offset-4 hover:text-[#1A6CE4]" title={`View all ${label.toLowerCase()} in this period`}>
        {label}
      </button>
    </th>
  );

  const seg = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium ${active ? "bg-[#1A6CE4] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`;

  return (
    <div className="px-1">
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Analytics</p>
          <h1 className="mt-0.5 text-[22px] font-medium tracking-tight text-slate-950">Founder and investor messages</h1>
          <p className="mt-1 text-xs text-slate-500">
            What iCapOS sent to founders, and to investors on their behalf. All times are {MESSAGE_TZ_LABEL}. Loaded {new Date(data.generatedAt).toLocaleTimeString("en-US", { timeZone: MESSAGE_TZ, hour: "numeric", minute: "2-digit" })}.
          </p>
        </div>
        <Link href="/admin/message-activity/goals" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <i className="ti ti-target mr-1" aria-hidden="true" />
          Goals
        </Link>
      </div>

      {/* Period */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Period">
          {PERIOD_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={k === kind} onClick={() => go({ p: k, a: today })} className={seg(k === kind)}>
              {PERIOD_LABEL[k]}
            </button>
          ))}
        </div>
        {kind === "custom" ? (
          <form
            className="flex flex-wrap items-center gap-2 text-xs text-slate-600"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to) go({ p: "custom", from: from <= to ? from : to, to: from <= to ? to : from });
            }}
          >
            <label htmlFor="ma-from">From</label>
            <input id="ma-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1" />
            <label htmlFor="ma-to">To</label>
            <input id="ma-to" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1" />
            <button type="submit" className="rounded-lg bg-[#1A6CE4] px-3 py-1 font-semibold text-white hover:bg-[#2E78F5]">Apply</button>
          </form>
        ) : (
          <>
            <OdooPager
              label={periodLabel(kind, range)}
              prev={{ onClick: () => go({ a: shiftAnchor(kind, anchor, -1) }), title: "Previous period" }}
              next={{ onClick: () => go({ a: shiftAnchor(kind, anchor, 1) }), disabled: range.end >= today, title: "Next period" }}
            />
            {range.end < today ? (
              <button type="button" onClick={() => go({ a: today })} className="text-xs font-semibold text-[#1A6CE4] hover:underline">
                Back to current
              </button>
            ) : null}
          </>
        )}
      </div>

      {goalsTableMissing ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Goals aren&apos;t available yet: the message_activity_goals migration hasn&apos;t been applied.
        </p>
      ) : null}

      <div className="mb-6">
        <WorkspaceSection
          icon="ti-inbox"
          tone="blue"
          title="Received by founders"
          subtitle={`${new Set(split.cur.received.map((r) => r.personKey)).size} founders · ${split.cur.received.length} items · ${periodLabel(kind, range)}`}
          action={canEditGoals ? <Link href="/admin/message-activity/goals" className="text-xs font-semibold text-[#1A6CE4] hover:underline">Set goals</Link> : null}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:h-full">
            {METRICS.filter((m) => m.group === "received").map(card)}
          </div>
        </WorkspaceSection>
      </div>

      <div className="mb-6">
        <WorkspaceSection
          icon="ti-send"
          tone="teal"
          title="Sent to investors"
          subtitle={`On founders' behalf · ${split.cur.sent.length} items · ${periodLabel(kind, range)}`}
          action={canEditGoals ? <Link href="/admin/message-activity/goals" className="text-xs font-semibold text-[#1A6CE4] hover:underline">Set goals</Link> : null}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 [&>*]:h-full">
            {METRICS.filter((m) => m.group === "sent").map(card)}
          </div>
        </WorkspaceSection>
      </div>

      <div className="mb-6">
        <WorkspaceSection icon="ti-chart-bar" tone="purple" title="Charts" subtitle="Founders or investors, over time, by company or by type">
          <ActivityChart kind={kind} range={range} received={split.cur.received} sent={split.cur.sent} people={people} />
        </WorkspaceSection>
      </div>

      <div className="mb-6">
        <WorkspaceSection icon="ti-users" tone="gray" title="By person" subtitle="Tap any number to see the items behind it">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Who">
              {(["founder", "investor", "all"] as Audience[]).map((a) => (
                <button key={a} type="button" aria-pressed={audience === a} onClick={() => setAudience(a)} className={seg(audience === a)}>
                  {a === "founder" ? "Founders" : a === "investor" ? "Investors" : "All"}
                </button>
              ))}
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Plan">
              {(["all", "professional", "basic", "free"] as PlanFilter[]).map((p) => (
                <button key={p} type="button" aria-pressed={plan === p} onClick={() => setPlan(p)} className={seg(plan === p)}>
                  {p === "all" ? "All plans" : p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, name, email or plan"
              aria-label="Search people"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700"
            />
          </div>
          <SearchCount result={result} noun="people" className="mb-2" />

          {result.active && result.rows.length === 0 ? (
            <NoSearchMatches query={query} fields={fields.map((f) => f.label)} onClear={() => setQuery("")} />
          ) : result.rows.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
              Nothing was sent to {audience === "investor" ? "investors" : "founders"} in this period.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1100px] border-collapse text-[13px]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th colSpan={4} />
                    <th colSpan={7} className="border-l border-slate-200 px-3 pt-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[#185FA5]">Received</th>
                    <th colSpan={4} className="border-l border-slate-200 px-3 pt-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[#0F6E56]">Sent to investors</th>
                  </tr>
                  <tr>
                    <th className={`${th} sticky left-0 bg-slate-50`}>Company</th>
                    <th className={th}>Name</th>
                    <th className={th}>Plan</th>
                    <th className={th}>Last activity</th>
                    {RECEIVED_COLUMNS.map((c, i) => colHead(c.short, () => openReceived(null, c.type), i === 0 ? "border-l border-slate-200" : ""))}
                    {colHead("Total", () => openReceived(null, "all"), "", "received-total")}
                    {SENT_COLUMNS.map((c, i) => colHead(c.short, () => openSent(null, c.kind), i === 0 ? "border-l border-slate-200" : ""))}
                    {colHead("Total", () => openSent(null, "all"), "", "sent-total")}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.person.key} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-slate-900">
                        <Highlight text={r.person.company ?? "No company on file"} query={query} />
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-slate-900"><Highlight text={r.person.name} query={query} /></span>
                        {r.person.name !== r.person.email ? (
                          <span className="block font-mono text-[11px] text-slate-500"><Highlight text={r.person.email} query={query} /></span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        <Highlight text={r.person.role === "investor" ? "Investor" : r.person.plan} query={query} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {shortDay(localDay(r.last))}
                        <span className="block font-mono text-[11px] text-slate-500">
                          {localTime(r.last)}
                        </span>
                      </td>
                      {RECEIVED_COLUMNS.map((c, i) => (
                        <td key={c.type} className={`px-3 py-2 text-right ${i === 0 ? "border-l border-slate-100" : ""}`}>
                          {cell(r.received.filter((x) => receivedType(x) === c.type).length, () => openReceived(r.person, c.type))}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">{cell(r.received.length, () => openReceived(r.person, "all"), true)}</td>
                      {SENT_COLUMNS.map((c, i) => (
                        <td key={c.kind} className={`px-3 py-2 text-right ${i === 0 ? "border-l border-slate-100" : ""}`}>
                          {cell(r.sent.filter((x) => x.kind === c.kind).length, () => openSent(r.person, c.kind))}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        {cell(r.sent.length, () => openSent(r.person, "all"), true)}
                        {data.queued[r.person.key] ? (
                          <span className="block text-[11px] text-slate-500">{data.queued[r.person.key]} queued</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-500">
            Sources: email_log, notifications, investor_outreach_recipients, founder_manual_outreach_recipients, prospect_intro_requests.
            Emails are logged from {shortDay(data.emailLogStart)} {data.emailLogStart.slice(0, 4)}. Marketing emails to people without an iCapOS account are not included.
          </p>
        </WorkspaceSection>
      </div>

      <ItemDialogs list={list} onClose={() => setList(null)} people={people} periodText={periodLabel(kind, range)} />
    </div>
  );
}
