import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPitchDeckByToken } from "@/lib/pitch-deck/store";
import { DECK_SLIDES } from "@/lib/pitch-deck/slides";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pitch deck" };

const NAVY = "#0C2340";
const INDIGO = "#2E78F5";

// Public, read-only pitch-deck view. No auth — anyone with the token can view.
export default async function PublicDeckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const deck = await getPitchDeckByToken(supabase, token).catch(() => null);
  if (!deck) notFound();

  let companyName = "Pitch deck";
  const { data: c } = await supabase.from("companies").select("company_name").eq("id", deck.companyId).maybeSingle();
  if (c?.company_name) companyName = c.company_name as string;

  return (
    <div style={{ minHeight: "100vh", background: "#0a1830", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ color: "#9fb2d6", fontSize: 13, fontFamily: "system-ui, sans-serif" }}>{companyName} · pitch deck</div>
      {DECK_SLIDES.map((def, i) => {
        const s = deck.slides[def.id];
        const bullets = (s?.body ?? "").split("\n").map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
        return (
          <div key={def.id} style={{ width: "100%", maxWidth: 860, aspectRatio: "16 / 9", background: NAVY, borderRadius: 14, padding: "40px 48px", color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.1em", color: INDIGO, textTransform: "uppercase", fontWeight: 600 }}>{def.title}</div>
            <div style={{ fontSize: 30, fontWeight: 600, margin: "10px 0 16px", lineHeight: 1.2 }}>{s?.headline || def.title}</div>
            <div style={{ fontSize: 16, color: "#DCE6F5", lineHeight: 1.7 }}>{bullets.map((b, j) => <div key={j}>• {b}</div>)}</div>
            <div style={{ marginTop: "auto", fontSize: 11, color: "#6B7DA0" }}>{companyName} · {i + 1} / {DECK_SLIDES.length}</div>
          </div>
        );
      })}
      <div style={{ color: "#6B7DA0", fontSize: 11, fontFamily: "system-ui, sans-serif", maxWidth: 860, textAlign: "center" }}>Shared via iCapOS. Educational material — not an offer of securities or investment advice.</div>
    </div>
  );
}
