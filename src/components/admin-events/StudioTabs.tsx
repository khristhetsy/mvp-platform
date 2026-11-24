import Link from "next/link";

export type StudioTab = "spotlight" | "talk-show";

const TABS: { key: StudioTab; label: string; href: string }[] = [
  { key: "spotlight", label: "Founder Spotlight", href: "/admin/studio/spotlight" },
  { key: "talk-show", label: "Talk Show", href: "/admin/studio/talk-show" },
];

/** The three Studio tabs, named like the public event page tabs. Each one
 *  keeps the chosen event in the link. */
export function StudioTabs({ current, eventId }: { current: StudioTab; eventId?: string | null }) {
  const query = eventId ? `?event=${eventId}` : "";
  return (
    <nav aria-label="Studio" className="flex flex-wrap gap-1.5 rounded-xl bg-[#0A1A40] p-2">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href + query}
          aria-current={t.key === current ? "page" : undefined}
          className={`rounded-lg px-4 py-2 text-sm ${t.key === current ? "bg-[#1A6CE4] font-semibold text-white" : "text-white/75 hover:bg-white/10"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
