import { useState } from "react";
import { Eye, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InviteDeveloperDialog } from "@/components/layout/InviteDeveloperDialog";
import { VIEW_ROLES, useRole, type ViewRole } from "@/lib/role-store";

export function RoleSwitcher() {
  const { role, setRole, invite } = useRole();
  const [inviteOpen, setInviteOpen] = useState(false);

  // Invited developers are locked to their one project's Developer view — no switcher.
  if (invite) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-xs text-foreground">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        Developer · {invite.projectName}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
        <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
        View as
      </span>
      <Select value={role} onValueChange={(v) => setRole(v as ViewRole)}>
        <SelectTrigger className="h-8 w-[130px] bg-panel text-xs" aria-label="View dashboard as">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VIEW_ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value} className="text-xs">
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {role === "manager" && (
        <>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-panel text-xs" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Invite developer
          </Button>
          <InviteDeveloperDialog open={inviteOpen} onOpenChange={setInviteOpen} />
        </>
      )}
    </div>
  );
}
