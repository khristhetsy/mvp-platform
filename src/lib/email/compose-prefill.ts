// Pure helpers for composing/replying/forwarding. No React, no I/O — unit-tested
// in node (src/lib/email/compose-prefill.test.ts). These back the F3 compose
// entry point and the prefill table in INBOX_BUILD_SPEC §5.3.

export type ComposeMode = "new" | "reply" | "replyAll" | "forward";

export interface ComposePrefill {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  mode: ComposeMode;
}

const EMPTY: ComposePrefill = { to: [], cc: [], subject: "", body: "", mode: "new" };

/** Case-insensitive de-duped subject prefixer; never stacks (no "Re: Re:"). */
export function prefixSubject(prefix: "Re" | "Fwd", subject: string | null | undefined): string {
  const base = (subject ?? "").trim();
  const re = new RegExp(`^${prefix}:\\s*`, "i");
  if (re.test(base)) return base; // already prefixed — return as-is
  return base ? `${prefix}: ${base}` : `${prefix}:`;
}

export function replySubject(subject: string | null | undefined): string {
  return prefixSubject("Re", subject);
}

export function forwardSubject(subject: string | null | undefined): string {
  return prefixSubject("Fwd", subject);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Dedupe a list of emails case-insensitively, preserving first-seen order and original casing. */
export function dedupeEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const e = (raw ?? "").trim();
    if (!e) continue;
    const key = normalizeEmail(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/**
 * Reply-all recipients: the original sender plus every other recipient, with the
 * current user (self) and duplicates removed. Sender goes to `to`; the remaining
 * other recipients go to `cc` (Gmail-style).
 */
export function replyAllRecipients(input: {
  sender: string;
  recipients: string[];
  self?: string | null;
}): { to: string[]; cc: string[] } {
  const self = input.self ? normalizeEmail(input.self) : null;
  const senderEmail = input.sender.trim();
  const to = senderEmail && normalizeEmail(senderEmail) !== self ? [senderEmail] : [];
  const toKeys = new Set(to.map(normalizeEmail));
  const cc = dedupeEmails(input.recipients).filter((e) => {
    const k = normalizeEmail(e);
    return k !== self && !toKeys.has(k);
  });
  return { to, cc };
}

/** Quoted attribution block for forwards. */
export function forwardQuote(opts: {
  fromEmail: string;
  subject: string | null | undefined;
  date?: string | null;
  body: string | null | undefined;
}): string {
  const dateLine = opts.date ? `Date: ${opts.date}\n` : "";
  return `\n\n---------- Forwarded message ----------\nFrom: ${opts.fromEmail}\n${dateLine}Subject: ${(opts.subject ?? "").trim()}\n\n${opts.body ?? ""}`;
}

/**
 * Single source of truth for what each trigger pre-fills. Mirrors the spec's
 * §5.3 table. All compose triggers should build their prefill through this.
 */
export function buildPrefill(args: {
  mode: ComposeMode;
  sender?: string | null;
  recipients?: string[];
  self?: string | null;
  subject?: string | null;
  body?: string | null;
  date?: string | null;
}): ComposePrefill {
  const { mode } = args;
  switch (mode) {
    case "reply": {
      const to = args.sender ? [args.sender] : [];
      return { ...EMPTY, mode, to, subject: replySubject(args.subject) };
    }
    case "replyAll": {
      const { to, cc } = replyAllRecipients({
        sender: args.sender ?? "",
        recipients: args.recipients ?? [],
        self: args.self,
      });
      return { ...EMPTY, mode, to, cc, subject: replySubject(args.subject) };
    }
    case "forward": {
      const body = args.sender
        ? forwardQuote({ fromEmail: args.sender, subject: args.subject, date: args.date, body: args.body })
        : "";
      return { ...EMPTY, mode, subject: forwardSubject(args.subject), body };
    }
    case "new":
    default: {
      const to = dedupeEmails(args.sender ? [args.sender, ...(args.recipients ?? [])] : args.recipients ?? []);
      return { ...EMPTY, mode: "new", to, subject: (args.subject ?? "").trim(), body: args.body ?? "" };
    }
  }
}
