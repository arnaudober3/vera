# Spec: Onboarding back navigation

**Status:** draft
**Linear:** VER-10
**Owner:** Arnaud
**Last updated:** 2026-07-07

## Context
The onboarding flow (`src/pages/onboarding.tsx`) is a forward-only state
machine: welcome → add-top → add-bottom → outfit → level-up, with optional
detours (add-more, calendar, notifications) that return to level-up. Today the
only ways off a screen are "next" and "skip" — a user who snaps the wrong photo,
or realises they picked the wrong piece, cannot step back to fix it without
skipping the whole flow and restarting. VER-10 asks for a way to go back and
correct a mistake. This spec adds an explicit back affordance to the linear path
and defines what happens to pieces already saved to the closet when a user
returns to a capture step.

## Data contracts
The flow is a single component (`WelcomePage`) holding local React state. No
persisted schema changes; the additions are in-memory only.

- `Step` (existing union, unchanged): `"welcome" | "add-top" | "add-bottom" |
  "outfit" | "levelup" | "add-more" | "calendar" | "notifications"`.
- **Back target map** — a pure, module-level constant driving back navigation on
  the linear path:
  ```ts
  const PREV_STEP: Partial<Record<Step, Step>> = {
    "add-top": "welcome",
    "add-bottom": "add-top",
    "outfit": "add-bottom",
    "add-more": "levelup",
    "calendar": "levelup",
    "notifications": "levelup",
  };
  ```
  A step absent from the map (`welcome` and `levelup`) shows no top-left back
  affordance. `welcome` is the entry point; `levelup` is a hub whose forward
  action is "Finish". The detours (`add-more`, `calendar`, `notifications`) each
  map back to `levelup`. Under `DEBUG`,
  `add-top`/`add-bottom` are never entered, so `outfit`'s back target is
  effectively unreachable — acceptable, no special-casing.
- **Saved-piece slot ids** — new nullable state on `WelcomePage`, one per capture
  slot on the linear path:
  ```ts
  const [topItemId, setTopItemId] = useState<string | null>(null);
  const [bottomItemId, setBottomItemId] = useState<string | null>(null);
  ```
  Each holds the `ClothingItem.id` returned by `addClothingItem` for that slot,
  or `null` if nothing saved yet.
- **`AddPieceScreen` props** — extended so the parent can supply the current slot
  id and receive the newly-saved id:
  - `existingItemId?: string | null` (in) — id previously saved for this slot, to
    be replaced on the next save. Omitted/`null` for the additive `add-more`
    slot.
  - `onComplete(image: string, itemId: string): void` (changed) — now also
    returns the saved `ClothingItem.id` so the parent can track it per slot.
- Existing closet API used as-is: `addClothingItem(item): Promise<ClothingItem>`
  (returns `{ id, imageId, ... }`) and `removeClothingItem(id): Promise<string>`.

## User-visible behavior

### Back affordance
A "Back" control appears in the top-left (mirroring the existing top-right skip)
on every step named as a key in `PREV_STEP`: `add-top`, `add-bottom`, `outfit`,
and the three detours `add-more`, `calendar`, `notifications`. Tapping it returns
the user to the step named by `PREV_STEP` — the previous linear step for the core
path, and back to `levelup` for the detours. `welcome` (entry point) and
`levelup` (a hub whose forward action is "Finish") show no back control. The
detours keep their existing top-right skip alongside the new back control.

### Correcting a captured piece without duplicates
When the user goes back into a capture step whose piece was already saved
(`existingItemId` is set) and captures a replacement, saving first removes the
previously-saved item via `removeClothingItem(existingItemId)`, then saves the
new one. The result is one piece in the closet per slot, reflecting the latest
capture — no duplicates from going back and redoing. The `add-more` (shoes) slot
is additive and is never given an `existingItemId`, so it never replaces.

### Back is inert while work is in flight
On a capture step, the back control is disabled (non-interactive, visibly muted)
while a photo is processing (`phase === "removing"`) or a save is running
(`saving === true`). Once the step settles, back is enabled again.

### Returning forward re-captures
Re-entering a capture step via back resets it to the empty capture state (the
screen remounts on its `key`). The user re-snaps or re-picks to proceed; there is
no "resume with the old photo" state. Outfit and level-up are pure screens and
render their current state when returned to.

## Failure modes
- **Back tapped mid-processing/mid-save:** ignored — control is disabled while
  `phase === "removing"` or `saving`. No state change, no partial navigation.
- **`removeClothingItem` fails during replace:** the failure is logged
  (`console.warn`) and the new piece is still saved. Worst case is one orphaned
  earlier piece in the closet, which the user can delete later; forward progress
  is never blocked by a failed cleanup.
- **Back on the first meaningful step:** `welcome` has no back target and renders
  no back control, so there is no way to navigate before the entry point.
- **Rapid double-tap on back:** navigation is a single `setStep` to a fixed
  target and is idempotent; a double-tap lands on the same previous step.

## Rollout
Additive UI on an existing flow; no data migration, no feature flag. Ships in the
normal build. Monitored informally via onboarding completion (users should no
longer abandon the flow to fix a mistake). Rollback = remove the back control and
the slot-id/replace logic; no persisted state to unwind.

## Out of scope
- Rewriting the flow onto the router / browser history so the hardware/back
  gesture drives it (VER-10 is about an in-app correction affordance).
- Back navigation on the optional detours beyond their existing return-to-level-up
  skip control.
- Persisting onboarding progress across reloads or resuming with a previously
  captured photo pre-filled.
- Inline editing of a piece's auto-generated name/category/colour during
  onboarding.
- Any change to the closet, calendar, or notification data models.

## Open questions
None — both resolved (Arnaud, 2026-07-07): back uses **replace** semantics
(remove the old slot item on the next save), and `levelup` gets **no** back
control (the detours' existing return-to-level-up is their back).
