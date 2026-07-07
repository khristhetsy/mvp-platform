"use client";

// Reusable department-membership chips + add-select. Options reflect the live
// Feature Controls departments. Used in User Management and User Permissions.

export type DeptOption = { id: string; name: string; isAdmin: boolean };

export function DeptChips({
  departments,
  memberIds,
  onToggle,
  disabled,
}: {
  departments: DeptOption[];
  memberIds: string[];
  onToggle: (departmentId: string, member: boolean) => void;
  disabled?: boolean;
}) {
  const inSet = new Set(memberIds);
  const current = departments.filter((d) => inSet.has(d.id));
  const available = departments.filter((d) => !inSet.has(d.id));
  return (
    <div className="flex flex-wrap items-center gap-1">
      {current.map((d) => (
        <span key={d.id} className="inline-flex items-center gap-1 rounded-full border border-[#D7E3F8] bg-[#EEF3FC] px-2 py-0.5 text-[10.5px] font-semibold text-[#0A1A40]">
          {d.name}
          {!disabled && (
            <button type="button" onClick={() => onToggle(d.id, false)} className="text-[#6B7690] hover:text-[#A32D2D]" aria-label={`Remove ${d.name}`}>×</button>
          )}
        </span>
      ))}
      {!disabled && available.length > 0 && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) onToggle(e.target.value, true); }}
          className="rounded-full border border-dashed border-[#C7D2E8] bg-white px-2 py-0.5 text-[11px] text-[#6B7690]"
          aria-label="Add department"
        >
          <option value="">+ dept</option>
          {available.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}
      {current.length === 0 && (disabled || available.length === 0) && <span className="text-[11px] text-slate-400">—</span>}
    </div>
  );
}
