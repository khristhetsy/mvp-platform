import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_SEEDS } from "./subscription/seeds";
import { applyLogo, logoSize, readLogoImage } from "./logo";
import { loadDocx } from "./docx-engine";
import { renderDocxToPdf } from "./docx-pdf";
import { readPdfLines } from "./signature-anchors";

// A 2x1 PNG and a minimal JPEG header with a start-of-frame of 40 x 20.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAC0lEQVR4nGP4DwQACfsD/Qe0UygAAAAASUVORK5CYII=", "base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x14, 0x00, 0x28, 0x01, 0x01, 0x11, 0x00]), Buffer.alloc(8)]);
const ppm = () => Buffer.from(SUBSCRIPTION_SEEDS.find((s) => s.key === "sub_ppm")!.base64, "base64");

describe("issuer logo", () => {
  it("reads format and size from the file itself, and refuses anything else", () => {
    expect(readLogoImage(PNG)).toMatchObject({ ext: "png", width: 2, height: 1 });
    expect(readLogoImage(JPEG)).toMatchObject({ ext: "jpeg", width: 40, height: 20 });
    expect(readLogoImage(Buffer.from("<svg></svg>"))).toBeNull();
    expect(readLogoImage(Buffer.from("MZ not a picture"))).toBeNull();
  });

  it("scales within the box and keeps proportions", () => {
    expect(logoSize(1000, 500)).toEqual({ w: 158, h: 79 });
    expect(logoSize(400, 400)).toEqual({ w: 79, h: 79 });
  });

  it("the Memorandum master carries one logo marker, on the Information Statement cover", async () => {
    const { doc } = await loadDocx(ppm());
    const text = Array.from(doc.getElementsByTagName("w:t") as ArrayLike<{ textContent: string }>).map((t) => t.textContent).join("\n");
    expect(text.match(/\(ISSUER LOGO\)/g)).toHaveLength(1);
  });

  it("without an upload the marker is cleared, so no placeholder reaches the subscriber", async () => {
    const out = await applyLogo(ppm(), null);
    const { doc } = await loadDocx(out);
    const text = Array.from(doc.getElementsByTagName("w:t") as ArrayLike<{ textContent: string }>).map((t) => t.textContent).join("\n");
    expect(text).not.toContain("ISSUER LOGO");
  });

  it("with an upload the picture is embedded and the document still renders", async () => {
    const out = await applyLogo(ppm(), PNG);
    const { zip, doc } = await loadDocx(out);
    expect(zip.file("word/media/issuer-logo.png")).toBeTruthy();
    expect(doc.getElementsByTagName("w:drawing").length).toBeGreaterThan(0);
    const pdf = await renderDocxToPdf(out);
    const { pageCount, lines } = await readPdfLines(new Uint8Array(pdf));
    expect(pageCount).toBeGreaterThan(50);
    expect(lines.some((l) => /ISSUER LOGO/.test(l.text))).toBe(false);
  }, 120000);
});
