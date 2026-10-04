"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "saving" | "yes" | "no" | "error" | "thanks" | "inProgress";

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch("/api/support/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

export function SupportConfirmClient({ token, answer }: Readonly<{ token: string; answer: "yes" | "no" }>) {
  const [phase, setPhase] = useState<Phase>("saving");
  const [owner, setOwner] = useState("Our team");
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const { ok, json } = await post({ step: "answer", token, solved: answer === "yes" });
      if (!ok) {
        setError(String(json.error ?? "Something went wrong. Open your request in iCapOS instead."));
        setPhase("error");
        return;
      }
      if (typeof json.ownerName === "string") setOwner(json.ownerName);
      // The request may have moved on since the email (founder replied, already answered).
      if (json.changed || (answer === "yes" && json.alreadySolved)) setPhase(answer);
      else if (answer === "yes" && json.status === "resolved") setPhase("yes");
      else setPhase("inProgress");
    })();
  }, [token, answer]);

  async function sendRating() {
    if (!rating) {
      setError("Pick a rating first.");
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, json } = await post({ step: "rate", token, rating, comment: text.trim() || null });
    setBusy(false);
    if (!ok) return setError(String(json.error ?? "Couldn't send. Try again."));
    setPhase("thanks");
  }

  async function sendNote() {
    if (!text.trim()) {
      setError("Tell us what's still not working.");
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, json } = await post({ step: "note", token, message: text.trim() });
    setBusy(false);
    if (!ok) return setError(String(json.error ?? "Couldn't send. Try again."));
    setPhase("thanks");
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="mb-4 text-sm font-semibold text-indigo-600">iCapOS Support</p>

        {phase === "saving" ? <p className="text-sm text-slate-500">Saving your answer…</p> : null}

        {phase === "error" ? (
          <>
            <i className="ti ti-alert-circle text-4xl text-amber-600" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-700">{error}</p>
            <a href="/founder/support" className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Open my requests
            </a>
          </>
        ) : null}

        {phase === "inProgress" ? (
          <>
            <i className="ti ti-loader-2 text-5xl text-indigo-600" aria-hidden="true" />
            <h1 className="mt-2 text-lg font-semibold text-slate-900">This request is already in progress</h1>
            <p className="mt-1 text-sm text-slate-500">{owner} is working on it. You can follow it and reply in iCapOS.</p>
            <a href="/founder/support" className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Open my requests
            </a>
          </>
        ) : null}

        {phase === "yes" ? (
          <>
            <i className="ti ti-circle-check text-5xl text-emerald-600" aria-hidden="true" />
            <h1 className="mt-2 text-lg font-semibold text-slate-900">Glad it&apos;s sorted</h1>
            <p className="mt-1 text-sm text-slate-500">How was your experience with {owner}?</p>
            <div className="mt-4 flex justify-center gap-2" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} of 5`}
                  onClick={() => { setRating(n); setError(null); }}
                  className={`h-11 w-11 rounded-lg border text-xl ${n <= rating ? "border-amber-500 text-amber-500" : "border-slate-200 text-slate-300"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Anything we could do better? (optional)"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
            <button type="button" disabled={busy} onClick={sendRating} className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </>
        ) : null}

        {phase === "no" ? (
          <>
            <i className="ti ti-refresh text-5xl text-amber-600" aria-hidden="true" />
            <h1 className="mt-2 text-lg font-semibold text-slate-900">Reopened. Sorry about that.</h1>
            <p className="mt-1 text-sm text-slate-500">{owner} has been told and your request is now top priority.</p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              rows={4}
              placeholder="What's still not working?"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
            <button type="button" disabled={busy} onClick={sendNote} className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {busy ? "Sending…" : `Send to ${owner}`}
            </button>
          </>
        ) : null}

        {phase === "thanks" ? (
          <>
            <i className="ti ti-heart-handshake text-5xl text-indigo-600" aria-hidden="true" />
            <h1 className="mt-2 text-lg font-semibold text-slate-900">Thank you</h1>
            <p className="mt-1 text-sm text-slate-500">We&apos;ve got it. You can follow your request any time in iCapOS.</p>
            <a href="/founder/support" className="mt-5 inline-block rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Open my requests
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}
