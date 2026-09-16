"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import styles from "./VenueViewer.module.css";

// ssr: false must live in a Client Component (Next 16 rule) — hence this wrapper.
const VenueScene = dynamic(() => import("./VenueScene"), { ssr: false });

export default function VenueViewer({
  venueId,
  stageId,
}: {
  venueId: string;
  stageId?: string;
}) {
  const router = useRouter();
  const mode = stageId === "end-stage" ? "concert" : "baseball";

  const switchMode = (nextMode: "baseball" | "concert") => {
    if (nextMode === mode) return;
    const nextStage = nextMode === "baseball" ? "baseball" : "end-stage";
    router.replace(`/venue/${encodeURIComponent(venueId)}?stage=${nextStage}`, { scroll: false });
  };

  const activeStage = mode === "baseball" ? "baseball" : "end-stage";

  return (
    <div className={styles.viewer}>
      <VenueScene key={activeStage} venueId={venueId} stageId={activeStage} />
      <div className={styles.modeSwitch} role="group" aria-label="場館配置">
        <button
          type="button"
          className={mode === "baseball" ? styles.active : ""}
          aria-pressed={mode === "baseball"}
          onClick={() => switchMode("baseball")}
        >
          <span aria-hidden="true">⚾</span>
          棒球場
        </button>
        <button
          type="button"
          className={mode === "concert" ? styles.active : ""}
          aria-pressed={mode === "concert"}
          onClick={() => switchMode("concert")}
        >
          <span aria-hidden="true">♪</span>
          演唱會
        </button>
      </div>
    </div>
  );
}
