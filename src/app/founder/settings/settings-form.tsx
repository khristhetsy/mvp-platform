"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { Company } from "@/lib/supabase/types";
import { FormField } from "@/components/ui/FormField";
import { useFormValidation, type ZodFlatErrors } from "@/hooks/useFormValidation";

const settingsSchema = z.object({
  company_name: z.string().min(2),
  business_description: z.string().min(20),
  industry: z.string().min(2),
  website: z.string().url().optional().or(z.literal("")),
  logo_url: z.string().url().optional().or(z.literal("")),
});

type Props = {
  company: Company | null;
};

export function CompanySettingsForm({ company }: Props) {
  const router = useRouter();
  const { getError, inputCls, validate, setApiErrors, clearError } = useFormValidation();

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [companyName, setCompanyName] = useState(company?.company_name ?? "");
  const [description, setDescription] = useState(company?.business_description ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logo_url ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragging, setLogoDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadLogo = useCallback(async (file: File) => {
    if (!company) return;
    setLogoUploading(true);
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(`/api/companies/${company.id}/logo`, { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setLogoUploading(false);
    if (r.ok && d.logo_url) {
      setLogoUrl(d.logo_url);
      setMessage({ type: "success", text: "Logo uploaded." });
    } else {
      setMessage({ type: "error", text: d.error ?? "Logo upload failed." });
    }
  }, [company]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void uploadLogo(file);
  }, [uploadLogo]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadLogo(file);
  }, [uploadLogo]);

  const BASE_INPUT = "rounded-xl border px-4 py-3 font-normal w-full";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!company) {
      setMessage({ type: "error", text: "No company profile is linked to your account." });
      return;
    }

    const ok = validate(settingsSchema, {
      company_name: companyName.trim(),
      business_description: description.trim(),
      industry: industry.trim(),
      website: website.trim(),
      logo_url: logoUrl.trim(),
    });
    if (!ok) return;

    setIsSaving(true);

    const response = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: companyName.trim(),
        business_description: description.trim(),
        website: website.trim() || undefined,
        industry: industry.trim(),
        logo_url: logoUrl.trim() || undefined,
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
      details?: ZodFlatErrors;
    } | null;

    setIsSaving(false);

    if (!response.ok) {
      if (body?.details) {
        setApiErrors(body.details);
      } else {
        setMessage({ type: "error", text: body?.error ?? "Unable to save company settings." });
      }
      return;
    }

    setMessage({ type: "success", text: "Settings saved." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Company name" error={getError("company_name")} required>
          <input
            className={`${BASE_INPUT} ${inputCls("company_name")}`}
            value={companyName}
            onChange={(e) => { setCompanyName(e.target.value); clearError("company_name"); }}
            disabled={isSaving}
          />
        </FormField>

        <FormField label="Industry" error={getError("industry")} required>
          <input
            className={`${BASE_INPUT} ${inputCls("industry")}`}
            value={industry}
            onChange={(e) => { setIndustry(e.target.value); clearError("industry"); }}
            disabled={isSaving}
          />
        </FormField>
      </div>

      <FormField label="Website" error={getError("website")} hint="Include https:// — e.g. https://example.com">
        <input
          className={`${BASE_INPUT} ${inputCls("website")}`}
          value={website ?? ""}
          onChange={(e) => { setWebsite(e.target.value); clearError("website"); }}
          disabled={isSaving}
          placeholder="https://example.com"
        />
      </FormField>

      <FormField label="Company logo" error={getError("logo_url")} hint="PNG, JPG, WebP or SVG · max 2 MB">
        {/* Drag-and-drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setLogoDragging(true); }}
          onDragLeave={() => setLogoDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-5 transition-colors ${
            logoDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
          {logoUrl ? (
            <img src={logoUrl} alt="Company logo" className="h-14 w-14 rounded-lg object-contain ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
              <span className="text-2xl">🏢</span>
            </div>
          )}
          <div className="text-center">
            {logoUploading ? (
              <p className="text-sm font-medium text-indigo-600">Uploading…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">
                  {logoUrl ? "Replace logo" : "Drop logo here or click to upload"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">PNG, JPG, WebP, SVG · max 2 MB</p>
              </>
            )}
          </div>
        </div>
        {/* Fallback URL input */}
        <input
          className={`${BASE_INPUT} ${inputCls("logo_url")} mt-2 text-xs`}
          value={logoUrl ?? ""}
          onChange={(e) => { setLogoUrl(e.target.value); clearError("logo_url"); }}
          disabled={isSaving}
          placeholder="Or paste a logo URL: https://…"
        />
      </FormField>

      <FormField label="Description" error={getError("business_description")} required hint="Min 20 characters">
        <textarea
          rows={6}
          className={`${BASE_INPUT} ${inputCls("business_description")}`}
          value={description}
          onChange={(e) => { setDescription(e.target.value); clearError("business_description"); }}
          disabled={isSaving}
        />
      </FormField>

      {message ? (
        <p
          className={
            message.type === "success"
              ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
              : "rounded-xl bg-red-50 p-3 text-sm text-red-700"
          }
        >
          {message.text}
        </p>
      ) : null}

      <button
        className="cap-btn-primary inline-flex justify-center rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        type="submit"
        disabled={isSaving}
      >
        {isSaving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
