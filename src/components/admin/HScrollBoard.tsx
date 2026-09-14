"use client";

/**
 * A horizontally scrolling board (kanban columns) whose scrollbar is pinned to the bottom
 * of the window — the Odoo kanban pattern. The board itself hides its native bar; a thin
 * sticky bar underneath mirrors its scrollWidth and the two stay in sync both ways. The
 * page never scrolls sideways: the board is the only thing that moves.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export function HScrollBoard({ children, gap = 12, padding = 2 }: { children: ReactNode; gap?: number; padding?: number }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);
  const syncing = useRef(false);

  // Keep the pinned bar the same width as the board's content, whatever the columns do.
  useEffect(() => {
    const board = boardRef.current, inner = innerRef.current;
    if (!board || !inner) return;
    const measure = () => { setScrollWidth(board.scrollWidth); setClientWidth(board.clientWidth); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(board); ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const mirror = (from: HTMLElement | null, to: HTMLElement | null) => {
    if (!from || !to || syncing.current) return;
    syncing.current = true;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => { syncing.current = false; });
  };

  const overflowing = scrollWidth > clientWidth + 1;
  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <div ref={boardRef} onScroll={() => mirror(boardRef.current, barRef.current)} className="hscroll-board" style={{ overflowX: "auto", overflowY: "hidden", minWidth: 0 }}>
        <div ref={innerRef} style={{ display: "flex", gap, padding, width: "max-content", alignItems: "flex-start" }}>{children}</div>
      </div>
      {/* Pinned slide bar — sticky to the bottom of the scrolling page. */}
      <div ref={barRef} onScroll={() => mirror(barRef.current, boardRef.current)} className="hscroll-bar" aria-label="Scroll the board sideways"
        style={{ position: "sticky", bottom: 0, zIndex: 5, overflowX: "auto", overflowY: "hidden", background: "var(--background, #fff)", borderTop: "0.5px solid var(--border)", marginTop: 6, display: overflowing ? "block" : "none" }}>
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
    </div>
  );
}
