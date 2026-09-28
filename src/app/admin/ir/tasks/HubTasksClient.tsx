"use client";

/** Hub-level Tasks: the weekly board with a founder picker on top ("All founders" or one). Remembers the last choice. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TasksClient } from "../projects/[id]/tasks/TasksClient";
import { AllFoundersBoard } from "./AllFoundersBoard";

const KEY = "ir.tasks.project";
const ALL = "all";

export function HubTasksClient({ meId, projects }: { meId: string; projects: Array<{ id: string; title: string; founder_name: string | null }> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const fromUrl = sp.get("project");
  const valid = (id: string | null) => !!id && (id === ALL || projects.some((p) => p.id === id));
  const [projectId, setProjectId] = useState<string>(() => valid(fromUrl) ? fromUrl! : projects[0]?.id ?? "");
  useEffect(() => {
    if (fromUrl) return;
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(KEY); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the last founder after mount (localStorage isn't available during SSR)
    if (valid(saved)) setProjectId(saved!);
  }, [fromUrl, projects]); // eslint-disable-line react-hooks/exhaustive-deps
  function pick(id: string) {
    setProjectId(id);
    try { window.localStorage.setItem(KEY, id); } catch { /* ignore */ }
    router.replace(`/admin/ir/tasks?project=${id}`);
  }
  if (!projects.length) return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
      <p className="font-medium text-slate-900">No active projects</p>
      <p className="mt-1">Tasks are the weekly investor batches inside a project. <Link href="/admin/ir/projects/new" className="text-indigo-700 hover:underline">Create a project</Link> or run the Odoo import first.</p>
    </div>
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-[12.5px] text-slate-600">Founder
          <select value={projectId} onChange={(e) => pick(e.target.value)} className="ml-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none">
            <option value={ALL}>All founders ({projects.length})</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}{p.founder_name ? ` · ${p.founder_name}` : ""}</option>)}
          </select>
        </label>
      </div>
      {projectId === ALL ? <AllFoundersBoard /> : projectId ? <TasksClient key={projectId} projectId={projectId} meId={meId} initialMonth={null} /> : null}
    </div>
  );
}
