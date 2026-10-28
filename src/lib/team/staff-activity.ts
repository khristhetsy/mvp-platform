/** Turns an audit action such as "team.managed_icfo_invited" into "Team: managed icfo invited". */
export function humanizeAction(action: string | null | undefined): string {
  const raw = (action ?? "").trim();
  if (!raw) return "Change";
  const [head, ...rest] = raw.split(".");
  const words = (s: string) => s.replace(/_/g, " ").trim();
  const text = rest.length ? `${words(head)}: ${words(rest.join(" "))}` : words(head);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
