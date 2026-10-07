import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// POC-only "View as" switch. Stands in for role-based login until real accounts exist:
// CTO = the existing dashboard, Manager = PIT Armour manager view, Developer = developer journey view.
export type ViewRole = "cto" | "manager" | "developer";

export const VIEW_ROLES: { value: ViewRole; label: string }[] = [
  { value: "cto", label: "CTO" },
  { value: "manager", label: "Manager" },
  { value: "developer", label: "Developer" },
];

const STORAGE_KEY = "audit-intelligence-view-role";

type RoleCtx = { role: ViewRole; setRole: (r: ViewRole) => void };

const RoleContext = createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<ViewRole>("cto");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "cto" || saved === "manager" || saved === "developer") setRoleState(saved);
  }, []);

  const setRole = (r: ViewRole) => {
    setRoleState(r);
    window.localStorage.setItem(STORAGE_KEY, r);
  };

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
