import { AlertCircle } from "lucide-react";

type FormFieldProps = {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * Wraps any input/select/textarea with a label, inline error message, and optional hint.
 * Pair with useFormValidation for field-level Zod validation.
 */
export function FormField({ label, error, hint, required, className, children }: Readonly<FormFieldProps>) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs text-red-600" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
