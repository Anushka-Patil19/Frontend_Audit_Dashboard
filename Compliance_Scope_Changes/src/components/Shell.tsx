import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Bell, BookCheck, ClipboardCheck, FileText, FolderKanban, History, LayoutDashboard, ListChecks, LogOut, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { useSession } from "@/state/session";
import { useQuarter, withQ } from "@/state/quarter";
import { DEMO_TODAY, fmtDate } from "@/data/quarters";
import { PeriodPicker } from "./PeriodPicker";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, ready: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, ready: true },
  { to: "/scope", label: "Scope", icon: ListChecks, ready: true },
  { to: "/review", label: "Review", icon: ClipboardCheck, ready: true },
  { to: "/observations", label: "Observations", icon: MessageSquareWarning, ready: true },
  { to: "/reports", label: "Reports", icon: FileText, ready: true },
  { to: "/notifications", label: "Notifications", icon: Bell, ready: true },
  { to: "/audit-trail", label: "Audit trail", icon: History, ready: true },
];

export function Shell() {
  const { user, signOut } = useSession();
  const location = useLocation();
  const [q] = useQuarter();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar px-3 py-5 text-sidebar-foreground md:flex">
        <Link to={withQ("/", q)} className="mb-1 flex items-center gap-2 px-2 font-serif text-lg">
          <ShieldCheck className="h-5 w-5" strokeWidth={1.8} /> Compliance Review
        </Link>
        <p className="mb-6 px-2 text-[11px] text-sidebar-muted">Audit Intelligence · internal compliance</p>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={withQ(n.to, q)}
              end={n.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm ${isActive ? "bg-sidebar-active text-white" : "text-sidebar-foreground/85 hover:bg-white/5"}`
              }
            >
              <n.icon className="h-4 w-4" strokeWidth={1.8} />
              <span className="flex-1">{n.label}</span>
              {!n.ready && <span className="rounded bg-white/10 px-1.5 font-mono text-[9px] uppercase tracking-wide text-sidebar-muted">soon</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-white/5 p-3 text-xs">
          <p className="font-medium">{user.name}</p>
          <p className="text-sidebar-muted">{user.role}</p>
          <button type="button" onClick={signOut} className="mt-2 inline-flex items-center gap-1.5 text-sidebar-muted hover:text-white">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="mx-auto max-w-[1320px] px-4 pb-12 pt-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-panel/95 px-4 py-3 backdrop-blur md:px-8">
      <BookCheck className="h-4 w-4 text-primary md:hidden" />
      <PeriodPicker />
      <span className="ml-auto font-mono text-[11px] text-faint">Demo data as of {fmtDate(DEMO_TODAY)}</span>
    </header>
  );
}
