// Stable per-visit id so funnel events from the same visitor tie together across
// the landing → assessment → pricing steps. Client-only; sessionStorage-scoped.

const KEY = "icapos_sid";

export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.sessionStorage.getItem(KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}
