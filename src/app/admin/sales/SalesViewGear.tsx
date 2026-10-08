"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToolbarGear, type GearItem } from "@/components/admin/ToolbarGear";

type Member = { id: string; name: string };

/**
 * The Sales View scope (Me / Team / Someone else) from ?viewAs=. Gated on the
 * manage_crm permission: Member Sales reps get canViewTeam=false and only ever
 * see their own accounts, so no View section renders for them.
 */
export function useSalesView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewAs = searchParams.get("viewAs"); // null | "me" | userId
  const [members, setMembers] = useState<Member[]>([]);
  const [canViewTeam, setCanViewTeam] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/sales/view-scope")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setCanViewTeam(Boolean(d.canViewTeam));
        if (Array.isArray(d.members)) setMembers(d.members);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const selectedMember = useMemo(() => members.find((m) => m.id === viewAs) ?? null, [members, viewAs]);
  const mode: "me" | "team" | "user" = viewAs === "me" ? "me" : selectedMember ? "user" : "team";
  const label = mode === "me" ? "Me" : mode === "user" && selectedMember ? selectedMember.name : "Team";

  function setView(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === "team") sp.delete("viewAs");
    else sp.set("viewAs", value);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return { canViewTeam, members, viewAs, mode, label, selectedMember, setView };
}

type SalesView = ReturnType<typeof useSalesView>;

const row = (on: boolean): React.CSSProperties => ({
  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", border: "none", cursor: "pointer",
  fontSize: 12.5, background: on ? "#EEF2FF" : "none", color: on ? "#4338CA" : "var(--foreground)", fontWeight: on ? 600 : 400,
});

function ViewSection({ view, close }: { view: SalesView; close: () => void }) {
  const [others, setOthers] = useState(view.mode === "user");
  const pick = (v: string) => { view.setView(v); close(); };
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" }}>View</div>
      <button type="button" onClick={() => pick("me")} style={row(view.mode === "me")}>
        <i className="ti ti-user" style={{ fontSize: 15 }} aria-hidden="true" /><span style={{ flex: 1 }}>Me</span>
        {view.mode === "me" && <i className="ti ti-check" aria-hidden="true" />}
      </button>
      <button type="button" onClick={() => pick("team")} style={row(view.mode === "team")}>
        <i className="ti ti-users" style={{ fontSize: 15 }} aria-hidden="true" /><span style={{ flex: 1 }}>Team</span>
        {view.mode === "team" && <i className="ti ti-check" aria-hidden="true" />}
      </button>
      {view.members.length > 0 && (
        <>
          <button type="button" onClick={() => setOthers((v) => !v)} aria-expanded={others} style={row(view.mode === "user")}>
            <i className="ti ti-user-search" style={{ fontSize: 15 }} aria-hidden="true" />
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{view.mode === "user" && view.selectedMember ? view.selectedMember.name : "Someone else"}</span>
            <i className={`ti ${others ? "ti-chevron-down" : "ti-chevron-right"}`} aria-hidden="true" />
          </button>
          {others && (
            <div style={{ maxHeight: 220, overflowY: "auto", padding: "2px 0 4px" }}>
              {view.members.map((m) => (
                <button type="button" key={m.id} onClick={() => pick(m.id)} style={{ ...row(m.id === view.viewAs), padding: "6px 13px 6px 30px" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#EEEDFE", color: "#0A1A40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 500, flexShrink: 0 }}>{m.name.slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                  {m.id === view.viewAs && <i className="ti ti-check" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ViewChip({ label }: { label: string }) {
  return (
    <span title="Whose data is in view. Change it in the gear menu." style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 7, background: "#EEF2FF", color: "#4338CA", whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
      {label}
    </span>
  );
}

/** A Sales page's gear: the View section first, then the page's own items. */
export function SalesGear({ items, heading }: { items: GearItem[]; heading?: string }) {
  const view = useSalesView();
  if (!view.canViewTeam) return <ToolbarGear items={items} heading={heading} />;
  return <ToolbarGear items={items} heading={heading} top={(close) => <ViewSection view={view} close={close} />} after={<ViewChip label={view.label} />} />;
}

/** A gear holding only the View section, for Sales pages with no toolbar gear of their own. */
export function SalesViewGear() {
  const view = useSalesView();
  if (!view.canViewTeam) return null;
  return <ToolbarGear items={[]} top={(close) => <ViewSection view={view} close={close} />} after={<ViewChip label={view.label} />} />;
}
