"use client";

import { useState } from "react";
import Link from "next/link";
import { Presentation, Users, Tv, Store } from "lucide-react";
import { venueZones } from "@/lib/icfo-events/venue";
import { useEventPresence } from "@/components/events/EventPresenceProvider";
import styles from "./LobbyHall.module.css";

type DoorDef = {
  key: string;
  room: "Main Stage" | "Networking" | "On-Demand" | "Sponsor Hall";
  label: string;
  Icon: typeof Presentation;
  meta: (n: number) => { text: string; color: string };
};

const DOORS: DoorDef[] = [
  { key: "sessions", room: "Main Stage", label: "SESSIONS", Icon: Presentation, meta: (n) => ({ text: `${n} watching`, color: "#A32D2D" }) },
  { key: "networking", room: "Networking", label: "NETWORKING", Icon: Users, meta: (n) => ({ text: `${n} here · tables open`, color: "#0F6E56" }) },
  { key: "ondemand", room: "On-Demand", label: "ON-DEMAND", Icon: Tv, meta: (n) => ({ text: `${n} browsing`, color: "#185FA5" }) },
  { key: "sponsors", room: "Sponsor Hall", label: "EXPO HALL", Icon: Store, meta: (n) => ({ text: `${n} at booths`, color: "#534AB7" }) },
];

const FIGS = ["#34507a", "#5DCAA5", "#85B7EB", "#AFA9EC", "#F0997B", "#9FE1CB", "#534AB7"];
const FIG_POS = [
  { left: -120, top: 60, z: 20, s: 1 },
  { left: 80, top: 70, z: 40, s: 1.1 },
  { left: -40, top: 48, z: -60, s: 1 },
  { left: 150, top: 52, z: -30, s: 1 },
  { left: -170, top: 78, z: 55, s: 1.15 },
  { left: 20, top: 40, z: -110, s: 1 },
  { left: 210, top: 74, z: 50, s: 1 },
];

export function LobbyHall({
  slug,
  eventTitle,
  tracksHref,
}: {
  slug: string;
  eventTitle: string;
  tracksHref?: string;
}) {
  const { byRoom, total } = useEventPresence();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const hrefFor = (key: string) => venueZones(slug, tracksHref).find((z) => z.key === key)?.href ?? `/events/${slug}`;

  return (
    <div>
      <div className={styles.hall}>
        <div className={styles.youHere}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "#5DCAA5" }} />
          You are here · Lobby
        </div>
        <div className={styles.countPill}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "#5DCAA5" }} />
          {total} in the venue
        </div>

        <div className={styles.room}>
          <div className={`${styles.face} ${styles.ceil}`} aria-hidden />
          <div className={`${styles.face} ${styles.floor}`} aria-hidden />
          <div className={`${styles.face} ${styles.lwall}`} aria-hidden>
            <span className={styles.tier}>PLATINUM</span>
            <span className={styles.tierName}>Presenting partners</span>
          </div>
          <div className={`${styles.face} ${styles.rwall}`} aria-hidden>
            <span className={styles.tier}>GOLD</span>
            <span className={styles.tierName}>Sponsors</span>
          </div>

          <div className={`${styles.face} ${styles.back}`}>
            <div className={styles.banner}>
              <p className={styles.bannerEy}>WELCOME TO</p>
              <p className={styles.bannerTitle}>{eventTitle}</p>
            </div>
            <div className={styles.doors}>
              {DOORS.map((d) => {
                const n = byRoom[d.room] ?? 0;
                const meta = d.meta(n);
                const open = openKey === d.key;
                return (
                  <div
                    key={d.key}
                    className={`${styles.door} ${open ? styles.doorOpen : ""}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${d.label} — ${meta.text}`}
                    onClick={() => setOpenKey(open ? null : d.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenKey(open ? null : d.key);
                      }
                    }}
                  >
                    <div className={styles.pop}>
                      <div className={styles.popCard}>
                        <p className={styles.popTitle}>{d.label.charAt(0) + d.label.slice(1).toLowerCase()}</p>
                        <p className={styles.popMeta} style={{ color: meta.color }}>{meta.text}</p>
                        <Link href={hrefFor(d.key)} className={styles.enter}>Enter ↗</Link>
                      </div>
                    </div>
                    <div className={styles.scr}>
                      <d.Icon style={{ width: 20, height: 20 }} aria-hidden />
                    </div>
                    <p className={styles.doorLabel}>{d.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {FIG_POS.map((p, i) => (
            <div
              key={i}
              className={styles.fig}
              aria-hidden
              style={{ left: p.left, top: p.top, transform: `translateZ(${p.z}px) scale(${p.s})` }}
            >
              <span className={styles.figH} style={{ background: FIGS[i % FIGS.length] }} />
              <span className={styles.figB} style={{ background: FIGS[i % FIGS.length] }} />
            </div>
          ))}
          <div className={styles.desk}>HELP &amp; INFO DESK</div>
        </div>
      </div>
      <p className={styles.caption} style={{ color: "var(--text-muted)" }}>
        Hover or tap a doorway to look inside, then enter.
      </p>
    </div>
  );
}
