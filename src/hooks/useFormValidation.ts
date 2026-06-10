"use client";

import { useCallback, useState } from "react";
import type { ZodSchema } from "zod";

type FieldErrors = Record<string, string | undefined>;

export type ZodFlatErrors = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

const FIELD_LABELS: Record<string, string> = {
  company_name: "Company name",
  website: "Website",
  industry: "Industry",
  country: "Country",
  state: "State / region",
  business_description: "Company description",
  founder_goals: "Founder goals",
  funding_amount: "Target raise amount",
  revenue_stage: "Funding stage",
  use_of_funds: "Use of funds",
  email: "Email",
  password: "Password",
  full_name: "Full name",
  fullName: "Full name",
  logo_url: "Logo URL",
  description: "Description",
  investor_type: "Investor type",
  firm_name: "Firm name",
  check_size_min: "Check size (min)",
  check_size_max: "Check size (max)",
  preferred_sectors: "Preferred sectors",
  preferred_geographies: "Preferred geographies",
  preferred_stages: "Investment stage preference",
  investment_thesis: "Investment thesis",
  accredited_status: "Accredited investor attestation",
  contact_preference: "Contact preference",
  name: "Name",
  newPwd: "New password",
  confirmPwd: "Confirm password",
};

function toLabel(field: string): string {
  return (
    FIELD_LABELS[field] ??
    field
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
      .trim()
  );
}

function humanize(field: string, message: string): string {
  const label = toLabel(field);

  if (
    message.toLowerCase().includes("invalid url") ||
    (message.toLowerCase().includes("url") && !message.toLowerCase().includes("required"))
  ) {
    return `${label} must be a valid URL starting with https://`;
  }

  const minMatch = message.match(/at least (\d+)/);
  if (minMatch) {
    return `${label} must be at least ${minMatch[1]} characters`;
  }

  const maxMatch = message.match(/at most (\d+)/);
  if (maxMatch) {
    return `${label} must be no more than ${maxMatch[1]} characters`;
  }

  if (message.toLowerCase().includes("greater than 0") || message.toLowerCase().includes("must be positive")) {
    return `${label} must be a positive number`;
  }

  if (message.toLowerCase().includes("nonnegative") || message.toLowerCase().includes("non-negative")) {
    return `${label} must be zero or greater`;
  }

  if (message.toLowerCase().includes("invalid email")) {
    return `${label} must be a valid email address`;
  }

  if (message.toLowerCase() === "required") {
    return `${label} is required`;
  }

  if (message.toLowerCase().includes("invalid enum value") || message.toLowerCase().includes("invalid option")) {
    return `Please select a valid option for ${label.toLowerCase()}`;
  }

  return message;
}

/**
 * Provides field-level Zod validation with human-readable error messages.
 *
 * Usage:
 *   const { getError, inputCls, validate, setApiErrors, clearError } = useFormValidation();
 *
 *   // Before fetch:
 *   if (!validate(mySchema, { field1, field2 })) return;
 *
 *   // On input change:
 *   onChange={(e) => { setValue(e.target.value); clearError("field1"); }}
 *
 *   // On API error with details:
 *   setApiErrors(body.details);
 *
 *   // On each input:
 *   className={`rounded-xl border px-4 py-3 w-full ${inputCls("field1")}`}
 *
 *   // Below each input (inside FormField):
 *   error={getError("field1")}
 */
export function useFormValidation() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /** Run a Zod schema against data. Populates field errors and returns false if invalid. */
  const validate = useCallback(<T>(schema: ZodSchema<T>, data: unknown): data is T => {
    const result = schema.safeParse(data);
    if (result.success) {
      setFieldErrors({});
      return true;
    }
    const flat = result.error.flatten();
    const errors: FieldErrors = {};
    for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
      if (msgs && msgs.length > 0) {
        errors[key] = humanize(key, msgs[0]);
      }
    }
    setFieldErrors(errors);
    return false;
  }, []);

  /** Merge API-returned Zod field errors (from body.details) into field errors. */
  const setApiErrors = useCallback((details: ZodFlatErrors) => {
    const errors: FieldErrors = {};
    for (const [key, msgs] of Object.entries(details.fieldErrors ?? {})) {
      if (msgs && msgs.length > 0) {
        errors[key] = humanize(key, msgs[0]);
      }
    }
    setFieldErrors((prev) => ({ ...prev, ...errors }));
  }, []);

  /** Clear a single field error (call on onChange). */
  const clearError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** Clear all field errors (call on form reset). */
  const clearAll = useCallback(() => setFieldErrors({}), []);

  /** Get the error message for a field. */
  const getError = useCallback((field: string) => fieldErrors[field], [fieldErrors]);

  /**
   * Returns border + background Tailwind classes for error / normal state.
   * Concat these after your base sizing classes:
   *   className={`rounded-xl border px-4 py-3 w-full ${inputCls("field")}`}
   */
  const inputCls = useCallback(
    (field: string) =>
      fieldErrors[field]
        ? "border-red-400 bg-red-50/60 text-slate-950 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
        : "border-slate-300 text-slate-950 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15",
    [fieldErrors],
  );

  return { fieldErrors, validate, setApiErrors, clearError, clearAll, getError, inputCls };
}
