"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Presentation, Users, Tv, Store, Mic, Trophy, Home, Calendar,
  User as UserIcon, CalendarDays, MessageSquare, Bell,
  type LucideIcon,
} from "lucide-react";
import { venueZones, type VenueZone } from "@/lib/icfo-events/venue";
import { useEventPresence, type PresenceMember } from "@/components/events/EventPresenceProvider";
import type { EventSession } from "@/lib/icfo-events/types";
import styles from "./LobbyHall.module.css";

const initials = (n: string) => n.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

type DoorDef = {
  key: string;
  room?: "Main Stage" | "Networking" | "On-Demand" | "Sponsor Hall";
  label: string;
  Icon: LucideIcon;
  left: number; // % across the floor
  top: number;
  meta: (n: number) => string;
};

// Two rows spread across the floor; the Help Desk sits centered between them.
const DOORS: DoorDef[] = [
  { key: "sessions", room: "Main Stage", label: "SESSIONS", Icon: Presentation, left: 16, top: 40, meta: (n) => `${n} watching` },
  { key: "talkshow", room: "Main Stage", label: "TALK SHOW", Icon: Mic, left: 50, top: 40, meta: (n) => (n > 0 ? `${n} watching` : "live soon") },
  { key: "networking", room: "Networking", label: "NETWORKING", Icon: Users, left: 84, top: 40, meta: (n) => `${n} here · tables open` },
  { key: "ondemand", room: "On-Demand", label: "ON-DEMAND", Icon: Tv, left: 16, top: 68, meta: (n) => `${n} browsing` },
  { key: "sponsors", room: "Sponsor Hall", label: "EXPO HALL", Icon: Store, left: 50, top: 68, meta: (n) => `${n} at booths` },
  { key: "leaderboard", label: "LEADERBOARD", Icon: Trophy, left: 84, top: 68, meta: () => "See standings" },
];

const NAV_ICONS: Record<VenueZone["icon"], LucideIcon> = {
  home: Home, stage: Presentation, users: Users, tv: Tv, store: Store, calendar: Calendar, trophy: Trophy,
};
const QL_ICONS: Record<string, LucideIcon> = {
  profile: UserIcon, calendar: CalendarDays, message: MessageSquare, bell: Bell,
};

const FIGS = ["#34507a", "#5DCAA5", "#85B7EB", "#AFA9EC", "#F0997B", "#9FE1CB", "#2E78F5", "#c05a8a", "#3ba05a", "#7a5230"];
const FIG_POS = [
  { l: 20, t: 58 }, { l: 33, t: 42 }, { l: 47, t: 34 }, { l: 57, t: 46 }, { l: 63, t: 36 },
  { l: 70, t: 56 }, { l: 30, t: 66 }, { l: 52, t: 60 }, { l: 43, t: 48 }, { l: 66, t: 64 },
];

const SIGNS: { text: string; key: "sessions" | "sponsors" | "help"; left: number; top: number }[] = [
  { text: "◄ SESSIONS", key: "sessions", left: 30, top: 54 },
  { text: "EXPO HALL ►", key: "sponsors", left: 70, top: 54 },
  { text: "HELP DESK ►", key: "help", left: 63, top: 55 },
];

export type QuickLink = { label: string; href: string; icon: keyof typeof QL_ICONS };

