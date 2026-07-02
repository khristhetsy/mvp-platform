import { requireRole } from "@/lib/supabase/auth";
import { AeoEditorClient } from "@/components/aeo/admin/AeoEditorClient";

export const dynamic = "force-dynamic";

export default async function AeoEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  return (
    <div style={{ padding: 24, maxWidth: 1060, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em", color: "#534AB7", margin: 0 }}>Marketing · AEO · Edit</p>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0f2147", margin: "6px 0 0" }}>Structured editor</h1>
      </div>
      <AeoEditorClient id={id} />
    </div>
  );
}
