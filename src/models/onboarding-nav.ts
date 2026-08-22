// Back-navigation targets for the onboarding flow. Kept as a pure, dependency-free
// module so the mapping can be unit-tested without rendering the flow.

// The onboarding state machine's steps. Re-exported and consumed by
// onboarding.tsx so there is a single source of truth for the union.
export type Step = "welcome" | "add-top" | "add-bottom";

// Where the top-left "Back" affordance goes for each step. The flow is a
// straight line, so every step maps back to the one before it — except
// `welcome`, the entry point, which shows no back control.
export const PREV_STEP: Partial<Record<Step, Step>> = {
  "add-top": "welcome",
  "add-bottom": "add-top",
};

// The step to return to when Back is tapped on `step`, or null when the step has
// no back target (welcome).
export function previousStep(step: Step): Step | null {
  return PREV_STEP[step] ?? null;
}
