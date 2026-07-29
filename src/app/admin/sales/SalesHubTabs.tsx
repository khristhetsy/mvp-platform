"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TABS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/admin/sales" },
  { label: "Contacts", href: "/admin/sales/contacts" },
  { label: "Opportunities", href: "/admin/sales/opportunities" },
  { label: "Pipeline", href: "/admin/sales/pipeline" },
  { label: "Forecast", href: "/admin/sales/forecast" },
  { label: "Analytics", href: "/admin/sales/analytics" },
  { label: "Tasks", href: "/admin/sales/tasks" },
  { label: "Settings", href: "/admin/sales/settings" },
];

type Member = { id: string; name: string };

export function SalesHubTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewAs = searchParams.get("viewAs"); // null | "me" | userId
  const [members, setMembers] = useState<Member[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Super-admin only: the endpoint returns [] for everyone else, which hides the switcher.
  useEffect(() => {
    let active = true;
    fetch("/api/sales/contacts/assignable-members")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && Array.isArray(d?.members)) setMembers(d.members); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Preserve viewAs across tab navigation (Settings is never scoped).
  const tabSuffix = viewAs && viewAs !== "team" ? `?viewAs=${encodeURIComponent(viewAs)}` : "";
  const selectedMember = useMemo(() => members.find((m) => m.id === viewAs) ?? null, [members, viewAs]);
  const mode: "me" | "team" | "user" = viewAs === "me" ? "me" : selectedMember ? "user" : "team";

  function setView(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === "team") sp.delete("viewAs");
    else sp.set("viewAs", value);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setMenuOpen(false);
  }

  const seg = (active: boolean): React.CSSProperties => ({
    fontSize: 11.5, fontWeight: active ? 600 : 400, padding: "4px 11px", cursor: "pointer",
    color: active ? "#fff" : "var(--muted-foreground)", background: active ? "#4338CA" : "transparent", border: "none",
  });

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, borderBottom: "0.5px solid var(--border)", marginBottom: 18, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = t.href === "/admin/sales" ? pathname === t.href : pathname.startsWith(t.href);
          const href = t.href === "/admin/sales/settings" ? t.href : `${t.href}${tabSuffix}`;
          return (
            <Link key={t.href} href={href}
              style={{ paddingBottom: 8, fontSize: 12.5, textDecoration: "none",
                color: active ? "#185FA5" : "var(--muted-foreground)",
                fontWeight: active ? 600 : 400,
                borderBottom: active ? "2px solid #2E78F5" : "2px solid transparent" }}>
              {t.label}
            </Link>
          );
        })}
      </div>

      {members.length > 0 && (
        <div style={{ position: "relative", paddingBottom: 6 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "3px 4px 3px 9px" }}>
            <i className="ti ti-eye" style={{ fontSize: 14, color: "#4338CA" }} aria-hidden="true" />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>View</span>
            <div style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
              <button onClick={() => setView("me")} style={seg(mode === "me")}>Me</button>
              <button onClick={() => setView("team")} style={seg(mode === "team")}>Team</button>
              <button onClick={() => setMenuOpen((v) => !v)} style={{ ...seg(mode === "user"), display: "inline-flex", alignItems: "center", gap: 4 }}>
                {selectedMember ? selectedMember.name : "Someone else"}
                <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            </div>
          </div>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 30, width: 220, maxHeight: 300, overflowY: "auto", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", padding: 5 }}>
                {members.map((m) => (
                  <button key={m.id} onClick={() => setView(m.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", background: m.id === viewAs ? "#F7F6FE" : "transparent", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12.5, color: "var(--foreground)" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#EEEDFE", color: "#3C3489", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 500, flexShrink: 0 }}>{m.name.slice(0, 2).toUpperCase()}</span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                    {m.id === viewAs && <i className="ti ti-check" style={{ marginLeft: "auto", color: "#4338CA" }} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
