export type Role = "FOUNDER" | "INVESTOR" | "ADMIN" | "ANALYST";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isApproved: boolean;
};

const demoUsers: Record<Role, SessionUser> = {
  FOUNDER: {
    id: "demo-founder",
    name: "Maya Founder",
    email: "founder@example.com",
    role: "FOUNDER",
    isApproved: true,
  },
  INVESTOR: {
    id: "demo-investor",
    name: "Jordan Investor",
    email: "investor@example.com",
    role: "INVESTOR",
    isApproved: true,
  },
  ADMIN: {
    id: "demo-admin",
    name: "Avery Admin",
    email: "admin@example.com",
    role: "ADMIN",
    isApproved: true,
  },
  ANALYST: {
    id: "demo-analyst",
    name: "Riley Analyst",
    email: "analyst@example.com",
    role: "ANALYST",
    isApproved: true,
  },
};

export function getDemoUser(role: Role = "FOUNDER") {
  return demoUsers[role];
}

export function canAccess(user: SessionUser, allowedRoles: Role[]) {
  return allowedRoles.includes(user.role);
}

export function roleHome(role: Role) {
  const routes: Record<Role, string> = {
    FOUNDER: "/founder",
    INVESTOR: "/investor",
    ADMIN: "/admin",
    ANALYST: "/admin",
  };

  return routes[role];
}
