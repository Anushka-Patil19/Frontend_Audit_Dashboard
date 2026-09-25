import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { checkRepoDependencies, getDependencyEvidenceScreenshot } from "@/lib/api-client";
import { Mono } from "./atoms";

// CP16 evidence — instead of a static PNG, runs a live requirements.txt
// check against PyPI and shows the screenshot the backend captured of that
// run's results, so the evidence always reflects the repo as it is now.
export function DependencyEvidence() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    setError(null);
    try {
      const res = await checkRepoDependencies({ captureEvidence: true });
      if (!res.ok) throw new Error(res.error);
      if (!res.evidenceScreenshot) throw new Error("The check ran, but the screenshot couldn't be captured.");
      const shot = await getDependencyEvidenceScreenshot({ data: { fileName: res.evidenceScreenshot } });
      if (!shot) throw new Error("Screenshot unavailable.");
      setFileName(res.evidenceScreenshot);
      setCheckedAt(res.checkedAt);
      setDataUrl(shot.dataUrl);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check dependencies.");
      setState("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <Mono className="text-faint">
          {fileName ?? "cp16-dependencies.png"}
          {checkedAt && ` · captured ${new Date(checkedAt).toLocaleString()}`}
        </Mono>
        <button
          onClick={load}
          disabled={state === "loading"}
          className="text-[11px] text-primary hover:underline disabled:opacity-50"
        >
          Re-check
        </button>
      </div>
      <div className="px-3 py-3">
        {state === "loading" && (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking requirements.txt against PyPI and capturing evidence…
          </p>
        )}
        {state === "error" && <p className="text-xs text-fail">{error}</p>}
        {state === "ready" && dataUrl && (
          <a href={dataUrl} target="_blank" rel="noreferrer">
            <img
              src={dataUrl}
              alt="Live dependency version monitoring notification"
              className="max-h-96 w-full rounded border border-border object-contain object-left-top"
            />
          </a>
        )}
      </div>
    </>
  );
}
