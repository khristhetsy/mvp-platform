type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export function apiErrorMessage(error: unknown, fallback = "Request failed."): string {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "object") {
    const record = error as ErrorLike;
    if (record.message) {
      return record.message;
    }
    if (record.details) {
      return record.details;
    }
    if (record.hint) {
      return record.hint;
    }
  }

  return fallback;
}

export function formatApiError(payload: unknown, fallback = "Request failed."): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as {
    error?: unknown;
    message?: unknown;
    details?: unknown;
  };

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  if (typeof record.details === "string" && record.details.trim()) {
    return record.details;
  }

  const error = record.error;

  if (Array.isArray(error)) {
    return error.join(", ");
  }

  const nested = apiErrorMessage(error, "");
  if (nested) {
    return nested;
  }

  if (error && typeof error === "object") {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (formErrors?.length) {
      return formErrors.join(", ");
    }
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    if (fieldErrors) {
      const messages = Object.values(fieldErrors).flat();
      if (messages.length) {
        return messages.join(", ");
      }
    }
  }

  return fallback;
}
