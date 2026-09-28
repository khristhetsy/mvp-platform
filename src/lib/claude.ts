/**
 * Shared Anthropic Claude API helper — no SDK required, uses native fetch.
 * Env var: ANTHROPIC_API_KEY
 *
 * All AI features in iCapOS (CMO chat, diligence, assistant, learning coach,
 * deal-room summary, video scripts) route through here.
 */

import { getServerLocale, aiLanguageInstruction } from "@/lib/i18n/locale";

export type ClaudeMessage = { role: "user" | "assistant"; content: string };

export interface ClaudeOptions {
  /** Default: claude-haiku-4-5-20251001 (fast). Use claude-sonnet-4-6 for complex tasks. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  /**
   * Output language. When omitted, the current request locale is detected
   * automatically; pass "en" explicitly to force English regardless of locale.
   */
  locale?: "en" | "es";
}

export const CLAUDE_HAIKU  = "claude-haiku-4-5-20251001";
export const CLAUDE_SONNET = "claude-sonnet-4-6";

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return key;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Send a message (or conversation) to Claude and return the text reply.
 */
export async function claudeComplete(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {}
): Promise<string> {
  const {
    model      = CLAUDE_HAIKU,
    maxTokens  = 1024,
    temperature,
    system,
    locale,
  } = options;

  // Localize output: explicit option wins; otherwise detect the request locale.
  const resolvedLocale = locale ?? (await getServerLocale());
  const languageDirective = aiLanguageInstruction(resolvedLocale);
  const finalSystem = languageDirective
    ? `${system ?? ""}${languageDirective}`.trim()
    : system;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = { model, max_tokens: maxTokens, messages };
  if (finalSystem)               body.system      = finalSystem;
  if (temperature !== undefined) body.temperature = temperature;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         getApiKey(),
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content.find((b) => b.type === "text")?.text?.trim() ?? "";
}

/**
 * Send one PDF to Claude as a native document block, with a text prompt.
 *
 * For PDFs whose text layer cannot be extracted locally (scanned decks,
 * image-only statements), Claude reads the pages itself. The Messages API
 * caps a request at 32 MB, so callers should pass files well under that.
 */
export async function claudeCompleteWithPdf(
  pdf: Uint8Array,
  prompt: string,
  options: Omit<ClaudeOptions, "locale"> = {},
): Promise<string> {
  const { model = CLAUDE_HAIKU, maxTokens = 1024, temperature, system } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: Buffer.from(pdf).toString("base64") },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  };
  if (system)                    body.system      = system;
  if (temperature !== undefined) body.temperature = temperature;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         getApiKey(),
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  return data.content.find((b) => b.type === "text")?.text?.trim() ?? "";
}
