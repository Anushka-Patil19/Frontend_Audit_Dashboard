import { createFileRoute } from "@tanstack/react-router";
import { useAudit } from "@/lib/audit-store";
import { ActivityFeed } from "@/components/audit/panels";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Audit Intelligence" },
      {
        name: "description",
        content:
          "Chronological log of worker verifications, connector syncs and human overrides across the audit checklist.",
      },
      { property: "og:title", content: "Activity — Audit Intelligence" },
      {
        property: "og:description",
        content: "Sync and review activity log for continuous compliance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { feed } = useAudit();
  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <PageHeader title="Activity" subtitle="Every worker verification, sync and human decision" />
      <ActivityFeed entries={feed} />
    </div>
  );
}
