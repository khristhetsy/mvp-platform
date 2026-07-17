"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";

const NAVY = "#0A1A40", ROYAL = "#1A6CE4", TINT = "#EAF2FD", INK = "#44506B", LINE = "#D8E4F6";

type CardId = "ios" | "android" | "desktop";

// Chrome/Edge fire this before offering an install; we stash it to power a one-tap button.
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const CARDS: { id: CardId; label: string; icon: string; steps: React.ReactNode[] }[] = [
  {
    id: "ios",
    label: "iPhone & iPad",
    icon: "ti-device-mobile",
    steps: [
      <>Open <b>icapos.com</b> in <b>Safari</b>.</>,
      <>Tap the <Ui>Share ⬆</Ui> icon at the bottom of the screen.</>,
      <>Scroll down and tap <Ui>Add to Home Screen</Ui>, then <Ui>Add</Ui>. The iCapOS icon appears like any other app.</>,
    ],
  },
  {
    id: "android",
    label: "Android",
    icon: "ti-device-mobile-message",
    steps: [
      <>Open <b>icapos.com</b> in <b>Chrome</b>.</>,
      <>Tap the <Ui>⋮ menu</Ui> in the top-right corner.</>,
      <>Tap <Ui>Add to Home screen</Ui> — or <Ui>Install app</Ui> if Chrome offers it.</>,
    ],
  },
  {
    id: "desktop",
    label: "PC & Mac",
    icon: "ti-device-desktop",
    steps: [
      <>Open <b>icapos.com</b> in <b>Chrome</b> or <b>Edge</b>.</>,
      <>Click the <Ui>install icon ⊕</Ui> at the right end of the address bar.</>,
      <>Can&rsquo;t see it? Open the browser menu and choose <Ui>Install page as app</Ui>. iCapOS opens in its own window, like a desktop app.</>,
    ],
  },
];

function Ui({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 6, background: TINT, color: NAVY, fontWeight: 600, fontSize: "0.88em", whiteSpace: "nowrap" }}>{children}</span>;
}

export function InstallClient() {
  const [open, setOpen] = useState<CardId>("desktop");
  const [detectedOs, setDetectedOs] = useState<string | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  // Detect the device and open the matching card.
  useEffect(() => {
    const ua = navigator.userAgent;
    let os = "PC / Mac", target: CardId = "desktop";
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
      os = "iPhone / iPad"; target = "ios";
    } else if (/Android/.test(ua)) {
      os = "Android"; target = "android";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detection needs the client UA
    setDetectedOs(os);
    setOpen(target);
  }, []);

  // One-tap install where the browser supports it (Android + desktop Chrome/Edge).
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPromptEvent(e as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    setPromptEvent(null);
  }

  const card: CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, marginBottom: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(10,26,64,.06)" };
  const cardOpen: CSSProperties = { ...card, borderColor: ROYAL, boxShadow: "0 6px 24px rgba(26,108,228,.14)" };

  return (
    <div style={{ background: "#fff", color: INK, minHeight: "100vh" }}>
      <header style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #123a8f 55%, ${ROYAL} 100%)`, color: "#fff", padding: "56px 24px 72px", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" aria-hidden="true" width={64} height={64} style={{ borderRadius: 16, margin: "0 auto 20px", display: "block" }} />
        <h1 style={{ fontSize: "clamp(1.7rem,5vw,2.4rem)", fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15, margin: 0 }}>Put iCapOS on your&nbsp;screen</h1>
        <p style={{ marginTop: 12, fontSize: "1rem", opacity: 0.85, maxWidth: "34ch", marginLeft: "auto", marginRight: "auto" }}>
          No app store, nothing to download — add it straight from your browser in three taps.
        </p>
        {detectedOs && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 20, padding: "8px 16px", borderRadius: 999, background: "rgba(255,255,255,.14)", fontSize: ".85rem", fontWeight: 500, border: "1px solid rgba(255,255,255,.25)" }}>
            Looks like you&rsquo;re on <b style={{ fontWeight: 600 }}>{detectedOs}</b> — steps below.
          </div>
        )}
      </header>

      <main style={{ maxWidth: 560, margin: "-36px auto 64px", padding: "0 20px" }}>
        {installed && (
          <div style={{ background: "#E7F8EF", border: "1px solid #A7E3C4", color: "#0F6E56", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: ".92rem", fontWeight: 600 }}>
            ✓ iCapOS is installed — look for the icon on your home screen.
          </div>
        )}

        {CARDS.map((c) => {
          const isOpen = open === c.id;
          return (
            <section key={c.id} style={isOpen ? cardOpen : card}>
              <button
                onClick={() => setOpen(isOpen ? ("" as CardId) : c.id)}
                aria-expanded={isOpen}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", background: "none", border: "none", cursor: "pointer", fontSize: "1.05rem", fontWeight: 600, color: NAVY, textAlign: "left" }}
              >
                <span style={{ width: 40, height: 40, flex: "none", borderRadius: 12, background: TINT, display: "flex", alignItems: "center", justifyContent: "center", color: ROYAL }}>
                  <i className={`ti ${c.icon}`} style={{ fontSize: 20 }} aria-hidden="true" />
                </span>
                {c.label}
                <i className={isOpen ? "ti ti-chevron-up" : "ti ti-chevron-down"} style={{ marginLeft: "auto", color: ROYAL, fontSize: 18 }} aria-hidden="true" />
              </button>

              {isOpen && (
                <div style={{ padding: "4px 20px 22px" }}>
                  {promptEvent && c.id !== "ios" && (
                    <button
                      onClick={install}
                      style={{ width: "100%", margin: "14px 0 4px", padding: 14, border: "none", borderRadius: 12, cursor: "pointer", background: `linear-gradient(90deg, ${NAVY}, ${ROYAL})`, color: "#fff", fontSize: "1rem", fontWeight: 600, letterSpacing: ".01em" }}
                    >
                      Install iCapOS now
                    </button>
                  )}
                  {c.steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}`, fontSize: ".95rem", lineHeight: 1.55 }}>
                      <span style={{ flex: "none", width: 26, height: 26, borderRadius: "50%", background: NAVY, color: "#fff", fontSize: ".8rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <footer style={{ textAlign: "center", padding: "0 20px 48px", fontSize: ".85rem", color: "#7583A0" }}>
        Prefer the browser? iCapOS works exactly the same at{" "}
        <Link href="/" style={{ color: ROYAL, fontWeight: 600, textDecoration: "none" }}>icapos.com</Link>.
      </footer>
    </div>
  );
}
