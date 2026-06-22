// Pure keyboard-navigation math for an ARIA tablist (used by MailboxTabs).
// Extracted so AC-1.5 (arrow-key navigation) can be unit-tested in node.

export type TabKey = "ArrowRight" | "ArrowLeft" | "Home" | "End";

/**
 * Given the current focused tab index, a key press, and the tab count, return
 * the next index. Right/Left wrap around; Home/End jump to ends. Returns the
 * same index for unrelated keys or an empty list.
 */
export function nextTabIndex(current: number, key: string, count: number): number {
  if (count <= 0) return 0;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return current;
  }
}

export function isTabNavKey(key: string): key is TabKey {
  return key === "ArrowRight" || key === "ArrowLeft" || key === "Home" || key === "End";
}
