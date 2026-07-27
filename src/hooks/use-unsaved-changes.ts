"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Guards against losing unsaved work. Pass `isDirty` (true when a form/editor has
 * edits that haven't been saved).
 *
 * Two layers:
 *  - `beforeunload` — the browser's own prompt when the user closes the tab,
 *    refreshes, or quits ("exits the program"). Browsers force their generic
 *    wording here; that's a platform constraint, not something we can style.
 *  - In-app navigation — intercepts clicks on internal links while dirty and
 *    shows the branded confirm modal instead, so leaving an editor mid-edit asks
 *    first.
 *
 * Skips modifier/middle clicks, new-tab links, downloads, hash and external
 * links — all the cases where the user isn't actually leaving the page.
 */
export function useUnsavedChanges(
  isDirty: boolean,
  options?: { title?: string; message?: string; confirmLabel?: string; cancelLabel?: string },
) {
  const router = useRouter();

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      e.preventDefault();
      e.stopPropagation();
      void confirmDialog({
        title: options?.title ?? "Leave without saving?",
        message: options?.message ?? "You have unsaved changes. If you leave now, they'll be lost.",
        confirmLabel: options?.confirmLabel ?? "Discard changes",
        cancelLabel: options?.cancelLabel ?? "Keep editing",
        danger: true,
      }).then((ok) => {
        if (ok) router.push(url.pathname + url.search + url.hash);
      });
    };
    // Capture phase so we intercept before Next's Link handler runs.
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [isDirty, router, options?.title, options?.message, options?.confirmLabel, options?.cancelLabel]);
}
