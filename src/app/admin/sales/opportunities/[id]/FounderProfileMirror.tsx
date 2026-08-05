// Read-only mirror of the linked contact's Founder Profile, shown on the
// opportunity detail page. Source of truth stays on the contact — this is display
// only. Reuses groupContactProfile so the sections match the contact page exactly.
import Link from "next/link";
import { groupContactProfile } from "@/lib/sales/contact-profile-sections";

export type MirrorContact = {
  id: string;
  name: string | null;
  job_position: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  language: string | null;
  membership: string | null;
  extra: Array<{ label: string; values: string[] }>;
};

function RoRow({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children == null || children === "" || children === "—";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "5px 0", fontSize: 12.5, borderBottom: "0.5px solid #f1f5f9" }}>
      <span style={{ width: 150, flexShrink: 0, color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, color: empty ? "var(--muted-foreground)" : "var(--foreground)", wordBreak: "break-word" }}>{empty ? "—" : children}</span>
    </div>
  );
}

export function FounderProfileMirror({ contact }: { contact: MirrorContact }) {
  const profile = groupContactProfile(contact.extra, contact.membership);
  const address = [contact.city, contact.state, contact.country].filter(Boolean).join(", ") || null;

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <i className="ti ti-link" aria-hidden="true" /> Synced from linked contact · <b style={{ fontWeight: 500, color: "var(--foreground)" }}>{contact.name ?? "Contact"}</b>
        </span>
        <Link href={`/admin/sales/contacts/${contact.id}`} style={{ fontSize: 11.5, color: "#185FA5", textDecoration: "none" }}>
          <i className="ti ti-external-link" aria-hidden="true" /> Open full contact
        </Link>
      </div>

      <div>
        <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#4338CA", margin: "14px 0 5px", paddingBottom: 4, borderBottom: "0.5px solid #eef1f5" }}>Entrepreneur information</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 28px" }}>
          <RoRow label="Full name">{contact.name || null}</RoRow>
          <RoRow label="Job position">{contact.job_position || null}</RoRow>
          <RoRow label="Company">{contact.company || null}</RoRow>
          <RoRow label="Email">{contact.email ? <a href={`mailto:${contact.email}`} style={{ color: "#185FA5", textDecoration: "none" }}>{contact.email}</a> : null}</RoRow>
          <RoRow label="Phone">{contact.phone || null}</RoRow>
          <RoRow label="Phone 2">{contact.phone2 || null}</RoRow>
          <RoRow label="Website">{contact.website ? <a href={contact.website} target="_blank" rel="noopener noreferrer" style={{ color: "#185FA5", textDecoration: "none" }}>{contact.website}</a> : null}</RoRow>
          <RoRow label="Location">{address}</RoRow>
          <RoRow label="Language">{contact.language || null}</RoRow>
        </div>
      </div>

      {profile.sections
        .filter((sec) => !sec.title.toLowerCase().includes("information"))
        .map((sec) => (
          <div key={sec.title}>
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#4338CA", margin: "14px 0 5px", paddingBottom: 4, borderBottom: "0.5px solid #eef1f5" }}>{sec.title}</p>
            {sec.title === "Highlights" ? (
              (() => {
                const text = sec.fields.flatMap((f) => f.values).join(" ").trim();
                return text ? (
                  <p style={{ fontSize: 12.5, color: "var(--foreground)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>—</p>
                );
              })()
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 28px" }}>
                {sec.fields.map((f) => (
                  <RoRow key={f.saveKey} label={f.label}>{f.values.filter(Boolean).join(", ") || null}</RoRow>
                ))}
              </div>
            )}
          </div>
        ))}

      <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 14 }}>Read-only — edit on the contact and it updates here. Empty fields show &ldquo;—&rdquo;.</p>
    </div>
  );
}
