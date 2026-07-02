import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { getPage } from "@/lib/aeo/store";
import { buildJsonLd } from "@/lib/aeo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { AeoPageBody } from "@/components/aeo/AeoPageBody";
import { XrayOverlay } from "@/components/aeo/XrayOverlay";

export const dynamic = "force-dynamic";

// Admin-only preview: renders the EXACT public body + JSON-LD, plus the X-ray
// overlay. The X-ray lives only here — it is never part of the public route.
export default async function AeoPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const page = await getPage(id);
  if (!page) notFound();

  const jsonLd = buildJsonLd(page);

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ background: "#EEF0FB", borderBottom: "1px solid #CECBF6", padding: "8px 16px", fontSize: 12, color: "#1A6CE4" }}>
        <Link href={`/admin/marketing/aeo/${id}/edit`} style={{ color: "#1A6CE4", fontWeight: 600 }}>← Back to editor</Link>
        <span style={{ marginLeft: 12 }}>Previewing <code>/learn/{page.slug}</code> · status: {page.status}</span>
      </div>
      <JsonLd data={jsonLd} />
      <AeoPageBody page={page} />
      <XrayOverlay jsonLd={jsonLd} />
    </div>
  );
}
