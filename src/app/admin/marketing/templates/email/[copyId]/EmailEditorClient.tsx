"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { renderCopyHtml } from "@/lib/email/render-copy";
import type { BannerMode, CopyStatus, CopyWithMaster } from "@/lib/email/masters-queries";

const PREVIEW_WIDTHS = { desktop: 640, mobile: 390 } as const;

export function EmailEditorClient({ copy }: Readonly<{ copy: CopyWithMaster }>) {
  const [name, setName] = useState(copy.name);
  const [slotValues, setSlotValues] = useState<Record<string, string>>(copy.slot_values ?? {});
  const [bannerMode, setBannerMode] = useState<BannerMode>(copy.banner_mode);
  const [bannerImageUrl, setBannerImageUrl] = useState(copy.banner_image_url ?? "");
  const [footerNote, setFooterNote] = useState(copy.footer_note ?? "");
  const [status, setStatus] = useState<CopyStatus>(copy.status);
  const [width, setWidth] = useState<keyof typeof PREVIEW_WIDTHS>("desktop");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const editableSlots = copy.master.placeholder_schema.slots.filter((s) => s.key !== "banner_image");

  // Live preview: rebuild the copy shape from local state and render client-side.
  const previewHtml = useMemo(
    () =>
      renderCopyHtml(
        { ...copy, slot_values: slotValues, banner_mode: bannerMode, banner_image_url: bannerImageUrl || null },
        "preview",
      ),
    [copy, slotValues, bannerMode, bannerImageUrl],
  );

  function setSlot(key: string, value: string) {
    setSlotValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/marketing/email-templates/copies/${copy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slot_values: slotValues,
          banner_mode: bannerMode,
          banner_image_url: bannerImageUrl || null,
          footer_note: footerNote || null,
          status,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setSaveMsg(res.ok ? "Saved." : json?.error ?? "Save failed.");
    } catch {
      setSaveMsg("Save failed. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTestMsg("Sending…");
    try {
      // Save first so the test reflects the latest edits, then send.
      await save();
      const res = await fetch(`/api/marketing/email-templates/copies/${copy.id}/test`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { to?: string; error?: string } | null;
      setTestMsg(res.ok ? `Test sent to ${json?.to ?? "your address"}.` : json?.error ?? "Test send failed.");
    } catch {
      setTestMsg("Test send failed.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3 text-sm">
          <Link href="/admin/marketing/templates/email" className="text-blue-600 hover:underline">
            ← Templates
          </Link>
          <span className="text-slate-300">/</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-transparent px-1 py-0.5 font-medium text-slate-900 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
          />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-500">{status}</span>
        </div>
        <div className="flex items-center gap-2">
          {testMsg ? <span className="text-xs text-slate-500">{testMsg}</span> : null}
          {saveMsg ? <span className="text-xs text-slate-500">{saveMsg}</span> : null}
          <button
            type="button"
            onClick={() => void sendTest()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Send test email
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save campaign template"}
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[380px_1fr]">
        {/* Left: form */}
        <div className="overflow-auto border-r border-slate-200 bg-white p-5">
          {/* Banner */}
          <section className="mb-5">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Banner</h3>
            <div className="mb-2 flex gap-1.5">
              {(["gradient", "image"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBannerMode(mode)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize ${
                    bannerMode === mode
                      ? "border-blue-300 bg-blue-50 font-semibold text-blue-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            {bannerMode === "image" ? (
              <input
                value={bannerImageUrl}
                onChange={(e) => setBannerImageUrl(e.target.value)}
                placeholder="https://… banner image URL"
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
              />
            ) : (
              <p className="text-[11px] text-slate-400">Uses the locked brand gradient.</p>
            )}
          </section>

          {/* Locked brand notice */}
          <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Logo, colours, and layout are locked to brand and can&apos;t be edited here.
          </div>

          {/* Content slots — generated from the schema, never hardcoded */}
          <section className="mb-5">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Content</h3>
            <div className="grid gap-3">
              {editableSlots.map((slot) => (
                <label key={slot.key} className="block text-xs font-semibold text-slate-600">
                  {slot.label}
                  {slot.required ? <span className="text-red-500"> *</span> : null}
                  {slot.type === "textarea" ? (
                    <textarea
                      value={slotValues[slot.key] ?? ""}
                      maxLength={slot.max_length}
                      onChange={(e) => setSlot(slot.key, e.target.value)}
                      rows={4}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[13px] font-normal"
                    />
                  ) : (
                    <input
                      type={slot.type === "url" ? "url" : "text"}
                      value={slotValues[slot.key] ?? ""}
                      maxLength={slot.max_length}
                      onChange={(e) => setSlot(slot.key, e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[13px] font-normal"
                    />
                  )}
                </label>
              ))}
            </div>
          </section>

          {/* Footer note (optional) + mandatory-footer notice */}
          <section>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Footer</h3>
            <label className="block text-xs font-semibold text-slate-600">
              Footer note <span className="font-normal text-slate-400">(optional)</span>
              <input
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[13px] font-normal"
              />
            </label>
            <p className="mt-2 text-[11px] text-slate-400">
              The company address, Unsubscribe, and permission line are always included and can&apos;t be removed.
            </p>
            <label className="mt-3 block text-xs font-semibold text-slate-600">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CopyStatus)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[13px] font-normal"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </section>
        </div>

        {/* Right: live preview */}
        <div className="flex flex-col overflow-hidden bg-[#eef2f8]">
          <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-500">
            <span>iCFO Capital Global &lt;team@icapos.com&gt;</span>
            <div className="flex gap-1.5">
              {(["desktop", "mobile"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWidth(w)}
                  className={`rounded-md border px-2 py-1 capitalize ${
                    width === w ? "border-blue-300 bg-white font-semibold text-blue-700" : "border-slate-200 text-slate-500"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {/* iframe isolates the email's own styles from the app. */}
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              className="mx-auto block h-full min-h-[600px] w-full rounded-lg border border-slate-200 bg-white"
              style={{ maxWidth: PREVIEW_WIDTHS[width] }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
