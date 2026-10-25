#!/usr/bin/env python3
"""
Builds the subscription package masters from the BLANK executable package.

  python3 scripts/subscription-masters/build.py "iCFO_Venture_Subscription_Package_-_BLANK_executable.docx"

Writes src/lib/contracts/masters/sub-*.ts (one Word master each, base64) and
src/lib/contracts/subscription/form-pdfs.ts (the two IRS forms the package
embeds as pictures, recovered as PDFs). The field maps that go with each master
live in src/lib/contracts/subscription/seeds.ts and are verified against these
files by seeds.test.ts.

How a part is cut: the source is one long Word file made of sections. Each part
is a run of body paragraphs between section breaks; the cut keeps the pages'
own section properties, so headers, footers and margins come across unchanged.
Blank signature lines (an underlined tab) become highlighted placeholders such
as (SUBSCRIBER NAME) so the same field engine that fills the term sheets can
fill them. Nothing else in the text is changed.

Needs: python3, lxml, qpdf.
"""
import base64, copy, io, os, re, subprocess, sys, tempfile, zipfile
from lxml import etree

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}
W = "{%s}" % NS["w"]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MASTERS_DIR = os.path.join(ROOT, "src", "lib", "contracts", "masters")
SUB_DIR = os.path.join(ROOT, "src", "lib", "contracts", "subscription")


class Src:
    def __init__(self, path):
        z = zipfile.ZipFile(path)
        self.files = {n: z.read(n) for n in z.namelist()}
        self.doc = etree.fromstring(self.files["word/document.xml"])
        self.rels = etree.fromstring(self.files["word/_rels/document.xml.rels"])


def text(e):
    return "".join(e.itertext())


# ── Placeholder injection ──────────────────────────────────────────────────

def _blank_run(placeholder, like_rpr=None, keep_underline=False):
    r = etree.SubElement(etree.Element("x"), W + "r")
    rpr = etree.SubElement(r, W + "rPr")
    if like_rpr is not None:
        for c in like_rpr:
            if c.tag == W + "highlight" or (c.tag == W + "u" and not keep_underline):
                continue
            rpr.append(copy.deepcopy(c))
    hl = etree.SubElement(rpr, W + "highlight")
    hl.set(W + "val", "yellow")
    t = etree.SubElement(r, W + "t")
    t.text = placeholder
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    return r


def underline_blanks(p):
    return [
        r for r in p.iter(W + "r")
        if r.find("w:rPr/w:u", NS) is not None and r.find("w:tab", NS) is not None and r.find("w:t", NS) is None
    ]


def fill_blank(p, which, placeholder):
    runs = underline_blanks(p)
    if which >= len(runs):
        raise SystemExit("no underlined blank #%d in: %s" % (which, text(p)[:60]))
    old = runs[which]
    # The filled value keeps the line the blank had, as a typed name sits on a line in Word.
    new = _blank_run(placeholder, old.find("w:rPr", NS), keep_underline=True)
    old.getparent().replace(old, new)


def append_text(p, placeholder, lead=" "):
    runs = list(p.iter(W + "r"))
    last_rpr = runs[-1].find("w:rPr", NS) if runs else None
    if lead:
        r0 = etree.SubElement(etree.Element("x"), W + "r")
        t0 = etree.SubElement(r0, W + "t")
        t0.text = lead
        t0.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        p.append(r0)
    p.append(_blank_run(placeholder, last_rpr))


