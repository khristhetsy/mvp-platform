import Link from "next/link";

const STEPS = [
  { id: "create", n: 1, label: "Create List" },
  { id: "verify", n: 2, label: "Verify & Correct" },
  { id: "approach", n: 3, label: "AI Approach" },
  { id: "list", n: 4, label: "Contact Lists" },
] as const;

export function ProspectsStepper({ active }: { active: string }) {
  return (
    <div style={{ display: "flex", gap: 0, overflowX: "auto", borderBottom: "0.5px solid var(--border)", paddingBottom: 2 }}>
      {STEPS.map((s) => {
        const isActive = s.id === active;
        return (
          <Link
            key={s.id}
            href={`/admin/marketing/prospects?step=${s.id}`}
            style={{
              flex: "1 1 0", minWidth: 120, display: "flex", alignItems: "center", gap: 7,
              fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", textDecoration: "none",
              padding: "10px 6px", position: "relative",
              color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
              borderBottom: isActive ? "2px solid #2E78F5" : "2px solid transparent",
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: "50%", flex: "none",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
              background: isActive ? "#2E78F5" : "var(--muted)", color: isActive ? "#fff" : "var(--muted-foreground)",
            }}>{s.n}</span>
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
