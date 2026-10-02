/**
 * /fit Match Review booking form config: the contact fields founders fill in and
 * any extra questions. Pure (no server imports) so the client, the admin editor
 * and the API all share one shape and one sanitiser.
 *
 * Name and email are always collected and always required: the scheduler needs a
 * name, and the calendar invite needs the email. Only their labels change.
 */

import type { ScheduleQuestion } from "@/lib/scheduling/types";

export type FitContactFields = {
  name: { label: string };
  email: { label: string };
  phone: { label: string; collect: boolean; required: boolean };
  company: { label: string; collect: boolean; required: boolean };
};

export type FitBookingForm = { contactFields: FitContactFields; questions: ScheduleQuestion[] };

export const MAX_FIT_QUESTIONS = 10;
const MAX_OPTIONS = 20;
const QUESTION_TYPES: ScheduleQuestion["type"][] = ["short_text", "single", "multi"];

export const FIT_BOOKING_FORM_DEFAULTS: FitBookingForm = {
  contactFields: {
    name: { label: "Name" },
    email: { label: "Work email" },
    phone: { label: "Phone", collect: true, required: false },
    company: { label: "Company", collect: true, required: false },
  },
  questions: [],
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const label = (v: unknown, fallback: string, max = 80): string => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || fallback;
};
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

function optional(raw: unknown, d: { label: string; collect: boolean; required: boolean }) {
  const r = obj(raw);
  const collect = bool(r.collect, d.collect);
  return { label: label(r.label, d.label), collect, required: collect && bool(r.required, d.required) };
}

/** Merge a stored (possibly partial, null or malformed) config over the defaults. */
export function resolveFitBookingForm(raw: unknown): FitBookingForm {
  const r = obj(raw);
  const cf = obj(r.contactFields);
  const d = FIT_BOOKING_FORM_DEFAULTS.contactFields;
  const questions: ScheduleQuestion[] = [];
  for (const q of Array.isArray(r.questions) ? r.questions : []) {
    const o = obj(q);
    const text = typeof o.label === "string" ? o.label.trim().slice(0, 300) : "";
    const type = QUESTION_TYPES.includes(o.type as ScheduleQuestion["type"]) ? (o.type as ScheduleQuestion["type"]) : "short_text";
    const options = type === "short_text" ? [] : Array.from(new Set(
      (Array.isArray(o.options) ? o.options : []).map((x) => (typeof x === "string" ? x.trim().slice(0, 120) : "")).filter(Boolean),
    )).slice(0, MAX_OPTIONS);
    if (!text || (type !== "short_text" && options.length === 0)) continue;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 64) : `q${questions.length + 1}`;
    questions.push({ id, label: text, type, options, required: bool(o.required, false) });
    if (questions.length >= MAX_FIT_QUESTIONS) break;
  }
  return {
    contactFields: {
      name: { label: label(obj(cf.name).label, d.name.label) },
      email: { label: label(obj(cf.email).label, d.email.label) },
      phone: optional(cf.phone, d.phone),
      company: optional(cf.company, d.company),
    },
    questions,
  };
}