def set_runs(p, parts):
    """Replace all runs of a paragraph with plain text parts and highlighted placeholders: [("t","Telephone: "),("p","(TELEPHONE)")]."""
    first = next(p.iter(W + "r"), None)
    rpr = first.find("w:rPr", NS) if first is not None else None
    for r in list(p.findall("w:r", NS)):
        p.remove(r)
    for kind, s in parts:
        if kind == "p":
            p.append(_blank_run(s, rpr))
        elif kind == "br":
            r = etree.SubElement(p, W + "r")
            etree.SubElement(r, W + "br")
        else:
            r = etree.SubElement(p, W + "r")
            if rpr is not None:
                r.append(copy.deepcopy(rpr))
            t = etree.SubElement(r, W + "t")
            t.text = s
            t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def make_by_line(p, like):
    """Turn an empty paragraph into a 'By:' line using the indentation of `like`."""
    for c in list(p):
        p.remove(c)
    ppr = like.find("w:pPr", NS)
    if ppr is not None:
        p.append(copy.deepcopy(ppr))
    r = etree.SubElement(p, W + "r")
    t = etree.SubElement(r, W + "t")
    t.text = "By:"


# ── Build ──────────────────────────────────────────────────────────────────

def build(src, ranges, drop=(), edit=None):
    doc = copy.deepcopy(src.doc)
    body = doc.find("w:body", NS)
    kids = list(body)
    if edit:
        edit(kids)
    keep = set()
    for a, b in ranges:
        keep.update(range(a, b))
    keep -= set(drop)
    for i, k in enumerate(kids[:-1]):
        if i not in keep:
            body.remove(k)
    # The last kept section's properties become the body level sectPr (no empty trailing section).
    rest = list(body)[:-1]
    if rest:
        sp = rest[-1].find("w:pPr/w:sectPr", NS)
        if sp is not None:
            body.remove(body.find("w:sectPr", NS))
            rest[-1].find("w:pPr", NS).remove(sp)
            body.append(sp)
    xml = etree.tostring(doc, xml_declaration=True, encoding="UTF-8", standalone=True)

    used = set(re.findall(rb'r:(?:id|embed|link|pict)="([^"]+)"', xml))
    rels = copy.deepcopy(src.rels)
    keep_targets = set()
    for rel in list(rels):
        rid = rel.get("Id").encode()
        typ = rel.get("Type").rsplit("/", 1)[-1]
        if typ in ("header", "footer", "image", "oleObject", "chart", "diagram") and rid not in used:
            rels.remove(rel)
            continue
        if rel.get("TargetMode") != "External":
            keep_targets.add("word/" + rel.get("Target"))

    buf = io.BytesIO()
    zo = zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED)
    ct = etree.fromstring(src.files["[Content_Types].xml"])
    names = []
    for name, data in src.files.items():
        if name == "word/document.xml":
            names.append((name, xml))
            continue
        if name == "word/_rels/document.xml.rels":
            names.append((name, etree.tostring(rels, xml_declaration=True, encoding="UTF-8", standalone=True)))
            continue
        if name.startswith("word/media/") or re.match(r"word/(header|footer)\d+\.xml$", name) or re.match(r"word/_rels/(header|footer)\d+\.xml\.rels$", name) or name.startswith("word/embeddings/"):
            base = name if not name.startswith("word/_rels/") else "word/" + name.split("/")[-1][:-5]
            if base not in keep_targets:
                continue
        names.append((name, data))
    present = {n for n, _ in names}
    for ov in list(ct):
        if ov.tag.endswith("Override") and ov.get("PartName").lstrip("/") not in present:
            ct.remove(ov)
    for name, data in names:
        zo.writestr(name, etree.tostring(ct, xml_declaration=True, encoding="UTF-8", standalone=True) if name == "[Content_Types].xml" else data)
    zo.close()
    return buf.getvalue()


def find_idx(kids, a, b, startswith, nth=0):
    hits = [i for i in range(a, b) if text(kids[i]).strip().startswith(startswith)]
    return hits[nth]


