"use client";

const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" };
const dl: React.CSSProperties = { display: "inline-block", fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, background: "#2E78F5", color: "#fff", textDecoration: "none" };
const dlGhost: React.CSSProperties = { ...dl, background: "transparent", color: "var(--foreground)", border: "0.5px solid var(--border)" };

export function ExportStep() {
  const quick = [
    { label: "All contacts", href: "/api/prospects/export" },
    { label: "Hot segment", href: "/api/prospects/export?segment=hot" },
    { label: "Warm segment", href: "/api/prospects/export?segment=warm" },
    { label: "Founders", href: "/api/prospects/export?side=founder" },
    { label: "Investors", href: "/api/prospects/export?side=investor" },
    { label: "Valid emails only", href: "/api/prospects/export?status=valid" },
  ];

  return (
    <div>
      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Export the list</h3>
        <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 14 }}>
          Download a CSV to load into any tool. Columns: name, email, company, side, segment, email_status, lead_prescore, source. Risky/invalid rows are included but flagged — filter them out in your tool if you only want deliverable addresses.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {quick.map((q, i) => (
            <a key={q.label} href={q.href} style={i === 0 ? dl : dlGhost}>{q.label} ↓</a>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
        Need a precise slice? Build it on the <b>Contact List</b> step with filters, then use its Export button — it carries your exact filters into the CSV.
      </p>
    </div>
  );
}
