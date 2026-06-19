"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

export function QualifySubmitButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/founder/stage-approval-request", {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast({
          variant: "error",
          title: "Couldn't submit for review",
          description: body?.error ?? "Please try again.",
        });
        return;
      }
      toast({
        variant: "success",
        title: "Submitted for admin review",
        description: "We'll notify you when your stage is updated.",
      });
      router.refresh();
    } catch {
      toast({
        variant: "error",
        title: "Couldn't submit for review",
        description: "Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={submitting}
      className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
    >
      {submitting ? "Submitting…" : "Submit for admin review"}
    </button>
  );
}
