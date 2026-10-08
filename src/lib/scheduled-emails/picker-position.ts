/**
 * Where the schedule send picker opens on screen. Pure, so it can be tested.
 * The picker is fixed to the window (it floats above cards that clip their
 * contents): right-aligned to its arrow, kept inside the window, and opened
 * upward when there is not room below, or when "above" is asked for and fits.
 */
export const PICKER_WIDTH = 300;
const GAP = 6;
const EDGE = 8;

export function pickerPosition(
  anchor: { top: number; bottom: number; right: number },
  panelH: number,
  view: { width: number; height: number },
  placement: "below" | "above" = "below",
): { top: number; left: number } {
  const left = Math.min(Math.max(EDGE, anchor.right - PICKER_WIDTH), Math.max(EDGE, view.width - PICKER_WIDTH - EDGE));
  const roomBelow = view.height - anchor.bottom - GAP - EDGE;
  const roomAbove = anchor.top - GAP - EDGE;
  const up = placement === "above" ? roomAbove >= panelH || roomAbove > roomBelow : roomBelow < panelH && roomAbove > roomBelow;
  const top = up ? anchor.top - GAP - panelH : anchor.bottom + GAP;
  return { top: Math.max(EDGE, Math.min(top, view.height - panelH - EDGE)), left };
}
