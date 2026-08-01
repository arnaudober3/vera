// Back-navigation targets for the onboarding flow. Kept as a pure, dependency-free
// module so the mapping can be unit-tested without rendering the flow.

// The onboarding state machine's steps. Re-exported and consumed by
// onboarding.tsx so there is a single source of truth for the union.
export type Step =
  | "welcome"
  | "add-top"
  | "add-bottom"
  | "outfit"
  | "levelup"
  | "add-more";

// Where the top-left "Back" affordance goes for each step. Steps absent from
// this map (welcome, levelup) show no back control: welcome is the entry point
// and levelup is a hub whose forward action is "Finish". The optional detour
// (add-more) maps back to levelup.
export const PREV_STEP: Partial<Record<Step, Step>> = {
  "add-top": "welcome",
  "add-bottom": "add-top",
  outfit: "add-bottom",
  "add-more": "levelup",
};

// The step to return to when Back is tapped on `step`, or null when the step has
// no back target (welcome, levelup).
export function previousStep(step: Step): Step | null {
  return PREV_STEP[step] ?? null;
}
