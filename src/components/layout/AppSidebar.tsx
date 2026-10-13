import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  AlertTriangle,
  Plug,
  ScrollText,
  LogOut,
  Timer,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useRole } from "@/lib/role-store";

const nav = [
  { to: "/", label: "Home", icon: LayoutDashboard, group: "Overview" },
  { to: "/projects", label: "Projects", icon: FolderKanban, group: "Compliance" },
  { to: "/findings", label: "Findings", icon: AlertTriangle, group: "Compliance" },
  { to: "/escalations", label: "Escalations", icon: Timer, group: "Compliance" },
  { to: "/connectors", label: "Connectors", icon: Plug, group: "Compliance" },
  { to: "/activity", label: "Activity", icon: ScrollText, group: "Compliance" },
] as const;

// Invited developers only see their Developer home view.
function useNav() {
  const { invite, role } = useRole();
  if (invite) return nav.filter((n) => n.to === "/");
  // Developers don't configure deadlines (PRD: Escalations tab permissions).
  return role === "developer" ? nav.filter((n) => n.to !== "/escalations") : nav;
}

export function AppSidebar() {
  const items = useNav();
  const groups = [...new Set(items.map((n) => n.group))];
  const { session, signOut } = useAuth();
  const { invite, leaveInvite } = useRole();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar px-4 py-6 md:flex">
      <div className="flex items-center gap-2.5 px-2">
        {/* Newel cloud mark, cropped from the full logo (1016×640; cloud at x 275–705, y 0–322). */}
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white">
          <span className="relative block h-[20px] w-[26px] overflow-hidden">
            <img
              src="/newel-logo.png"
              alt="Newel Technologies logo"
              className="absolute top-0 max-w-none"
              style={{ width: 61.4, left: -16.6 }}
            />
          </span>
        </span>
        <span className="font-serif text-base leading-tight text-sidebar-foreground">
          Newel Technologies
        </span>
      </div>

      <nav className="mt-8 space-y-6">
        {groups.map((g) => (
          <div key={g}>
            <p className="px-2 text-[11px] tracking-wide text-sidebar-muted">{g}</p>
            <ul className="mt-2 space-y-1">
              {items
                .filter((n) => n.group === g)
                .map((n) => (
                  <li key={n.to}>
                    <Link
                      to={n.to}
                      activeOptions={{ exact: n.to === "/" }}
                      className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-active/25 hover:text-sidebar-foreground data-[status=active]:bg-sidebar-active data-[status=active]:text-sidebar-foreground"
                    >
                      <n.icon className="h-4 w-4" strokeWidth={1.75} />
                      {n.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto rounded-md bg-sidebar-active/20 px-3 py-3">
        <p className="truncate text-xs text-sidebar-foreground">
          {invite ? invite.email : (session?.name ?? "Signed out")}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-sidebar-muted">
          {invite ? "Developer (invited)" : session?.role}
        </p>
        <p className="mt-2 font-mono text-[11px] text-sidebar-muted">
          {invite ? `${invite.projectName} · Newel Technologies` : "Newel-TECH-01 · Newel Technologies"}
        </p>
        <button
          onClick={invite ? leaveInvite : signOut}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-sidebar-foreground hover:underline"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const items = useNav();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-panel px-3 py-2 md:hidden">
      {items.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          activeOptions={{ exact: n.to === "/" }}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground data-[status=active]:bg-primary-soft data-[status=active]:text-primary"
        >
          <n.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
