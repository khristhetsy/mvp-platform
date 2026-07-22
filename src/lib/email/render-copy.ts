// Render a template copy to HTML for preview and for send (build spec §5, §6).
//
// Combines the master's compiled_html with the copy's slot values and banner
// choice. Send-time tokens ({{unsubscribe_url}}, {{view_in_browser_url}}, …) are
// preserved for the send layer to fill per-recipient, or filled with harmless
// placeholders for the on-screen preview.

import { mergeSlots } from "./template-merge";
import { SEND_TIME_TOKENS } from "./template-schema";
import type { CopyWithMaster } from "./masters-queries";

/** Slot values with the banner resolved from the copy's banner_mode. */
function effectiveSlots(copy: CopyWithMaster): Record<string, string> {
  const slots = { ...copy.slot_values };
  // Gradient mode → no background image (the compiled master already carries the
  // gradient). Image mode → the chosen banner, over which the master applies its
  // navy overlay for contrast.
  slots.banner_image = copy.banner_mode === "image" ? (copy.banner_image_url ?? "") : "";
  return slots;
}

export type RenderMode = "preview" | "send";

/**
 * Preview: send tokens are shown as safe placeholders so the editor never
 * displays raw braces. Send: they are preserved untouched for the send layer.
 */
export function renderCopyHtml(copy: CopyWithMaster, mode: RenderMode): string {
  const slots = effectiveSlots(copy);

  if (mode === "send") {
    return mergeSlots(copy.master.compiled_html, slots, copy.master.placeholder_schema, {
      preserveTokens: SEND_TIME_TOKENS,
    });
  }

  // Preview: fill send tokens with non-clickable placeholders.
  const previewTokens: Record<string, string> = {
    unsubscribe_url: "#",
    view_in_browser_url: "#",
    first_name: "there",
    last_name: "",
    company: "your company",
    email: "you@example.com",
  };
  return mergeSlots(copy.master.compiled_html, { ...previewTokens, ...slots }, copy.master.placeholder_schema);
}
