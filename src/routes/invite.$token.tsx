import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, LogIn, ShieldHalf } from "lucide-react";
import { getInvite, type Invite } from "@/lib/api-client";
import { useRole } from "@/lib/role-store";

// Landing page for an emailed developer invite. Rendered outside the sign-in gate:
// a valid token locks this browser to the Developer view of the invited project.
// The "Login" step is a local-only demo — no credentials, nothing checked server-side.
export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Developer invite — Audit Intelligence" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { acceptInvite } = useRole();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getInvite({ data: { token } })
      .then((res) => {
        if (cancelled) return;
        if (!res) setError("This invite link is invalid or has been revoked.");
        else setInvite(res);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't reach the server to check this invite. Try again in a moment.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = () => {
    if (!invite) return;
    setAuthorized(true);
    window.setTimeout(() => {
      acceptInvite(invite);
      void navigate({ to: "/", replace: true });
    }, 900);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 text-center shadow-sm">
        <ShieldHalf className="mx-auto h-7 w-7 text-primary" strokeWidth={1.75} />
        <h1 className="mt-3 font-serif text-xl text-foreground">Developer invite</h1>
        {error ? (
          <p className="mt-2 text-sm text-fail">{error}</p>
        ) : !invite ? (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking your invite…
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {invite.invitedBy ?? "Your manager"} invited{" "}
              <span className="font-medium text-foreground">{invite.email}</span> to view{" "}
              <span className="font-medium text-foreground">{invite.projectName}</span> as a developer.
            </p>
            <button
              type="button"
              onClick={login}
              disabled={authorized}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-90"
            >
              {authorized ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Authorized — opening…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Login
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
