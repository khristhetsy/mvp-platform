"use client";

/**
 * A horizontally scrolling board (kanban columns) with its slide bar pinned to the bottom
 * edge of the window — the Odoo kanban pattern. Vertical scrolling is untouched: the page
 * scrolls through the columns as usual. The board hides its own native bar; a thin bar
 * fixed to the viewport bottom mirrors its scrollWidth, and the two stay in sync both
 * ways. It's only drawn when the columns are wider than the board.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

const BAR_H = 18;

export function HScrollBoard({ children, gap = 12, padding = 2 }: { children: ReactNode; gap?: number; padding?: number }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ scrollWidth: 0, clientWidth: 0, left: 0, width: 0 });
  const syncing = useRef(false);

  // Keep the pinned bar the same width (and horizontal position) as the board.
  useEffect(() => {
    const board = boardRef.current, inner = innerRef.current;
    if (!board || !inner) return;
    const measure = () => {
      const r = board.getBoundingClientRect();
      setDims({ scrollWidth: board.scrollWidth, clientWidth: board.clientWidth, left: r.left, width: r.width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(board); ro.observe(inner);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  const mirror = (from: HTMLElement | null, to: HTMLElement | null) => {
    if (!from || !to || syncing.current) return;
    syncing.current = true;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => { syncing.current = false; });
  };

  const overflowing = dims.scrollWidth > dims.clientWidth + 1;
  return (
    <div style={{ minWidth: 0, maxWidth: "100%", paddingBottom: overflowing ? BAR_H + 4 : 0 }}>
      <div ref={boardRef} onScroll={() => mirror(boardRef.current, barRef.current)} className="hscroll-board" style={{ overflowX: "auto", overflowY: "hidden", minWidth: 0 }}>
        <div ref={innerRef} style={{ display: "flex", gap, padding, width: "max-content", alignItems: "flex-start" }}>{children}</div>
      </div>
      {/* Slide bar pinned to the bottom of the window, aligned with the board. */}
      {overflowing && (
        <div ref={barRef} onScroll={() => mirror(barRef.current, boardRef.current)} className="hscroll-bar" aria-label="Scroll the board sideways"
          style={{ position: "fixed", bottom: 0, left: dims.left, width: dims.width, height: BAR_H, zIndex: 30, overflowX: "scroll", overflowY: "hidden", background: "var(--background, #fff)", borderTop: "0.5px solid var(--border)" }}>
          <div style={{ width: dims.scrollWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
