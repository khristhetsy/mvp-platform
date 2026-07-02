"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const ACCENT = "#2E78F5";
const W = 460;
const H = 180;

type Props = {
  signerName: string | null;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
};

/** Capture a signature by drawing or typing. Returns a transparent PNG data URL. */
export function SignaturePad({ signerName, onCancel, onApply }: Props) {
  const t = useTranslations("sharedCmp");
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(signerName ?? "");
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const ctx = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  const clearDraw = useCallback(() => {
    const c = canvasRef.current;
    const g = ctx();
    if (c && g) g.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  }, [ctx]);

  useEffect(() => {
    const g = ctx();
    if (g) {
      g.lineWidth = 2.4;
      g.lineCap = "round";
      g.strokeStyle = "#0f172a";
    }
  }, [ctx, mode]);

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  const start = (e: React.PointerEvent) => {
    if (mode !== "draw") return;
    drawing.current = true;
    const g = ctx();
    const p = pointFromEvent(e);
    if (g) { g.beginPath(); g.moveTo(p.x, p.y); }
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || mode !== "draw") return;
    const g = ctx();
    const p = pointFromEvent(e);
    if (g) { g.lineTo(p.x, p.y); g.stroke(); setHasDrawn(true); }
  };
  const end = () => { drawing.current = false; };

  const apply = useCallback(() => {
    if (mode === "draw") {
      const c = canvasRef.current;
      if (!c || !hasDrawn) return;
      onApply(c.toDataURL("image/png"));
      return;
    }
    // Render typed name to a transparent canvas in a script style.
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    if (!g) return;
    g.fillStyle = "#0f172a";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "italic 52px 'Brush Script MT', 'Segoe Script', cursive";
    g.fillText(typed.trim() || " ", W / 2, H / 2);
    onApply(c.toDataURL("image/png"));
  }, [mode, hasDrawn, typed, onApply]);

  const canApply = mode === "draw" ? hasDrawn : typed.trim().length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 20, width: W + 40, maxWidth: "100%" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["draw", "type"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #e5e7eb", background: mode === m ? ACCENT : "white", color: mode === m ? "white" : "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "draw" ? (
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            style={{ width: "100%", height: H, border: "1px dashed #c7c5e6", borderRadius: 10, touchAction: "none", background: "#fbfbfe" }}
          />
        ) : (
          <div style={{ border: "1px dashed #c7c5e6", borderRadius: 10, padding: 16, background: "#fbfbfe" }}>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t("type_your_full_name")}
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "center", fontStyle: "italic", fontSize: 38, fontFamily: "'Brush Script MT', 'Segoe Script', cursive", color: "#0f172a" }}
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          {mode === "draw" ? (
            <button type="button" onClick={clearDraw} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 14, cursor: "pointer" }}>{t("clear")}</button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onCancel} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("cancel")}</button>
            <button type="button" onClick={apply} disabled={!canApply} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: canApply ? ACCENT : "#c7c5e6", color: "white", fontSize: 14, fontWeight: 600, cursor: canApply ? "pointer" : "not-allowed" }}>{t("apply")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
