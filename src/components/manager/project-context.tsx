import { createContext, useContext, type ReactNode } from "react";
import { MANAGER_PROJECTS, type ManagerProject } from "@/lib/manager-data";
import type { ProjectId } from "@/lib/audit-data";

// Which project a Manager tab is showing. Sections read their names, components, team and
// mock history from here instead of PIT Armour constants. Defaults to PIT Armour.
const ManagerProjectContext = createContext<ManagerProject>(MANAGER_PROJECTS["project-a"]);

export function ManagerProjectProvider({ pid, children }: { pid: ProjectId; children: ReactNode }) {
  return (
    <ManagerProjectContext.Provider value={MANAGER_PROJECTS[pid]}>
      {children}
    </ManagerProjectContext.Provider>
  );
}

export const useManagerProject = () => useContext(ManagerProjectContext);
