import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadPacket } from "@/lib/contracts/packet";
import { recordPacketOpen } from "@/lib/contracts/service";
import { PacketClient } from "./PacketClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documents for your review · iCFO Capital Global", robots: { index: false, follow: false } };

/** Prospect landing page behind the cover email's "Review and sign" link. No account needed. */
export default async function ContractPacketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const packet = await loadPacket(db, token);
  if (!packet) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef1f5", fontFamily: "Inter, system-ui, sans-serif", padding: 20 }}>
        <div style={{ background: "#fff", border: "1px solid #d5deea", borderRadius: 14, padding: "36px 40px", maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 19, color: "#0A1A40", margin: "0 0 8px" }}>This link is not valid</h1>
          <p style={{ fontSize: 14, color: "#5a6b87", margin: 0, lineHeight: 1.6 }}>Please reply to the email you received and ask for a new link.</p>
        </div>
      </div>
    );
  }
  // Review only documents have no signing page, so a visit here is their open.
  await recordPacketOpen(db, packet.id, packet.documents.filter((d) => d.status === "shared").map((d) => d.id)).catch(() => undefined);
  return <PacketClient token={token} packet={packet} />;
}
