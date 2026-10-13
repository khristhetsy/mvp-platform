import QRCode from "qrcode";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { trackedUrl } from "@/lib/ir-agent/slug";

export const dynamic = "force-dynamic";

/** A PNG QR code for the agent's tracked link (src=qr), for print and slides. */
export async function GET() {
  const auth = await requireFounderAgentApi();
  if ("error" in auth) return auth.error;
  const { agent } = auth.ctx;
  const png = await QRCode.toBuffer(trackedUrl(agent.company_slug, agent.ending, "qr"), {
    type: "png",
    margin: 1,
    width: 640,
    color: { dark: "#0A1A40", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${agent.company_slug}-ir-agent-qr.png"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
