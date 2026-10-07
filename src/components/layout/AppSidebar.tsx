import { Link } from "@tanstack/react-router";
import { LayoutDashboard, FolderKanban, AlertTriangle, Plug, ScrollText, ShieldHalf, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useRole } from "@/lib/role-store";

const nav = [
  { to: "/", label: "Home", icon: LayoutDashboard, group: "Overview" },
  { to: "/projects", label: "Projects", icon: FolderKanban, group: "Compliance" },
  { to: "/findings", label: "Findings", icon: AlertTriangle, group: "Compliance" },
  { to: "/connectors", label: "Connectors", icon: Plug, group: "Compliance" },
  { to: "/activity", label: "Activity", icon: ScrollText, group: "Compliance" },
] as const;

// Invited developers only see their Developer home view.
function useNav() {
  const { invite } = useRole();
  return invite ? nav.filter((n) => n.to === "/") : nav;
}

export function AppSidebar() {
  const items = useNav();
  const groups = [...new Set(items.map((n) => n.group))];
  const { session, signOut } = useAuth();
  const { invite, leaveInvite } = useRole();


  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar px-4 py-6 md:flex">
      <div className="flex items-center gap-2 px-2">
        <ShieldHalf className="h-5 w-5 text-sidebar-foreground" strokeWidth={1.75} />
        <span className="font-serif text-lg text-sidebar-foreground">Audit Intelligence</span>
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
        <p className="truncate text-xs text-sidebar-foreground">{invite ? invite.email : (session?.name ?? "Signed out")}</p>
        <p className="mt-0.5 font-mono text-[11px] text-sidebar-muted">{invite ? "Developer (invited)" : session?.role}</p>
        <p className="mt-2 font-mono text-[11px] text-sidebar-muted">
          {invite ? `${invite.projectName} · Acme Capital` : "ACME-CLT-01 · Acme Capital"}
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
