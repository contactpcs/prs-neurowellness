import type { AssessmentInstance } from "@/types/domain.types";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";

export interface ClinicalSnapshot {
  score: number | null;
  severity: string | null;
  protocol: ProtocolRead | null;
}

/** Best-effort "as of" snapshot for a given date: the latest PRS completion
 * and latest treatment protocol version recorded on or before it. There's no
 * backend link from a session to "the PRS instance / protocol version
 * recorded at that session", so this reconstructs it from timestamps —
 * good enough to see the improvement trend, not a guarantee that this exact
 * protocol row was the one live during that exact appointment. */
export function asOfSnapshot(
  dateStr: string | undefined | null,
  scoreInstances: AssessmentInstance[],
  protocols: ProtocolRead[],
): ClinicalSnapshot {
  if (!dateStr) return { score: null, severity: null, protocol: null };
  const cutoff = new Date(dateStr + "T23:59:59").getTime();
  const scoresBefore = scoreInstances
    .filter((s) => s.completed_at && new Date(s.completed_at).getTime() <= cutoff)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const protocolsBefore = protocols
    .filter((p) => p.created_at && new Date(p.created_at).getTime() <= cutoff)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return {
    score: scoresBefore[0]?.disease_score ?? null,
    severity: scoresBefore[0]?.severity_label ?? null,
    protocol: protocolsBefore[0] ?? null,
  };
}

export function deltaTone(delta: number, lowerIsBetter = true): string {
  if (delta === 0) return "text-neutral-500";
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return improved ? "text-green-600" : "text-red-600";
}
