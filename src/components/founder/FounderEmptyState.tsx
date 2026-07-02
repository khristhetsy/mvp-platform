const ACCENT = "#2E78F5";

type Step = {
  icon: string;
  label: string;
};

type Props = {
  icon: string;
  title: string;
  description: string;
  /** Optional numbered steps showing what happens when active */
  steps?: Step[];
  /** Primary CTA */
  action?: {
    label: string;
    href: string;
  };
  /** Optional secondary link */
  secondaryAction?: {
    label: string;
    href: string;
  };
};

/**
 * Reusable empty-state panel — shows what a feature looks like when active
 * and directs the user to the right next step.
 */
export function FounderEmptyState({
  icon,
  title,
  description,
  steps,
  action,
  secondaryAction,
}: Props) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: "48px 32px 40px",
      maxWidth: 520,
      margin: "0 auto",
    }}>
      {/* Icon circle */}
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "#EEEDFE",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 30, marginBottom: 20,
      }}>
        {icon}
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 28px", lineHeight: 1.65, maxWidth: 380 }}>
        {description}
      </p>

      {/* Preview steps */}
      {steps && steps.length > 0 && (
        <div style={{
          width: "100%", maxWidth: 380,
          background: "#fafafa", borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: "16px 20px",
          marginBottom: 24,
          textAlign: "left",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 12px" }}>
            How it works
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "#EEEDFE",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, flexShrink: 0,
                }}>
                  {step.icon}
                </div>
                <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {action && (
            <a
              href={action.href}
              style={{
                fontSize: 13, fontWeight: 600, color: "white",
                background: ACCENT, borderRadius: 10,
                padding: "9px 22px", textDecoration: "none",
              }}
            >
              {action.label}
            </a>
          )}
          {secondaryAction && (
            <a
              href={secondaryAction.href}
              style={{
                fontSize: 13, fontWeight: 600, color: ACCENT,
                background: "#EEEDFE", borderRadius: 10,
                padding: "9px 22px", textDecoration: "none",
              }}
            >
              {secondaryAction.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
