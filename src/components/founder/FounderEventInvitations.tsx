"use client";

import { useState } from "react";
import type { InviteRole } from "@/lib/icfo-events/invite-rules";

export type FounderInvite = {
  id: string;
  role: InviteRole;
  roleLabel: string;
  status: "invited" | "accepted" | "declined" | "withdrawn";
  note: string | null;
  materialsDue: string | null;
  eventTitle: string;
  wantsVideo: boolean;
  wantsDeck: boolean;
  videoUrl: string | null;
  deckFilename: string | null;
  deckBytes: number | null;
  /** Resolved from the session — absent until the room opens. */
  stage: { state: "ready"; url: string } | { state: "not_yet" | "no_session"; reason: string } | null;
};

const card = "rounded-xl border border-indigo-200 bg-indigo-50/40 p-4";
const btn = "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold";
const inp = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700";

function fmtDue(d: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "long" });
  } catch { return null; }
}

/**
 * Invitations a founder has been sent, shown above the apply-to-present tiers.
 *
 * An invitation is not an application: the founder was asked, so there is no
 * plan gate here. That is deliberate — inviting someone and then asking them to
 * upgrade before they can accept is a strange conversation to have.
 */
export function FounderEventInvitations({ invites: initial }: Readonly<{ invites: FounderInvite[] }>) {
  const [invites, setInvites] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!invites.length) return null;

  function patch(id: string, next: Partial<FounderInvite>) {
    setInvites((list) => list.map((i) => (i.id === id ? { ...i, ...next } : i)));
  }

  async function respond(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(id + action);
    setErr(null);
    try {
      const res = await fetch("/api/events/invites/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: id, action, ...extra }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErr(body.error ?? "Something went wrong."); return false; }
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function uploadDeck(id: string, file: File) {
    setBusy(id + "deck");
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("inviteId", id);
      fd.set("file", file);
      const res = await fetch("/api/events/invites/deck", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { error?: string; deckFilename?: string; deckBytes?: number };
      // The server owns the PDF-only / 25MB wording; don't restate it here.
      if (!res.ok) { setErr(body.error ?? "Upload failed."); return; }
      patch(id, { deckFilename: body.deckFilename ?? null, deckBytes: body.deckBytes ?? null });
    } finally {
      setBusy(null);
    }
  }

  const open = invites.filter((i) => i.status === "invited" || i.status === "accepted");
  if (!open.length) return null;

  return (
    <section className="mb-8 space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Your invitations
      </h2>

      {open.map((inv) => {
        const due = fmtDue(inv.materialsDue);
        const outstanding = [
          inv.wantsVideo && !inv.videoUrl ? "Pitch video" : null,
          inv.wantsDeck && !inv.deckFilename ? "Pitch deck" : null,
        ].filter(Boolean) as string[];

        return (
          <div key={inv.id} className={card}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-indigo-700">
                  {inv.roleLabel}
                </p>
                <h3 className="mt-0.5 text-[15px] font-semibold text-slate-900">{inv.eventTitle}</h3>
                {inv.note ? (
                  <blockquote className="mt-2 border-l-2 border-indigo-200 pl-2.5 text-[12.5px] italic text-slate-600">
                    {inv.note}
                  </blockquote>
                ) : null}
              </div>
              {inv.status === "accepted" ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  Confirmed
                </span>
              ) : null}
            </div>

            {inv.status === "invited" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => { if (await respond(inv.id, "accept")) patch(inv.id, { status: "accepted" }); }}
                  className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}
                >
                  {busy === inv.id + "accept" ? "Accepting…" : "Accept"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => { if (await respond(inv.id, "decline")) patch(inv.id, { status: "declined" }); }}
                  className={`${btn} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60`}
                >
                  Decline
                </button>
                {due ? <span className="text-[11.5px] text-slate-500">Materials due {due}</span> : null}
                <span className="ml-auto text-[11px] text-slate-500">
                  Invited by iCFO — no plan upgrade needed for this event
                </span>
              </div>
            ) : null}

            {inv.status === "accepted" ? (
              <div className="mt-3 space-y-3">
                {/* Honest about a link that doesn't exist yet rather than an empty box. */}
                {inv.stage ? (
                  inv.stage.state === "ready" ? (
                    <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-indigo-800">
                        {inv.stage.url}
                      </span>
                      <a href={inv.stage.url} target="_blank" rel="noopener noreferrer"
                         className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        Open
                      </a>
                    </div>
                  ) : (
                    <p className="rounded-lg bg-white px-3 py-2 text-[12px] text-slate-600">{inv.stage.reason}</p>
                  )
                ) : null}

                {outstanding.length ? (
                  <p className="text-[12px] font-medium text-amber-800">
                    Still needed: {outstanding.join(" · ")}{due ? ` — due ${due}` : ""}
                  </p>
                ) : (
                  <p className="text-[12px] font-medium text-emerald-700">Everything&rsquo;s in. Nothing else to do.</p>
                )}

                {inv.wantsVideo ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor={`v-${inv.id}`}>
                      Pitch video — link only
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`v-${inv.id}`}
                        className={inp}
                        defaultValue={inv.videoUrl ?? ""}
                        placeholder="https://www.youtube.com/watch?v=…"
                        onBlur={async (e) => {
                          const url = e.target.value.trim();
                          if (url && url !== inv.videoUrl) {
                            if (await respond(inv.id, "materials", { videoUrl: url })) patch(inv.id, { videoUrl: url });
                          }
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10.5px] text-slate-500">
                      YouTube, Vimeo or Loom. We don&rsquo;t host video files — paste the share link.
                    </p>
                  </div>
                ) : null}

                {inv.wantsDeck ? (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">Pitch deck — PDF</p>
                    {inv.deckFilename ? (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">
                          {inv.deckFilename}
                          {inv.deckBytes ? <span className="text-slate-400"> · {(inv.deckBytes / 1024 / 1024).toFixed(1)} MB</span> : null}
                        </span>
                        <label className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                          Replace
                          <input type="file" accept="application/pdf" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadDeck(inv.id, f); }} />
                        </label>
                      </div>
                    ) : (
                      <label className="block cursor-pointer rounded-lg border-[1.5px] border-dashed border-slate-300 bg-white px-4 py-4 text-center hover:bg-slate-50">
                        <span className="text-[12px] text-slate-600"><b>Drop your deck here</b> or browse</span>
                        <span className="mt-0.5 block text-[10.5px] text-slate-400">PDF only · up to 25 MB</span>
                        <input type="file" accept="application/pdf" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadDeck(inv.id, f); }} />
                      </label>
                    )}
                    {busy === inv.id + "deck" ? <p className="mt-1 text-[11.5px] text-slate-500">Uploading…</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {err ? <p className="text-[12.5px] text-red-600">{err}</p> : null}
    </section>
  );
}
