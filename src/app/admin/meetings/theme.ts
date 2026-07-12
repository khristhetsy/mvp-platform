// Shared dark theme for the Weekly Meeting System surfaces — matches the full-flow mockup
// (navy app on a dark page). Meeting pages wrap their content in a MEETING_WRAP container
// so they read as one intentional dark app inside the light admin shell.
export const MT = {
  page: "#060B1E",
  panel: "#0A1128",
  card: "#0C142E",
  chip: "#132146",
  border: "rgba(255,255,255,.08)",
  borderSoft: "rgba(255,255,255,.05)",
  text: "#E8EDF7",
  textSoft: "#9DB4E8",
  muted: "#7C8DB5",
  accent: "#2E6BFF",
  accentText: "#8FB4FF",
} as const;

// Owner badge colors per department (from the mockup).
export const OWNER_TONE: Record<string, { bg: string; c: string }> = {
  ir: { bg: "#0E4A3A", c: "#7DF0AE" },
  investor_relations: { bg: "#0E4A3A", c: "#7DF0AE" },
  sos: { bg: "#4A3A0E", c: "#FFD27F" },
  marketing: { bg: "#5C2E0E", c: "#FFB37F" },
  admin: { bg: "#3D2A6B", c: "#C9A8FF" },
  sales: { bg: "#0E3D5C", c: "#7FD4FF" },
};

export const MEETING_WRAP: React.CSSProperties = {
  background: MT.panel,
  borderRadius: 14,
  border: `1px solid ${MT.border}`,
  padding: 18,
  color: MT.text,
};
