"use client";

/**
 * Chip-style recipient field with contact search. Type a name or address to search the
 * shared CRM contacts, or type a full email and press Enter or comma to add it.
 * The value is a comma separated string so it drops into the existing send payloads.
 */

import { useEffect, useRef, useState } from "react";

type Suggestion = { name: string; email: string };

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function splitRecipients(value: string): string[] {
  return value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

export function RecipientPicker({
  value,
  onChange,
  placeholder = "Type an email or search contacts",
  ariaLabel = "Recipients",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const chips = splitRecipients(value);
  const [text, setText] = useState("");
  const [sug, setSug] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const typed = text.trim();
  const lower = chips.map((c) => c.toLowerCase());
  const visible = sug.filter((s) => !lower.includes(s.email.toLowerCase()));
  const canAddTyped = EMAIL_RE.test(typed) && !lower.includes(typed.toLowerCase()) && !visible.some((s) => s.email.toLowerCase() === typed.toLowerCase());
  const rows: Array<Suggestion & { typed?: boolean }> = canAddTyped ? [...visible, { name: typed, email: typed, typed: true }] : visible;

  const add = (email: string) => {
    const e = email.trim();
    if (!EMAIL_RE.test(e)) { setErr("That doesn't look like an email address. Check it and try again."); return; }
    if (lower.includes(e.toLowerCase())) { setErr("Already added."); return; }
    onChange([...chips, e].join(", "));
    setText(""); setSug([]); setOpen(false); setErr(null); setActive(0);
    inputRef.current?.focus();
  };

  const removeAt = (i: number) => onChange(chips.filter((_, idx) => idx !== i).join(", "));

  const onInput = (v: string) => {
    setText(v); setErr(null);
    if (timer.current) clearTimeout(timer.current);
    const q = v.trim();
    if (q.length < 1) { setSug([]); setOpen(false); return; }
    setOpen(true);
    const id = ++reqId.current;
    timer.current = setTimeout(() => {
      void fetch(`/api/admin/contacts/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { contacts: [] }))
        .then((d) => {
          if (id !== reqId.current) return;
          setSug(Array.isArray(d.contacts) ? d.contacts : []);
          setActive(0);
        })
        .catch(() => { if (id === reqId.current) setSug([]); });
    }, 160);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(rows.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" || e.key === "," || e.key === ";") {
      if (!typed) { if (e.key === "Enter") return; e.preventDefault(); return; }
      e.preventDefault();
      if (open && rows[active] && (e.key === "Enter" || !EMAIL_RE.test(typed))) add(rows[active].email);
      else add(typed);
    }
    else if (e.key === "Backspace" && !text && chips.length) { removeAt(chips.length - 1); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const onBlur = () => {
    setFocused(false); setOpen(false);
    if (typed && EMAIL_RE.test(typed)) add(typed);
  };

  const initials = (n: string) => n.split(/\s+/).map((x) => x[0] ?? "").join("").slice(0, 2).toUpperCase() || "@";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        onClick={() => inputRef.current?.focus()}
        style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", minHeight: 36, padding: "4px 8px", borderRadius: 8, boxSizing: "border-box", background: "var(--background)", border: focused ? "0.5px solid #185FA5" : "0.5px solid var(--border)", boxShadow: focused ? "0 0 0 2px #E6F1FB" : "none" }}
      >
        {chips.map((c, i) => (
          <span key={`${c}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#E6F1FB", color: "#0C447C", borderRadius: 999, padding: "2px 6px 2px 10px", fontSize: 12 }}>
            {c}
            <button type="button" aria-label={`Remove ${c}`} onClick={(ev) => { ev.stopPropagation(); removeAt(i); }} style={{ all: "unset", cursor: "pointer", display: "inline-flex", fontSize: 13 }}>
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { setFocused(true); if (typed) setOpen(true); }}
          onBlur={onBlur}
          placeholder={chips.length ? "" : placeholder}
          role="combobox"
          aria-controls="recipient-listbox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open && rows.length > 0}
          autoComplete="off"
          style={{ flex: 1, minWidth: 140, height: 26, border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--foreground)", padding: "0 4px" }}
        />
      </div>
      {open && rows.length > 0 && (
        <div id="recipient-listbox" role="listbox" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 20, background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {rows.map((r, i) => (
            <div
              key={`${r.email}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); add(r.email); }}
              onMouseEnter={() => setActive(i)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, cursor: "pointer", background: i === active ? "var(--muted, #f4f5f7)" : "transparent", fontSize: 12.5 }}
            >
              <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#E6F1FB", color: "#0C447C", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                {r.typed ? <i className="ti ti-mail" aria-hidden="true" /> : initials(r.name)}
              </span>
              <span style={{ minWidth: 0 }}>
                {r.typed ? (
                  <span>Add <strong style={{ fontWeight: 600 }}>{r.email}</strong></span>
                ) : (
                  <>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    {r.name !== r.email && <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email}</div>}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {err && <div role="alert" style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 4 }}>{err}</div>}
    </div>
  );
}
