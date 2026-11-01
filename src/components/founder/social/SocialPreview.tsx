"use client";

import { PLATFORM_LABEL_SHARED, previewParts } from "@/lib/social/preview";
import { NETWORKS, type Network } from "@/lib/social/templates";

const MORE_AFTER = 210;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "ME";
}

const FOOTERS: Record<Network, string[]> = {
  linkedin: ["Like", "Comment", "Repost", "Send"],
  facebook: ["Like", "Comment", "Share"],
  instagram: ["Like", "Comment", "Share"],
  reddit: ["Upvote", "Comment", "Share"],
};

/**
 * Live preview of the post as each network shows it. Approximate by design: it never
 * claims to match a network's exact rendering. Works with no connected account.
 */
export function SocialPreview({ body, network, onNetwork, name, company, linkUrl }: {
  body: string; network: Network; onNetwork: (n: Network) => void; name: string; company: string | null; linkUrl: string;
}) {
  const { title, text, limit, note } = previewParts(network, body, Boolean(linkUrl.trim()));
  const shown = network === "linkedin" && text.length > MORE_AFTER ? `${text.slice(0, MORE_AFTER).trimEnd()}... more` : text;
  const subtitle = network === "reddit" ? "r/startups · now" : network === "instagram" ? (company ?? "yourcompany").toLowerCase().replace(/[^a-z0-9]/g, "") : `${company ? `Founder at ${company}` : "Founder"} · Now`;
  const over = body.length > limit;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Preview</h2>
        <span className={`text-xs ${over ? "text-red-700" : "text-slate-500"}`}>{body.length.toLocaleString()} / {limit.toLocaleString()}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Preview network">
        {NETWORKS.map((n) => (
          <button key={n} type="button" role="tab" aria-selected={network === n} onClick={() => onNetwork(n)}
            className={`rounded-full border px-3 py-1 text-xs ${network === n ? "border-[#1A6CE4] bg-blue-50 text-[#1A6CE4]" : "border-slate-300 text-slate-600"}`}>
            {PLATFORM_LABEL_SHARED[n]}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-slate-300 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-[#1A6CE4]" aria-hidden="true">{initials(name)}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
            <div className="truncate text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>
        {network === "instagram" && (
          <div className="mt-2 flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">Instagram posts need an image</div>
        )}
        {title && <div className="mt-2 text-sm font-semibold text-slate-900">{title}</div>}
        <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
          {shown || <span className="text-slate-400">Your post appears here as you write.</span>}
        </div>
        <div className="mt-3 flex gap-4 border-t border-slate-200 pt-2 text-xs text-slate-500">
          {FOOTERS[network].map((f) => <span key={f}>{f}</span>)}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">{note}</p>
      {over && <p className="mt-1 text-xs text-red-700">This is over the {PLATFORM_LABEL_SHARED[network]} limit. Use Shorten in the AI agent menu.</p>}
      <p className="mt-1 text-xs text-slate-400">Previews are approximate. Each network may render slightly differently.</p>
    </div>
  );
}
