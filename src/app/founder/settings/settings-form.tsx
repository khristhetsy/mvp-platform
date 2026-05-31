"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/supabase/types";

type Props = {
  company: Company | null;
};

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function CompanySettingsForm({ company }: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [companyName, setCompanyName] = useState(company?.company_name ?? "");
  const [description, setDescription] = useState(company?.business_description ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logo_url ?? "");

  const validationError = useMemo(() => {
    if (!company) return "No company profile is linked to your account.";
    if (companyName.trim().length < 2) return "Company name must be at least 2 characters.";
    if (description.trim().length < 20) return "Description must be at least 20 characters.";
    if (industry.trim().length < 2) return "Industry must be at least 2 characters.";
    if (website && !isValidUrl(website)) return "Website must be a valid URL (include https://).";
    if (logoUrl && !isValidUrl(logoUrl)) return "Logo URL must be a valid URL (include https://).";
    return null;
  }, [company, companyName, description, industry, website, logoUrl]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!company) {
      setMessage({ type: "error", text: "No company profile is linked to your account." });
      return;
    }

    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

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

    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    setIsSaving(false);

    if (!response.ok) {
      setMessage({ type: "error", text: body?.error ?? "Unable to save company settings." });
      return;
    }

    setMessage({ type: "success", text: "Settings saved." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Company name
          <input
            className="rounded-xl border border-slate-300 px-4 py-3 font-normal"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={isSaving}
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Industry
          <input
            className="rounded-xl border border-slate-300 px-4 py-3 font-normal"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            disabled={isSaving}
            required
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Website
        <input
          className="rounded-xl border border-slate-300 px-4 py-3 font-normal"
          value={website ?? ""}
          onChange={(e) => setWebsite(e.target.value)}
          disabled={isSaving}
          placeholder="https://example.com"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Logo URL
        <input
          className="rounded-xl border border-slate-300 px-4 py-3 font-normal"
          value={logoUrl ?? ""}
          onChange={(e) => setLogoUrl(e.target.value)}
          disabled={isSaving}
          placeholder="https://.../logo.png"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Description
        <textarea
          rows={6}
          className="rounded-xl border border-slate-300 px-4 py-3 font-normal"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSaving}
          required
        />
      </label>

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
        disabled={isSaving || Boolean(validationError)}
      >
        {isSaving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}

