// Render a template copy to HTML for preview and for send (build spec §5, §6).
//
// Combines the master's compiled_html with the copy's slot values and banner
// choice. Send-time tokens ({{unsubscribe_url}}, {{view_in_browser_url}}, …) are
// preserved for the send layer to fill per-recipient, or filled with harmless
// placeholders for the on-screen preview.

import { mergeSlots } from "./template-merge";
import { condenseSlots, overviewUrl } from "./condense";
import { designTokens, hasDesign } from "./design";
import { SEND_TIME_TOKENS } from "./template-schema";
import type { CopyWithMaster } from "./masters-queries";

/** Slot values with the banner resolved from the copy's banner_mode. */
function effectiveSlots(copy: CopyWithMaster): Record<string, string> {
  // Masters with condensable slots carry the short form in the email and link
  // to the full overview page whenever something was left out.
  const schema = copy.master.placeholder_schema;
  const { values, condensed } = condenseSlots(schema, copy.slot_values ?? {});
  const slots = { ...values };
  if (schema.locked.includes("overview_url")) slots.overview_url = condensed ? overviewUrl(copy.id) : "";
  // Designs with design settings (banner, logo, accent, alignment) read them
  // from the copy's values.
  if (hasDesign(schema)) return { ...slots, ...designTokens(slots, copy.master.name) };
  // Gradient mode → no background image (the compiled master already carries the
  // gradient). Image mode → the chosen banner, over which the master applies its
  // navy overlay for contrast.
  slots.banner_image = copy.banner_mode === "image" ? (copy.banner_image_url ?? "") : "";
  return slots;
}

export type RenderMode = "preview" | "send" | "campaign";

/**
 * Preview: send tokens are shown as safe placeholders so the editor never
 * displays raw braces. Send: they are preserved untouched for the send layer.
 * Campaign: for the Marketing templates library (see above).
 */
export function renderCopyHtml(copy: CopyWithMaster, mode: RenderMode): string {
  const slots = effectiveSlots(copy);

  // Campaign: HTML handed to the Marketing templates library. The campaign
  // sender appends its own signed unsubscribe footer, so the master's
  // unsubscribe line is dropped; recipient tokens stay for its merge step.
  if (mode === "campaign") {
    return mergeSlots(
      copy.master.compiled_html,
      { ...slots, unsubscribe_url: "", view_in_browser_url: "" },
      copy.master.placeholder_schema,
      { preserveTokens: ["first_name", "last_name", "company", "email"] },
    );
  }

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
  const merged = mergeSlots(copy.master.compiled_html, { ...previewTokens, ...slots }, copy.master.placeholder_schema);
  // A recipient token typed into a slot value (e.g. "Hi {{first_name}},") is
  // shown with its placeholder too, so the preview never displays raw braces.
  return merged.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k: string) => previewTokens[k.toLowerCase()] ?? m);
}
