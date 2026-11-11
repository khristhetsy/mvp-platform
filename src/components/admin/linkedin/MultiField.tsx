"use client";

import { useId, useState } from "react";
import { MAX_FILTER_VALUES, cleanValues } from "@/lib/linkedin/limits";
import { inputCls } from "./ui";

/**
 * A LinkedIn filter that takes several values. Each value is a chip you can remove.
 * Type a value and press Enter, or leave the box, to add it.
 */
export function MultiField({ label, values, onChange, listId, placeholder }: Readonly<{ label: string; values: string[]; onChange: (next: string[]) => void; listId?: string; placeholder?: string }>) {
  const inputId = useId();
  const [draft, setDraft] = useState("");

  // One value per Enter or blur. No comma splitting: LinkedIn places such as "Paris, Ile-de-France, France" contain commas.
  function commit(text: string) {
    setDraft("");
    if (!text.trim()) return;
    onChange(cleanValues([...values, text]));
  }

  const full = values.length >= MAX_FILTER_VALUES;
  return (
    <div className="text-[12.5px]">
      <label htmlFor={inputId} className="mb-1 block font-medium text-slate-600">
        {label}
        {values.length > 1 ? <span className="font-normal text-slate-500"> ({values.length} selected)</span> : null}
      </label>
      {values.length > 0 ? (
        <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label={`${label}, selected`}>
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-0.5 pl-2.5 pr-1 text-[12px] text-blue-900">
              {v}
              <button type="button" aria-label={`Remove ${v}`} className="flex h-5 w-5 items-center justify-center rounded-full text-blue-600 hover:bg-blue-100 hover:text-blue-900" onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={inputId} className={inputCls} list={listId} value={draft} disabled={full}
        placeholder={full ? `Up to ${MAX_FILTER_VALUES} values` : values.length > 0 ? "Add another" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(draft); } }}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}