export function LobbyHall({
  slug,
  eventTitle,
  tracksHref,
  sessions = [],
  timezone,
  viewerName,
  viewerRole,
  quickLinks,
  backgroundUrl,
}: {
  slug: string;
  eventTitle: string;
  tracksHref?: string;
  sessions?: EventSession[];
  timezone?: string | null;
  viewerName?: string | null;
  viewerRole?: string | null;
  quickLinks?: QuickLink[];
  backgroundUrl?: string | null;
}) {
  const t = useTranslations("eventsCmp");
  const { byRoom, total, members, me, announcement, incomingWave, dismissWave, sendWave } = useEventPresence();
  const [sel, setSel] = useState<{ member: PresenceMember; x: number; y: number } | null>(null);
  // The YOU marker walks to a hovered booth; clicking the doorway enters the room.
  const [youPos, setYouPos] = useState<{ left: number; top: number }>({ left: 50, top: 82 });
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const walkTo = (left: number, top: number) => setYouPos({ left, top: top + 9 });

  // Other attendees standing in the Lobby become the drifting figures (the
  // viewer is drawn separately as the fixed "you" marker).
  const others = members.filter((m) => m.room === "Lobby" && m.id !== me.id).slice(0, FIG_POS.length);

  useEffect(() => {
    if (!incomingWave) return;
    const id = setTimeout(dismissWave, 3600);
    return () => clearTimeout(id);
  }, [incomingWave, dismissWave]);

  const tickerItems = [
    ...(announcement ? [`${announcement.title}`] : []),
    ...DOORS.filter((d) => d.room).map((d) => `${cap(d.label)} — ${d.meta(byRoom[d.room as string] ?? 0)}`),
  ];
  const hrefFor = (key: string) => venueZones(slug, tracksHref).find((z) => z.key === key)?.href ?? `/events/${slug}`;

  const fmtTime = (iso: string | null) => {
    if (!iso) return "TBA";
    try {
      return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone || undefined }).format(new Date(iso));
    } catch {
      return "TBA";
    }
  };
  const byTime = (a: EventSession, b: EventSession) => {
    const ta = a.startsAt ? Date.parse(a.startsAt) : Infinity;
    const tb = b.startsAt ? Date.parse(b.startsAt) : Infinity;
    return (ta - tb) || (a.position - b.position);
  };
  const agenda = [...sessions].sort(byTime).slice(0, 6);
  const upcoming = sessions.filter((s) => s.status === "scheduled" || s.status === "live").sort(byTime).slice(0, 3);

  const zones = venueZones(slug, tracksHref);
  const name = viewerName || me.name || "Guest";
  const openDesk = () => window.dispatchEvent(new Event("icfo:open-info-desk"));
  const meMember: PresenceMember = { id: me.id, name, room: "Lobby" };
  const hasSide = agenda.length > 0 || Boolean(quickLinks && quickLinks.length > 0);

  return (
    <div className={styles.root}>
      {tickerItems.length > 0 && (
        <div className={styles.ticker}>
          <span className={styles.tickerLab}><span className={styles.tickerDt} aria-hidden />WHAT&apos;S ON</span>
          <div className={styles.tickerTrack}>
            <div className={styles.tickerMq}>
              {[...tickerItems, ...tickerItems].map((it, i) => (
                <span key={i} className={styles.tickerItem}>{it}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.hall}>
        <div className={styles.frame}>
        <div className={styles.stage}>
          {backgroundUrl ? (
            <>
              <div className={styles.stageBg} style={{ backgroundImage: `url("${backgroundUrl}")` }} aria-hidden />
              <div className={styles.scrim} aria-hidden />
            </>
          ) : (
            <div className={styles.gridLines} aria-hidden />
          )}

          <div className={styles.welcome}>
            <p className={styles.welcomeEy}>{t("welcome_to")}</p>
            <p className={styles.welcomeTi}>{eventTitle}</p>
          </div>

          {/* zone tiles */}
          {DOORS.map((d) => {
            const n = d.room ? byRoom[d.room] ?? 0 : 0;
            const live = Boolean(d.room && n > 0);
            return (
              <Link
                key={d.key}
                href={hrefFor(d.key)}
                className={styles.tile}
                style={{ left: `${d.left}%`, top: `${d.top}%` }}
                aria-label={`${cap(d.label)} — ${d.meta(n)}`}
                onMouseEnter={() => walkTo(d.left, d.top)}
                onFocus={() => walkTo(d.left, d.top)}
              >
                <span className={styles.tip}>{cap(d.label)} · {d.meta(n)}</span>
                <span className={styles.tileBox}>
                  <d.Icon style={{ width: 26, height: 26 }} aria-hidden />
                  {live && <span className={styles.tileHot}>● LIVE</span>}
                </span>
                <span className={styles.tileNm}>{d.label}</span>
              </Link>
            );
          })}

          {/* floating wayfinding signs */}
          {SIGNS.map((s) =>
            s.key === "help" ? (
              <button key={s.text} type="button" className={styles.sign} style={{ left: `${s.left}%`, top: `${s.top}%` }} onClick={openDesk} aria-label="Open the Help & Info Desk">
                {s.text}<span className={styles.signStem} aria-hidden />
              </button>
            ) : (
              <Link key={s.text} href={hrefFor(s.key)} className={styles.sign} style={{ left: `${s.left}%`, top: `${s.top}%` }}>
                {s.text}<span className={styles.signStem} aria-hidden />
              </Link>
            ),
          )}

          {/* help & info desk → opens the AI assistant */}
          <button type="button" className={styles.desk} onClick={openDesk}>
            <span className={styles.deskBox}><i className="ti ti-message" aria-hidden="true" /></span>
            <span className={styles.deskNm}>{t("help_info_desk")}</span>
            <br />
            <span className={styles.deskHint}><i className="ti ti-sparkles" aria-hidden="true" /> Ask AI</span>
          </button>

          <span className={styles.plant} style={{ left: "16%", top: "33%" }} aria-hidden><i className="ti ti-plant-2" aria-hidden="true" /></span>
          <span className={styles.plant} style={{ left: "82%", top: "33%" }} aria-hidden><i className="ti ti-plant" aria-hidden="true" /></span>
          <span className={styles.plant} style={{ left: "14%", top: "62%" }} aria-hidden><i className="ti ti-plant-2" aria-hidden="true" /></span>
          <span className={styles.plant} style={{ left: "84%", top: "62%" }} aria-hidden><i className="ti ti-plant-2" aria-hidden="true" /></span>

          {/* other attendees */}
          {others.map((m, i) => {
            const p = FIG_POS[i];
            return (
              <button
                key={m.id}
                type="button"
                className={styles.fig}
                aria-label={m.name}
                style={{ left: `${p.l}%`, top: `${p.t}%`, background: FIGS[i % FIGS.length], animationDelay: `${(i % 5) * 0.8}s` }}
                onClick={(e) => { e.stopPropagation(); setSel({ member: m, x: e.clientX, y: e.clientY }); }}
              >
                <span className={styles.figName}>{m.name}</span>
              </button>
            );
          })}

          {/* the viewer — walks to a clicked booth */}
          <button
            type="button"
            className={styles.you}
            style={{ left: `${youPos.left}%`, top: `${youPos.top}%` }}
            aria-label={`${name} (you)`}
            onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSel({ member: meMember, x: r.left + r.width / 2, y: r.top }); }}
          >
            <span className={styles.youHalo} aria-hidden />
            <span className={`${styles.youHalo} ${styles.youHalo2}`} aria-hidden />
          </button>
          <span className={styles.youPin} style={{ left: `${youPos.left}%`, top: `${youPos.top - 9}%` }} aria-hidden>
            <span className={styles.youChip}>YOU</span>
            <span className={styles.youTri} />
          </span>

          {/* status badges */}
          <div className={styles.youHere}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "#5DCAA5" }} />
            You are here · Lobby
          </div>
          <div className={styles.countPill}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "#5DCAA5" }} />
            {total} in the venue
          </div>

        </div>

        {hasSide && (
          <button type="button" onClick={() => setLeftOpen((v) => !v)} aria-label={leftOpen ? "Hide agenda panel" : "Show agenda panel"} aria-expanded={leftOpen}
            style={{ order: 0, flex: "0 0 auto", alignSelf: "stretch", writingMode: "vertical-rl", background: "#f7f9fc", border: "none", borderRight: "1px solid var(--line)", color: "var(--accent)", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", padding: "0 6px" }}>
            {leftOpen ? "‹ Agenda" : "Agenda ›"}
          </button>
        )}
        {hasSide && (
          <aside className={styles.sideL} style={{ flexBasis: leftOpen ? 208 : 0, paddingLeft: leftOpen ? 12 : 0, paddingRight: leftOpen ? 12 : 0, borderRightWidth: leftOpen ? 1 : 0, opacity: leftOpen ? 1 : 0, overflow: "hidden", transition: "flex-basis .35s ease, padding .35s ease, opacity .25s ease" }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setLeftOpen(false)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>‹ Hide</button>
            </div>
            {agenda.length > 0 && (
              <div className={styles.panel}>
                <p className={styles.panelTitle}>AGENDA</p>
                {agenda.map((s) => (
                  <div key={s.id} className={styles.agRow}><b>{s.title}</b><span>{fmtTime(s.startsAt)}</span></div>
                ))}
                <Link href={tracksHref ?? `/events/${slug}/tracks`} className={styles.pBtn}>View Full Agenda</Link>
              </div>
            )}
            {quickLinks && quickLinks.length > 0 && (
              <div className={styles.panel}>
                <p className={styles.panelTitle}>QUICK LINKS</p>
                {quickLinks.map((q) => {
                  const Icon = QL_ICONS[q.icon] ?? UserIcon;
                  return (
                    <Link key={q.label} href={q.href} className={styles.ql}>
                      <span className={styles.qlIc}><Icon style={{ width: 14, height: 14 }} aria-hidden /></span>
                      {q.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </aside>
        )}

        <aside className={styles.sideR} style={{ flexBasis: rightOpen ? 208 : 0, paddingLeft: rightOpen ? 12 : 0, paddingRight: rightOpen ? 12 : 0, borderLeftWidth: rightOpen ? 1 : 0, opacity: rightOpen ? 1 : 0, overflow: "hidden", transition: "flex-basis .35s ease, padding .35s ease, opacity .25s ease" }}>
          <nav className={styles.nav} aria-label="Venue navigation">
            <div className={styles.navMe}>
              <span className={styles.navAv}>{initials(name)}</span>
              <div style={{ flex: 1 }}>
                <div className={styles.navNm}>Hello, {name.split(" ")[0]}</div>
                <div className={styles.navRl}>{viewerRole || "Attendee"}</div>
              </div>
              <button type="button" onClick={() => setRightOpen(false)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Hide ›</button>
            </div>
            {zones.map((z) => {
              const Icon = NAV_ICONS[z.icon];
              const on = z.key === "lobby";
              return (
                <Link key={z.key} href={z.href} className={`${styles.navItem} ${on ? styles.navItemOn : ""}`} aria-current={on ? "page" : undefined}>
                  <span className={styles.navIc}><Icon style={{ width: 13, height: 13 }} aria-hidden /></span>
                  {z.label}
                </Link>
              );
            })}
            <Link href={`/events/${slug}`} className={styles.navLeave}>Back to event</Link>
          </nav>
          {upcoming.length > 0 && (
            <div className={styles.panel}>
              <p className={styles.panelTitle}>UPCOMING SESSIONS</p>
              {upcoming.map((s) => (
                <Link key={s.id} href={hrefFor("sessions")} className={styles.sRow}>
                  <span className={styles.sAv}>{initials(s.title)}</span>
                  <span>
                    <span className={styles.sName}>{s.title}</span>
                    <br />
                    <span className={styles.sTime}>{fmtTime(s.startsAt)}{s.endsAt ? `–${fmtTime(s.endsAt)}` : ""}</span>
                  </span>
                  <span className={styles.sJoin}>{s.status === "live" ? "LIVE" : "JOIN"}</span>
                </Link>
              ))}
              <Link href={tracksHref ?? `/events/${slug}/tracks`} className={styles.pBtn}>View All Sessions</Link>
            </div>
          )}
        </aside>
        <button type="button" onClick={() => setRightOpen((v) => !v)} aria-label={rightOpen ? "Hide menu panel" : "Show menu panel"} aria-expanded={rightOpen}
          style={{ order: 4, flex: "0 0 auto", alignSelf: "stretch", writingMode: "vertical-rl", background: "#f7f9fc", border: "none", borderLeft: "1px solid var(--line)", color: "var(--accent)", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", padding: "0 6px" }}>
          {rightOpen ? "Menu ›" : "‹ Menu"}
        </button>
        </div>

        <p className={styles.caption}>Hover or tap a doorway to look inside, then enter.</p>
      </div>

      {sel && (
        <>
          <div className={styles.figBackdrop} onClick={() => setSel(null)} aria-hidden />
          <div className={styles.profCard} style={{ left: sel.x, top: sel.y }} role="dialog">
            <div className={styles.profHd}>
              <span className={styles.profAv}>{initials(sel.member.name)}</span>
              <div>
                <p className={styles.profNm}>{sel.member.id === me.id ? `${sel.member.name} (you)` : sel.member.name}</p>
                <p className={styles.profRl}>In the Lobby</p>
              </div>
            </div>
            {sel.member.id === me.id ? (
              <p className={styles.profHint}>This is you.</p>
            ) : (
              <div className={styles.profAct}>
                <button type="button" onClick={() => { sendWave(sel.member.id, "wave"); setSel(null); }}><i className="ti ti-hand-two-fingers" aria-hidden="true" /> Wave</button>
                <button type="button" onClick={() => { sendWave(sel.member.id, "hi"); setSel(null); }}><i className="ti ti-message" aria-hidden="true" /> Say hi</button>
              </div>
            )}
          </div>
        </>
      )}

      {incomingWave && (
        <div className={styles.waveToast} role="status">
          {incomingWave.kind === "hi" ? <i className="ti ti-message" aria-hidden="true" /> : <i className="ti ti-hand-two-fingers" aria-hidden="true" />} {incomingWave.fromName}{" "}
          {incomingWave.kind === "hi" ? "says hi" : "waved at you"}
        </div>
      )}
    </div>
  );
}
