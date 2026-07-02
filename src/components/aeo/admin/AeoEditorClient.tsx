"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { runAeoComplianceCheck, AEO_CHECK_LABELS, type AeoViolation } from "@/lib/aeo/compliance";
import { CopilotPanel } from "@/components/marketing/copilot/CopilotPanel";

const PURPLE = "#2E78F5";
type Section = { id: string; heading: string; body: string };
type Faq = { q: string; a: string };

const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)", padding: 16 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#0f2147", display: "block", marginBottom: 5 };
const input: React.CSSProperties = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid #d7dce4", fontFamily: "inherit" };

export function AeoEditorClient({ id }: { id: string }) {
  const t = useTranslations("sharedCmp");
  const [loaded, setLoaded] = useState(false);
  const [slug, setSlug] = useState("");
  const [eyebrow, setEyebrow] = useState("");
  const [h1, setH1] = useState("");
  const [lede, setLede] = useState("");
  const [definitionAnswer, setDefinitionAnswer] = useState("");
  const [definedTerm, setDefinedTerm] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [faq, setFaq] = useState<Faq[]>([]);
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [gate, setGate] = useState<{ violations?: AeoViolation[]; blockers?: { label: string }[] } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/aeo/pages/${id}`);
    const d = await res.json();
    if (res.ok) {
      const p = d.page;
      setSlug(p.slug); setEyebrow(p.eyebrow); setH1(p.h1); setLede(p.lede);
      setDefinitionAnswer(p.definitionAnswer); setDefinedTerm(p.definedTerm ?? "");
      setMetaDescription(p.metaDescription); setSections(p.sections ?? []); setFaq(p.faq ?? []);
      setStatus(p.status);
    }
    setLoaded(true);
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Live inline compliance (pure client-side check — same rules the server enforces).
  const liveCheck = useMemo(
    () => runAeoComplianceCheck({ lede, definitionAnswer, sections, faq }),
    [lede, definitionAnswer, sections, faq],
  );

  const save = async () => {
    setSaving(true); setMsg(null); setGate(null);
    try {
      const res = await fetch(`/api/aeo/pages/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, eyebrow, h1, lede, definition_answer: definitionAnswer,
          defined_term: definedTerm.trim() || null, sections, faq, meta_description: metaDescription,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed.");
      setMsg({ text: "Saved.", ok: true });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Save failed.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    await save();
    setGate(null);
    const res = await fetch(`/api/aeo/pages/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
    const d = await res.json();
    if (res.ok) { setStatus("published"); setMsg({ text: "Published — /learn/" + slug + " is live.", ok: true }); return; }
    if (res.status === 422) { setGate({ violations: d.violations, blockers: d.blockers }); setMsg({ text: d.error ?? "Publish blocked.", ok: false }); return; }
    setMsg({ text: d.error ?? "Publish failed.", ok: false });
  };

  const unpublish = async () => {
    const res = await fetch(`/api/aeo/pages/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unpublish" }) });
    if (res.ok) { setStatus("draft"); setMsg({ text: "Unpublished.", ok: true }); }
  };

  if (!loaded) return <p style={{ fontSize: 13, color: "#5f5e5a", padding: 24 }}>{t("loading_2")}</p>;

  const addSection = () => setSections((s) => [...s, { id: `section-${s.length + 1}`, heading: "", body: "" }]);
  const addFaq = () => setFaq((f) => [...f, { q: "", a: "" }]);

  return (
    <>
    <CopilotPanel topic="aeo" pageId={id} onApplied={load} />
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><span style={label}>{t("slug")}</span><input style={input} value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
            <div><span style={label}>{t("eyebrow")}</span><input style={input} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 12 }}><span style={label}>{t("h1_title")}</span><input style={input} value={h1} onChange={(e) => setH1(e.target.value)} /></div>
          <div style={{ marginTop: 12 }}><span style={label}>{t("lede")}</span><input style={input} value={lede} onChange={(e) => setLede(e.target.value)} /></div>
          <div style={{ marginTop: 12 }}>
            <span style={label}>{t("defined_term_definedterm_schema_optional")}</span>
            <input style={input} value={definedTerm} onChange={(e) => setDefinedTerm(e.target.value)} placeholder={t("capital_readiness_rating")} />
          </div>
        </div>

        <div style={card}>
          <span style={label}>{t("definition_answer_the_citable_block")}</span>
          <textarea style={{ ...input, minHeight: 120, resize: "vertical" }} value={definitionAnswer} onChange={(e) => setDefinitionAnswer(e.target.value)} />
          <p style={{ fontSize: 11, color: "#7a8494", margin: "6px 0 0" }}>{t("self_contained_and_liftable_engagement_regis")}</p>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f2147" }}>{t("sections")}</span>
            <button type="button" onClick={addSection} style={{ fontSize: 12, color: PURPLE, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add section</button>
          </div>
          {sections.map((s, i) => (
            <div key={i} style={{ borderTop: i ? "0.5px solid #f2f4f7" : "none", paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
              <input style={{ ...input, marginBottom: 8 }} value={s.heading} placeholder={t("heading_renders_as_h2")}
                onChange={(e) => setSections((arr) => arr.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))} />
              <textarea style={{ ...input, minHeight: 70, resize: "vertical" }} value={s.body} placeholder={t("passage")}
                onChange={(e) => setSections((arr) => arr.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              <button type="button" onClick={() => setSections((arr) => arr.filter((_, j) => j !== i))} style={{ fontSize: 11, color: "#A32D2D", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>{t("remove")}</button>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f2147" }}>{t("faq")}</span>
            <button type="button" onClick={addFaq} style={{ fontSize: 12, color: PURPLE, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add question</button>
          </div>
          {faq.map((f, i) => (
            <div key={i} style={{ borderTop: i ? "0.5px solid #f2f4f7" : "none", paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
              <input style={{ ...input, marginBottom: 8 }} value={f.q} placeholder={t("question")}
                onChange={(e) => setFaq((arr) => arr.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
              <textarea style={{ ...input, minHeight: 60, resize: "vertical" }} value={f.a} placeholder={t("answer_engagement_register_only")}
                onChange={(e) => setFaq((arr) => arr.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
              <button type="button" onClick={() => setFaq((arr) => arr.filter((_, j) => j !== i))} style={{ fontSize: 11, color: "#A32D2D", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>{t("remove")}</button>
            </div>
          ))}
        </div>

        <div style={card}>
          <span style={label}>{t("meta_description")}</span>
          <textarea style={{ ...input, minHeight: 56, resize: "vertical" }} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
        </div>
      </div>

      {/* Sidebar: compliance + actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 12 }}>
        <div style={{ ...card, borderColor: liveCheck.status === "cleared" ? "#BEE7D6" : "#F3C0C0", background: liveCheck.status === "cleared" ? "#F1FAF6" : "#FDF2F2" }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: liveCheck.status === "cleared" ? "#0F6E56" : "#A32D2D", margin: "0 0 8px" }}>
            {liveCheck.status === "cleared" ? "Language check: clear" : `Language check: ${liveCheck.violations.length} issue(s)`}
          </p>
          {liveCheck.violations.length === 0 ? (
            <p style={{ fontSize: 11.5, color: "#5f5e5a", margin: 0 }}>{t("no_outcome_register_guarantee_offer_or_regul")}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: "#7a2323" }}>
              {liveCheck.violations.slice(0, 8).map((v, i) => (
                <li key={i} style={{ marginBottom: 3 }}><b>{AEO_CHECK_LABELS[v.check]}:</b> “{v.phrase}” <span style={{ color: "#9aa3b0" }}>({v.field})</span></li>
              ))}
            </ul>
          )}
        </div>

        {gate?.blockers?.length ? (
          <div style={{ ...card, borderColor: "#EDD3A6", background: "#FBF4E6" }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: "#854F0B", margin: "0 0 6px" }}>{t("exposure_gate_blocking")}</p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: "#7a5b12" }}>
              {gate.blockers.map((b, i) => <li key={i}>{b.label}</li>)}
            </ul>
            <Link href="/admin/marketing/aeo" style={{ fontSize: 12, color: PURPLE, fontWeight: 600, textDecoration: "none", display: "inline-block", marginTop: 6 }}>Resolve on the AEO page →</Link>
          </div>
        ) : null}

        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={() => void save()} disabled={saving}
            style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          {status === "published" ? (
            <button type="button" onClick={() => void unpublish()} style={{ background: "#fff", color: "#A32D2D", border: "1px solid #F3C0C0", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("unpublish")}</button>
          ) : (
            <button type="button" onClick={() => void publish()} disabled={liveCheck.status !== "cleared"}
              title={liveCheck.status !== "cleared" ? "Resolve language issues first" : "Runs both gates then publishes"}
              style={{ background: liveCheck.status === "cleared" ? "#0F6E56" : "#c9cdd6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: liveCheck.status === "cleared" ? "pointer" : "not-allowed" }}>
              Run gates &amp; publish
            </button>
          )}
          <Link href={`/admin/marketing/aeo/${id}/preview`} style={{ textAlign: "center", background: "#fff", color: "#334155", border: "1px solid #d7dce4", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>Preview + X-ray</Link>
          <Link href="/admin/marketing/aeo" style={{ textAlign: "center", fontSize: 12.5, color: "#5f5e5a", textDecoration: "none" }}>← All pages</Link>
          {msg ? <p style={{ fontSize: 12, color: msg.ok ? "#0F6E56" : "#A32D2D", margin: 0 }}>{msg.text}</p> : null}
          <p style={{ fontSize: 11, color: "#9aa3b0", margin: 0 }}>Status: {status}</p>
        </div>
      </div>
    </div>
    </>
  );
}
