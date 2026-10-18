import { PRIVATE_SOURCES } from "./coach-screenshots-core.mjs";

/**
 * Blur private values and draw the numbered pin on the control. Runs inside the page.
 * Returns { pinned } or { pinned: false, missing: true } when the control is not on the screen.
 */
export async function preparePage(pageRef, { learningId, number }) {
  return pageRef.evaluate(
    ({ learningId: id, number: n, sources: srcs }) => {
      const regs = srcs.map((s) => new RegExp(s.source, s.flags));
      const blur = (el) => {
        el.style.filter = "blur(6px)";
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const hits = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue ?? "";
        if (!text.trim()) continue;
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) continue;
        if (regs.some((r) => new RegExp(r.source, r.flags).test(text))) hits.push(node);
      }
      for (const node of hits) {
        const parent = node.parentElement;
        const text = node.nodeValue ?? "";
        const frag = document.createDocumentFragment();
        const spans = [];
        for (const r of regs) {
          const re = new RegExp(r.source, r.flags);
          let m;
          while ((m = re.exec(text)) !== null) {
            if (m[0].length === 0) {
              re.lastIndex += 1;
              continue;
            }
            spans.push([m.index, m.index + m[0].length]);
          }
        }
        spans.sort((a, b) => a[0] - b[0]);
        let cursor = 0;
        for (const [s, e] of spans) {
          if (s < cursor) continue;
          if (s > cursor) frag.append(text.slice(cursor, s));
          const mark = document.createElement("span");
          mark.textContent = text.slice(s, e);
          blur(mark);
          frag.append(mark);
          cursor = e;
        }
        if (cursor < text.length) frag.append(text.slice(cursor));
        parent.replaceChild(frag, node);
      }
      for (const input of document.querySelectorAll("input, textarea")) {
        const v = input.value ?? "";
        if (input.type === "email" || input.type === "tel" || regs.some((r) => new RegExp(r.source, r.flags).test(v))) blur(input);
      }

      if (!id) return { pinned: false };
      const el = document.querySelector(`[data-learning-id="${id}"]`);
      if (!el) return { pinned: false, missing: true };
      el.scrollIntoView({ block: "center", inline: "center" });
      const box = el.getBoundingClientRect();
      const ring = document.createElement("div");
      ring.style.cssText = `position:fixed;left:${box.left - 3}px;top:${box.top - 3}px;width:${box.width + 6}px;height:${box.height + 6}px;border:2px solid #1A6CE4;border-radius:8px;pointer-events:none;z-index:2147483646`;
      const pin = document.createElement("div");
      pin.textContent = String(n);
      pin.style.cssText = `position:fixed;left:${Math.max(4, box.left - 14)}px;top:${Math.max(4, box.top - 14)}px;width:26px;height:26px;border-radius:50%;background:#1A6CE4;color:#fff;font:700 13px/26px Inter,system-ui,sans-serif;text-align:center;pointer-events:none;z-index:2147483647;box-shadow:0 2px 6px rgba(0,0,0,.35)`;
      document.body.append(ring, pin);
      return { pinned: true };
    },
    { learningId, number, sources: PRIVATE_SOURCES },
  );
}

