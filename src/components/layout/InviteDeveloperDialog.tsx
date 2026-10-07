import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInvite, type CreateInviteResponse } from "@/lib/api-client";
import { projectsData, type ProjectId } from "@/lib/audit-data";
import { useAuth } from "@/lib/auth-store";
import { MANAGER_PERSONA } from "@/lib/manager-data";

const PROJECTS = Object.values(projectsData);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function InviteDeveloperDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { session } = useAuth();
  const defaultProject = PROJECTS.find((p) => p.name === MANAGER_PERSONA.project)?.id ?? "project-a";
  const [projectId, setProjectId] = useState<ProjectId>(defaultProject);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<CreateInviteResponse | null>(null);

  const reset = () => {
    setEmail("");
    setError(null);
    setResult(null);
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) reset();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await createInvite({
        data: {
          email: email.trim(),
          projectId,
          projectName: projectsData[projectId].name,
          invitedBy: session?.name ?? MANAGER_PERSONA.name,
        },
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Invite developer</DialogTitle>
          <DialogDescription>
            They get an emailed link that opens only the Developer view of the project you pick. They can't see the
            Manager or CTO views.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 text-sm">
            {result.emailSent ? (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </span>
                <p className="font-medium text-foreground">Invite sent successfully</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{result.invite.email}</span> will get an email to open
                  the Developer view of <span className="font-medium text-foreground">{result.invite.projectName}</span>.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-foreground">
                The invite email couldn't be sent: {result.emailError}
              </div>
            )}
            <DialogFooter>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-panel-2"
              >
                Invite another
              </button>
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Done
              </button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">Project</span>
              <Select value={projectId} onValueChange={(v) => setProjectId(v as ProjectId)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECTS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">Developer email</span>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-9 w-full rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
            {error && <p className="text-xs text-fail">{error}</p>}
            <DialogFooter>
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-panel-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Send invite
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
