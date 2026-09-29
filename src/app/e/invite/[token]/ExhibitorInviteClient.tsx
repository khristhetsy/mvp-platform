"use client";

import { useState } from "react";
import type { PresenterMaterials, StageLink } from "@/lib/icfo-events/invites";
import type { InviteRole } from "@/lib/icfo-events/invite-rules";

type Invite = {
  id: string;
  role: InviteRole;
  roleLabel: string;
  status: "invited" | "accepted" | "declined" | "withdrawn";
  note: string | null;
  materialsDue: string | null;
  eventTitle: string;
  displayName: string | null;
};

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.05)]";
const label = "block text-[11px] font-semibold text-slate-600 mb-1";
const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700";
const btn = "rounded-lg px-3.5 py-2 text-[13px] font-semibold";

function fmtDue(d: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "long" });
  } catch {
    return null;
  }
}

function fmtBytes(n: number | null): string {
  if (!n) return "";
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ExhibitorInviteClient({
  token,
  invite,
  wants,
  materials: initialMaterials,
  stage,
  portalPath,
}: Readonly<{
  token: string;
  invite: Invite;
  wants: { video: boolean; deck: boolean };
  materials: PresenterMaterials | null;
  stage: StageLink | null;
  portalPath: string | null;
}>) {
  const [status, setStatus] = useState(invite.status);
  const [materials, setMaterials] = useState(initialMaterials);
  const [videoUrl, setVideoUrl] = useState(initialMaterials?.videoUrl ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/events/invites/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, ...extra }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; materials?: PresenterMaterials };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        return false;
      }
      if (body.materials) setMaterials(body.materials);
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function uploadDeck(file: File) {
    setBusy("deck");
    setError(null);
    setSaved(null);
    try {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("file", file);
      const res = await fetch("/api/events/invites/deck", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string; deckPath?: string; deckFilename?: string; deckBytes?: number;
      };
      // The server's message is the one that matters — it carries the shared
      // PDF-only / 25MB wording rather than a second copy written here.
      if (!res.ok) { setError(body.error ?? "Upload failed."); return; }
      setMaterials((m) => ({
        videoUrl: m?.videoUrl ?? null,
        deckPath: body.deckPath ?? null,
        deckFilename: body.deckFilename ?? null,
        deckBytes: body.deckBytes ?? null,
        updatedAt: new Date().toISOString(),
      }));
      setSaved("Deck uploaded.");
    } finally {
      setBusy(null);
    }
  }

  // A founder who opened the emailed link instead of their portal.
  if (portalPath) {
    return (
      <div className={card}>
        <h1 className="text-lg font-semibold text-slate-900">Your invitation is in your account</h1>
        <p className="mt-2 text-[13px] text-slate-600">
          You&rsquo;re invited to <b>{invite.eventTitle}</b> as a {invite.roleLabel}. Because you have
          an iCapOS account, everything lives there.
        </p>
        <a href={portalPath} className={`${btn} mt-4 inline-block bg-indigo-600 text-white hover:bg-indigo-700`}>
          Open it in iCapOS →
        </a>
      </div>
    );
  }

  if (status === "withdrawn") {
    return (
      <div className={card}>
        <h1 className="text-lg font-semibold text-slate-900">This invitation has been withdrawn</h1>
        <p className="mt-2 text-[13px] text-slate-600">Please contact the iCFO team if you think this is a mistake.</p>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className={card}>
        <h1 className="text-lg font-semibold text-slate-900">You&rsquo;ve declined this invitation</h1>
        <p className="mt-2 text-[13px] text-slate-600">
          Changed your mind? Reply to the invitation email and we&rsquo;ll re-open it.
        </p>
      </div>
    );
  }

  const due = fmtDue(invite.materialsDue);

  return (
    <div className="space-y-3">
      <div className={card}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">{invite.roleLabel}</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{invite.eventTitle}</h1>
        {invite.note ? (
          <blockquote className="mt-3 border-l-2 border-indigo-200 pl-3 text-[13px] italic text-slate-600">
            {invite.note}
          </blockquote>
        ) : null}

        {status === "invited" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => { if (await post("accept")) setStatus("accepted"); }}
              className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}
            >
              {busy === "accept" ? "Accepting…" : "Accept"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => { if (await post("decline")) setStatus("declined"); }}
              className={`${btn} border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60`}
            >
              Decline
            </button>
            {due ? <span className="text-[12px] text-slate-500">Materials due {due}</span> : null}
          </div>
        ) : (
          <p className="mt-3 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700">
            Confirmed
          </p>
        )}
      </div>

      {status === "accepted" ? (
        <>
          {/* Stage link — honest about not existing yet, rather than an empty box. */}
          {stage ? (
            <div className={card}>
              <p className={label}>Your stage link</p>
              {stage.state === "ready" ? (
                <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-indigo-800">{stage.url}</span>
                  <a href={stage.url} target="_blank" rel="noopener noreferrer"
                     className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600">
                    Open
                  </a>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">{stage.reason}</p>
              )}
            </div>
          ) : null}

          <div className={card}>
            <p className="text-[13px] font-semibold text-slate-900">
              What we need{due ? <span className="font-normal text-slate-500"> · due {due}</span> : null}
            </p>

            {wants.video ? (
              <div className="mt-3">
                <label className={label} htmlFor="videoUrl">Pitch video — link only</label>
                <input
                  id="videoUrl"
                  className={input}
                  value={videoUrl}
                  placeholder="https://www.youtube.com/watch?v=…"
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  YouTube, Vimeo or Loom. We don&rsquo;t host video files — paste the share link.
                </p>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    if (await post("materials", { videoUrl })) setSaved("Video link saved.");
                  }}
                  className={`${btn} mt-2 border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60`}
                >
                  {busy === "materials" ? "Saving…" : "Save link"}
                </button>
              </div>
            ) : null}

            {wants.deck ? (
              <div className="mt-4">
                <p className={label}>Pitch deck — PDF</p>
                {materials?.deckPath ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-700">
                      {materials.deckFilename}
                      <span className="text-slate-400"> · {fmtBytes(materials.deckBytes)}</span>
                    </span>
                    <label className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50">
                      Replace
                      <input type="file" accept="application/pdf" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadDeck(f); }} />
                    </label>
                  </div>
                ) : (
                  <label className="block cursor-pointer rounded-lg border-[1.5px] border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:bg-slate-100">
                    <span className="text-[12.5px] text-slate-600"><b>Drop your deck here</b> or browse</span>
                    <span className="mt-1 block text-[11px] text-slate-400">PDF only · up to 25 MB</span>
                    <input type="file" accept="application/pdf" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadDeck(f); }} />
                  </label>
                )}
                {busy === "deck" ? <p className="mt-2 text-[12px] text-slate-500">Uploading…</p> : null}
              </div>
            ) : null}

            {error ? <p className="mt-3 text-[12.5px] text-red-600">{error}</p> : null}
            {saved ? <p className="mt-3 text-[12.5px] text-emerald-700">{saved}</p> : null}

            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => { if (await post("decline", { reason: "Withdrew after accepting" })) setStatus("declined"); }}
              className="mt-5 text-[12px] text-slate-500 underline hover:text-slate-700"
            >
              I can no longer attend
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
