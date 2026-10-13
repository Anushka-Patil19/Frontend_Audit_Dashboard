import { useEffect, useState } from "react";
import { getEscalationEvidenceScreenshot } from "@/lib/api-client";
import { openImageInNewTab } from "./atoms";

export function EscalationEvidenceScreenshot({ fileName, alt }: { fileName: string; alt: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setError(null);
    void getEscalationEvidenceScreenshot({ data: { fileName } })
      .then((result) => {
        if (!active) return;
        if (result?.dataUrl) {
          setDataUrl(result.dataUrl);
        } else {
          setError("Approval screenshot was not found on the backend.");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load the approval screenshot.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [fileName]);

  if (error) return <p className="mt-2 text-[11px] text-fail">{error}</p>;
  if (!dataUrl) return <p className="mt-2 text-[11px] text-faint">Loading approval screenshot…</p>;

  return (
    <button
      type="button"
      onClick={() => openImageInNewTab(dataUrl)}
      className="mt-2 block w-full overflow-x-auto cursor-zoom-in"
      title="Open full-size screenshot in a new tab"
    >
      <img
        className="w-full min-w-[900px] max-w-none rounded-md border border-border"
        src={dataUrl}
        alt={alt}
      />
    </button>
  );
}
