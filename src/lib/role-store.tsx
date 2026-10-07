import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Invite } from "@/lib/api-client";

// POC-only "View as" switch. Stands in for role-based login until real accounts exist:
// CTO = the existing dashboard, Manager = PIT Armour manager view, Developer = developer journey view.
// An accepted invite link (/invite/<token>) locks only that browser tab to the Developer view of one
// project — it lives in sessionStorage, so CTO/Manager tabs open alongside it are unaffected.
export type ViewRole = "cto" | "manager" | "developer";

export const VIEW_ROLES: { value: ViewRole; label: string }[] = [
  { value: "cto", label: "CTO" },
  { value: "manager", label: "Manager" },
  { value: "developer", label: "Developer" },
];

const STORAGE_KEY = "audit-intelligence-view-role";
const INVITE_STORAGE_KEY = "audit-intelligence-invite";

type RoleCtx = {
  role: ViewRole;
  setRole: (r: ViewRole) => void;
  /** Set when this browser opened a developer invite link — role is then fixed to "developer". */
  invite: Invite | null;
  /** False until the saved role / invite has been read from storage. */
  ready: boolean;
  acceptInvite: (invite: Invite) => void;
  leaveInvite: () => void;
};

const RoleContext = createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<ViewRole>("cto");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "cto" || saved === "manager" || saved === "developer") setRoleState(saved);
    // Invites used to be saved in localStorage, which locked every tab; clear any leftover.
    window.localStorage.removeItem(INVITE_STORAGE_KEY);
    try {
      const raw = window.sessionStorage.getItem(INVITE_STORAGE_KEY);
      if (raw) setInvite(JSON.parse(raw) as Invite);
    } catch {
      /* ignore unreadable invite */
    }
    setReady(true);
  }, []);

  const setRole = (r: ViewRole) => {
    if (invite) return;
    setRoleState(r);
    window.localStorage.setItem(STORAGE_KEY, r);
  };

  const acceptInvite = (next: Invite) => {
    setInvite(next);
    window.sessionStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(next));
  };

  const leaveInvite = () => {
    setInvite(null);
    window.sessionStorage.removeItem(INVITE_STORAGE_KEY);
  };

  return (
    <RoleContext.Provider
      value={{ role: invite ? "developer" : role, setRole, invite, ready, acceptInvite, leaveInvite }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
