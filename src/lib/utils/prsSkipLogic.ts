import type { ScaleQuestion } from "@/types/prs.types";

/** Evaluates each question's hiddenUnless rule (parsed backend-side from the
 * real skip_logic CSV column) against the answers given so far in this scale.
 * Trigger question not yet answered -> not hidden (show until we know).
 * Options carry numeric `value` (see prsAssessment.service.ts's given_response
 * contract) so the referenced answer's label is resolved via its own options. */
export function computeHiddenQuestionIndices(
  questions: ScaleQuestion[],
  responses: Record<string, number | string>,
): Set<number> {
  const hidden = new Set<number>();
  questions.forEach((q, idx) => {
    const rule = q.hiddenUnless;
    if (!rule) return;
    const refAnswer = responses[String(rule.refIndex)];
    if (refAnswer === undefined) return;
    const refLabel = questions[rule.refIndex]?.options
      ?.find((o) => o.value === Number(refAnswer))
      ?.label?.trim()
      .toLowerCase();
    if (refLabel === undefined) return;
    if (rule.hiddenWhenLabel && refLabel === rule.hiddenWhenLabel.trim().toLowerCase()) {
      hidden.add(idx);
    } else if (rule.visibleOnlyWhenLabel && refLabel !== rule.visibleOnlyWhenLabel.trim().toLowerCase()) {
      hidden.add(idx);
    }
  });
  return hidden;
}
