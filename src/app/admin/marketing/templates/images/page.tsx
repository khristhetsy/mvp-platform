import { requireRole } from "@/lib/supabase/auth";
import { TemplatesTabs } from "../TemplatesTabs";
import { ImagesClient } from "./ImagesClient";

export const dynamic = "force-dynamic";

export default async function MarketingEmailImagesPage() {
  await requireRole(["admin"]);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Email images</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
          Upload an image once, then copy its public link or insert it from the email composer in Sales and Marketing. Dates are in PT.
        </p>
      </div>
      <TemplatesTabs />
      <ImagesClient />
    </div>
  );
}