def sig_subscription_edits(individual):
    def edit(k):
        if individual:
            fill_blank(k[168], 0, "(SUBSCRIBER NAME)")  # Name 1
        else:
            fill_blank(k[151], 0, "(SUBSCRIBER NAME)")  # Name (entity)
        fill_blank(k[178], 0, "(AMOUNT)")
        fill_blank(k[178], 0, "(INTERESTS)")  # the first blank was just replaced
        fill_blank(k[180], 0, "(MAILING ADDRESS)")
        set_runs(k[183], [("t", "Telephone: "), ("p", "(TELEPHONE)"), ("br", ""), ("t", "Email: "), ("p", "(EMAIL)")])
        ind = k[183].find("w:pPr/w:ind", NS)
        if ind is not None and ind.get(W + "right") is not None:
            del ind.attrib[W + "right"]  # the source's wide right indent only made the blanks wrap
        # Manager Acceptance page
        append_text(k[2981], "(SUBSCRIBER NAME)")
        fill_blank(k[2983], 0, "(AMOUNT)")
        fill_blank(k[2986], 0, "(AMOUNT)")
        fill_blank(k[2989], 0, "(INTERESTS)")
        make_by_line(k[2972], k[2968])
    return edit


def sig_llc_edits(individual):
    def edit(k):
        if individual:
            fill_blank(k[244], 0, "(SUBSCRIBER NAME)")
        else:
            fill_blank(k[222], 0, "(SUBSCRIBER NAME)")
    return edit


def table_cells(tbl):
    return [[c for c in tr.findall("w:tc", NS)] for tr in tbl.findall("w:tr", NS)]


def set_cell_text(tc, text):
    """Replace a cell's text with one placeholder, keeping the first run's formatting."""
    p = tc.find("w:p", NS)
    set_runs(p, [("p", text)])


def ppm_edits(k):
    # The source Memorandum was cut from a finished deal. Its issuer specific exhibits are not carried
    # into the master (they belong to another company, and the master is committed to the repo):
    # Exhibit A and Exhibit E keep their headings only, and the Information Statement keeps its cover page.
    for i in (1433, 1819):  # (ISSUER LOGO): the master has no logo to place
        assert text(k[i]).strip() == "(ISSUER LOGO)"
        set_runs(k[i], [])
    # The offering table: typed figures become fields, so they can be calculated and cannot go stale.
    tbl = next(e for e in k if e.tag == W + "tbl" and "Aggregate Amount" in text(e))
    rows = table_cells(tbl)
    price, expenses, proceeds = rows[1][1], rows[1][2], rows[1][3]
    amount, agg_exp, agg_proceeds = rows[2][1], rows[2][2], rows[2][3]
    set_runs(price.find("w:p", NS), [("p", "(OFFERING PRICE)"), ("t", " per Interest")])
    set_runs(expenses.find("w:p", NS), [("p", "(EXPENSE PER INTEREST)"), ("t", " per Interest")])
    set_runs(proceeds.find("w:p", NS), [("p", "(PROCEEDS PER INTEREST)"), ("t", " per Interest")])
    set_cell_text(amount, "(OFFERING MAX)")
    set_cell_text(agg_exp, "(OFFERING EXPENSES)")
    set_cell_text(agg_proceeds, "(OFFERING PROCEEDS)")
    # Row labels and the "$" signs sit in the cells' own text; add the dollar sign back where it was.
    for tc in (price, expenses, proceeds, amount, agg_exp, agg_proceeds):
        p = tc.find("w:p", NS)
        first = p.find("w:r", NS)
        if first is not None:
            lead = etree.Element(W + "r")
            t = etree.SubElement(lead, W + "t")
            t.text = "$"
            first.addprevious(lead)


def spouse_edits(k):
    fill_blank(k[201], 0, "(SUBSCRIBER NAME)")


