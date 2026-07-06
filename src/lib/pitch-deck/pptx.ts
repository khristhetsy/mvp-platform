// Server-only: render a pitch deck to an editable PowerPoint Buffer (pptxgenjs).
import PptxGenJS from "pptxgenjs";
import { DECK_SLIDES } from "./slides";
import type { PitchDeck } from "./types";

const NAVY = "0C2340";
const INDIGO = "2E78F5";
const LIGHT = "DCE6F5";

export async function renderDeckPptx(deck: PitchDeck, company: { name: string }): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 10, height: 5.625 });
  pptx.layout = "WIDE";

  DECK_SLIDES.forEach((def, i) => {
    const s = deck.slides[def.id];
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };
    slide.addText(def.title.toUpperCase(), { x: 0.6, y: 0.5, w: 8.8, h: 0.3, fontSize: 11, bold: true, color: INDIGO, charSpacing: 2 });
    slide.addText(s?.headline || def.title, { x: 0.6, y: 0.9, w: 8.8, h: 0.9, fontSize: 28, bold: true, color: "FFFFFF" });
    const bullets = (s?.body || "").split("\n").map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
    if (bullets.length) {
      slide.addText(bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
        x: 0.6, y: 2.0, w: 8.8, h: 2.8, fontSize: 15, color: LIGHT, lineSpacingMultiple: 1.3,
      });
    }
    slide.addText(`${company.name}  ·  ${i + 1} / ${DECK_SLIDES.length}`, { x: 0.6, y: 5.2, w: 8.8, h: 0.3, fontSize: 9, color: "6B7DA0" });
  });

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}
