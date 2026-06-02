"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/api/errors";

type ModuleRow = {
  id: string;
  slug: string;
  title: string;
  readiness_stage: string;
  content_status?: string | null;
  is_published?: boolean | null;
};

type LinkRow = { module_id: string; order_index: number };

type Props = {
  courseId: string;
  initialLinks: LinkRow[];
  initialModules: ModuleRow[];
};

export function AdminCourseModulesManager({ courseId, initialLinks, initialModules }: Props) {
  const [allModules, setAllModules] = useState<ModuleRow[]>(initialModules);
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string>(initialLinks[0]?.module_id ?? "");

  useEffect(() => {
    // refresh the module catalog for adding modules
    void (async () => {
      try {
        const res = await fetch("/api/admin/learning/modules");
        const json = (await res.json().catch(() => ({}))) as any;
        if (res.ok && Array.isArray(json.modules)) setAllModules(json.modules as ModuleRow[]);
      } catch {
        // ignore
      }
    })();
  }, []);

  const modulesById = useMemo(() => new Map(allModules.map((m) => [m.id, m])), [allModules]);

  const linked = useMemo(() => {
    return [...links]
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((l) => ({ ...l, module: modulesById.get(l.module_id) }));
  }, [links, modulesById]);

  async function addModule() {
    if (!moduleId) return;
    setLoading(true);
    setError(null);
    try {
      const nextOrder = (linked[linked.length - 1]?.order_index ?? 0) + 10;
      const res = await fetch(`/api/admin/learning/courses/${encodeURIComponent(courseId)}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_id: moduleId, order_index: nextOrder }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw json;
      setLinks((v) => [...v.filter((x) => x.module_id !== moduleId), json.link as LinkRow]);
    } catch (e) {
      setError(formatApiError(e, "Unable to link module."));
    } finally {
      setLoading(false);
    }
  }

  async function removeModule(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/learning/courses/${encodeURIComponent(courseId)}/modules?moduleId=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw json;
      setLinks((v) => v.filter((x) => x.module_id !== id));
    } catch (e) {
      setError(formatApiError(e, "Unable to unlink module."));
    } finally {
      setLoading(false);
    }
  }

  async function saveOrder() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/learning/courses/${encodeURIComponent(courseId)}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw json;
      if (Array.isArray(json.links)) setLinks(json.links as LinkRow[]);
    } catch (e) {
      setError(formatApiError(e, "Unable to save order."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
        >
          <option value="">Select module…</option>
          {allModules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} ({m.slug})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={loading || !moduleId}
          onClick={() => void addModule()}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          Link module
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void saveOrder()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Save order
        </button>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}

      {linked.length === 0 ? (
        <p className="text-sm text-slate-600">No modules linked yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {linked.map((l) => (
            <div key={l.module_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{l.module?.title ?? l.module_id}</p>
                <p className="truncate text-xs text-slate-500">
                  {l.module?.slug ?? "—"} · stage: {l.module?.readiness_stage ?? "—"} · status: {l.module?.content_status ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  value={l.order_index}
                  onChange={(e) =>
                    setLinks((v) => v.map((x) => (x.module_id === l.module_id ? { ...x, order_index: Number(e.target.value) } : x)))
                  }
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void removeModule(l.module_id)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                >
                  Unlink
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

