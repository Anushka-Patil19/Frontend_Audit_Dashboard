import { Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VIEW_ROLES, useRole, type ViewRole } from "@/lib/role-store";

export function RoleSwitcher() {
  const { role, setRole } = useRole();
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
    </div>
  );
}
