import { useAudit } from "@/lib/audit-store";
import { Mono } from "@/components/audit/atoms";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";

export function PageHeader({
  title,
  subtitle,
  titleAction,
  children,
  trailing,
}: {
  title: string;
  subtitle: string;
  titleAction?: React.ReactNode;
  children?: React.ReactNode;
  /** Rendered at the far right, after the clock (e.g. the developer alert bell). */
  trailing?: React.ReactNode;
}) {
  const { clock, dateLabel } = useAudit();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl tracking-tight text-foreground lg:text-3xl">{title}</h1>
          {titleAction}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {children}
        <RoleSwitcher />
        <div className="shrink-0 text-right pl-3 border-l border-border hidden sm:block">
          <p className="font-mono text-lg text-foreground">{clock}</p>
          <Mono className="text-faint">{dateLabel}</Mono>
        </div>
        {trailing}
      </div>
    </header>
  );
}
