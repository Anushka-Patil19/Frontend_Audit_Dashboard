import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
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
  { to: "/projects", label: "Projects", icon: FolderKanban, group: "Audit work" },
  { to: "/findings", label: "Findings", icon: AlertTriangle, group: "Audit work" },
  { to: "/audit-calendar", label: "Audit calendar", icon: CalendarDays, group: "Audit work" },
  { to: "/escalations", label: "Escalations", icon: Timer, group: "Follow-up" },
  { to: "/connectors", label: "Connectors", icon: Plug, group: "Integrations" },
  { to: "/activity", label: "Activity", icon: ScrollText, group: "Records" },
] as const;

// Invited developers only see their Developer home view.
function useNav() {
  const { invite, role } = useRole();
  if (invite) return nav.filter((n) => n.to === "/");
  // Developers don't configure deadlines (PRD: Escalations tab permissions).
  return role === "developer" ? nav.filter((n) => n.to !== "/escalations") : nav;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function AppSidebar() {
  const items = useNav();
  const groups = [...new Set(items.map((n) => n.group))];
  const { session, signOut } = useAuth();
  const { invite, leaveInvite } = useRole();
  const name = invite ? invite.email : (session?.name ?? "Signed out");

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar md:flex">
      <div className="flex items-center gap-2.5 border-b border-sidebar-foreground/10 px-5 py-5">
        {/* Newel cloud mark, cropped from the full logo (1016×640; cloud at x 275–705, y 0–322). */}
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white shadow-sm">
          <span className="relative block h-[20px] w-[26px] overflow-hidden">
            <img
              src="/newel-logo.png"
              alt="Newel Technologies logo"
              className="absolute top-0 max-w-none"
              style={{ width: 61.4, left: -16.6 }}
            />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block font-serif text-base leading-tight text-sidebar-foreground">
            Newel Technologies
          </span>
          <span className="block text-[11px] text-sidebar-muted">Audit Intelligence</span>
        </span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {groups.map((g) => (
          <div key={g}>
            <div className="flex items-center gap-2 px-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/80">{g}</p>
              <span className="h-px flex-1 bg-sidebar-foreground/10" />
            </div>
            <ul className="mt-2 space-y-0.5">
              {items
                .filter((n) => n.group === g)
                .map((n) => (
                  <li key={n.to}>
                    <Link
                      to={n.to}
                      activeOptions={{ exact: n.to === "/" }}
                      className="group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-active/20 hover:text-sidebar-foreground data-[status=active]:bg-sidebar-active data-[status=active]:font-medium data-[status=active]:text-sidebar-foreground data-[status=active]:shadow-sm data-[status=active]:before:absolute data-[status=active]:before:-left-3 data-[status=active]:before:top-1.5 data-[status=active]:before:bottom-1.5 data-[status=active]:before:w-1 data-[status=active]:before:rounded-r-full data-[status=active]:before:bg-sidebar-foreground"
                    >
                      <n.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      {n.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-foreground/10 p-3">
        <div className="rounded-lg bg-sidebar-active/15 p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sidebar-active text-[11px] font-semibold text-sidebar-foreground">
              {initials(name) || "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{name}</p>
              <p className="truncate text-[11px] text-sidebar-muted">
                {invite ? "Developer (invited)" : session?.role}
              </p>
            </div>
          </div>
          <p className="mt-2.5 truncate font-mono text-[10px] text-sidebar-muted">
            {invite ? `${invite.projectName} · Newel Technologies` : "Newel-TECH-01 · Newel Technologies"}
          </p>
          <button
            onClick={invite ? leaveInvite : signOut}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-sidebar-foreground/15 py-1.5 text-[11px] text-sidebar-foreground transition-colors hover:bg-sidebar-foreground/10"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>
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