SPECS = {
    "sub-cover-index": dict(ranges=[(0, 55)]),
    "sub-instructions": dict(ranges=[(55, 125)]),
    "sub-sig-subscription-entity": dict(ranges=[(145, 191), (2960, 2991)], drop=range(163, 176), edit=sig_subscription_edits(False)),
    "sub-sig-subscription-individual": dict(ranges=[(145, 191), (2960, 2991)], drop=range(149, 163), edit=sig_subscription_edits(True)),
    "sub-sig-spouse": dict(ranges=[(191, 212)], edit=spouse_edits),
    "sub-sig-llc-entity": dict(ranges=[(212, 253)], drop=range(231, 253), edit=sig_llc_edits(False)),
    "sub-sig-llc-individual": dict(ranges=[(212, 253)], drop=range(220, 237), edit=sig_llc_edits(True)),
    "sub-form-ai-entity": dict(ranges=[(313, 435)]),
    "sub-form-ai-individual": dict(ranges=[(435, 481)]),
    "sub-ppm": dict(ranges=[(487, 1448), (1680, 2717)], edit=ppm_edits),
    "sub-agreement": dict(ranges=[(2767, 2959), (2991, 3346)]),
}

SOURCE_NOTE = "iCFO Venture Subscription Package - BLANK executable.docx"


def write_ts(path, data, note):
    b64 = base64.b64encode(data).decode()
    with open(path, "w") as f:
        f.write("// Master Word file, base64. Source: %s (%s).\n" % (SOURCE_NOTE, note))
        f.write("// Built by scripts/subscription-masters/build.py. The installed copy lives in contract_templates.master_docx.\n")
        f.write("// prettier-ignore\n")
        f.write('export const MASTER_BASE64 =\n  "%s";\n' % b64)


def recover_forms(src, outdir):
    """The IRS forms are embedded as EMF pictures that wrap a PDF. Pull the PDFs out."""
    z = src.files
    pdfs = {}
    for n in range(1, 15):
        d = z["word/media/image%d.emf" % n]
        i = d.find(b"%PDF")
        j = d.rfind(b"%%EOF")
        pdfs[n] = d[i:j + 6]
        with open(os.path.join(outdir, "f%d.pdf" % n), "wb") as f:
            f.write(pdfs[n])

    def merge(out, parts):
        cmd = ["qpdf", "--empty", "--pages"]
        for path, pages in parts:
            cmd += [path, pages]
        cmd += ["--", out]
        r = subprocess.run(cmd)
        if r.returncode not in (0, 3):  # 3 = succeeded with warnings (the recovered PDFs have stray offsets)
            raise SystemExit("qpdf failed")

    d = lambda n: os.path.join(outdir, "f%d.pdf" % n)
    merge(os.path.join(outdir, "w8bene.pdf"), [(d(1), "1")] + [(d(n), "1") for n in range(2, 9)])  # image1 is the whole form; page 1 only
    merge(os.path.join(outdir, "w9.pdf"), [(d(n), "1") for n in range(9, 15)])
    return open(os.path.join(outdir, "w8bene.pdf"), "rb").read(), open(os.path.join(outdir, "w9.pdf"), "rb").read()


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    src = Src(sys.argv[1])
    for key, spec in SPECS.items():
        data = build(src, spec["ranges"], spec.get("drop", ()), spec.get("edit"))
        write_ts(os.path.join(MASTERS_DIR, key + ".ts"), data, key)
        print(key, len(data) // 1024, "KB")
    with tempfile.TemporaryDirectory() as tmp:
        w8, w9 = recover_forms(src, tmp)
    with open(os.path.join(SUB_DIR, "form-pdfs.ts"), "w") as f:
        f.write("// IRS forms the subscription package embeds, recovered from the source file as PDFs.\n")
        f.write("// Built by scripts/subscription-masters/build.py. Sent as is: they have no fields.\n")
        f.write("// prettier-ignore\n")
        f.write('export const W8BENE_PDF_BASE64 =\n  "%s";\n' % base64.b64encode(w8).decode())
        f.write("// prettier-ignore\n")
        f.write('export const W9_PDF_BASE64 =\n  "%s";\n' % base64.b64encode(w9).decode())
    print("forms", len(w8) // 1024, len(w9) // 1024, "KB")


if __name__ == "__main__":
    main()
