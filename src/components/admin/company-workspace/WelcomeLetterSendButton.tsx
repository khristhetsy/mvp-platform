"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";

/**
 * Company header, for a paying founder who has no welcome letter yet (clients
 * who paid before the letter existed): an amber "not sent" chip and a Send
 * button. Uses the same send and tracking as the automatic letter.
 */
export function WelcomeLetterSendButton({ founderId }: Readonly<{ founderId: string }>) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);
    const res = await fetch("/api/admin/welcome-letter/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ founderId }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res?.ok && d?.ok) {
      router.refresh();
      return;
    }
    setState("error");
    setError(d?.error ?? "Could not send.");
  }

  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge label="✉ Welcome letter: not sent" status="warning" />
      <button
        type="button"
        onClick={() => void send()}
        disabled={state === "sending"}
        className="rounded-md border border-blue-200 bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send welcome letter"}
      </button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </span>
  );
}
