# Spec: Onboarding button interaction states (focus / pressed / touch)

**Status:** draft
**Linear:** VER-11
**Owner:** Arnaud
**Last updated:** 2026-07-07

## Context
Users report that buttons in the onboarding flow "are not directly focused so
they look inactive or disabled sometimes" (VER-11, Bug, High). **Arnaud has
confirmed the root cause: sticky hover after tap on touch.** `.vera-btn-primary`
and `.vera-btn-secondary` (App.css) apply `&:hover:not(:disabled) { opacity:
80% }` without gating it behind `@media (hover: hover)`. On a touch device there
is no pointer to move away, so the `:hover` state latches after a tap and the
button stays dimmed to 80% — reading as "inactive/disabled" until the view
changes. (The skip link and the inline-styled back arrow define no `:hover`
rule, so they do not exhibit this; they are out of scope.) Because gating hover
off on touch removes the only tap feedback those buttons had, this spec also
adds an `:active` pressed state so a tap still gives immediate feedback.

Feedback is expressed by **darkening the background color**, not by lowering
opacity: on this light background, reducing opacity fades the button *toward*
the background (it looks lighter/washed-out), which cannot produce the
conventional darker-on-press effect. Hover and press step through darker fills
instead. This is a CSS-only change confined to `src/App.css`.

## Data contracts
There is no serialized data. The "contract" here is the state → appearance
mapping `.vera-btn-primary` and `.vera-btn-secondary` must satisfy. States are
mutually exclusive in priority order: `disabled` > `active` > `hover` > `rest`.

| State | Trigger | Primary (`--vera-btn-primary`) | Secondary (`--vera-btn-secondary`) |
|---|---|---|---|
| `rest` | enabled, no interaction | fill `--vera-primary` (#65aaa7) | fill `--vera-surface` (#fff) |
| `hover` | pointer device only (`@media (hover: hover)`) | fill `--vera-primary-hover` (#5a9996) — darker. Must NOT apply on touch (fixes the sticky-hover bug). | fill `--vera-gray-100` (#f3f4f6) — darker. |
| `active` (pressed) | pointer/touch down on enabled button | fill `--vera-primary-active` (#4f8885) — darker than hover. Clears on pointer-up; fires on touch too. | fill `--vera-gray-200` (#e5e7eb) — darker than hover. |
| `disabled` | `disabled` attribute set | `opacity: 50%`, `cursor: not-allowed`. Unchanged. Guarded out of hover/active via `:not(:disabled)`. | same. |

Darkness order (higher contrast = "darker"): `active` > `hover` > `rest`, and
`disabled` sits apart at 50% opacity. On a mouse press both `:hover` and
`:active` match; `:active` is authored *after* the `@media (hover: hover)` block,
so equal specificity resolves by source order in its favor. Requires a new token
`--vera-primary-active: #4f8885`.

Scope of buttons covered: `.vera-btn-primary` and `.vera-btn-secondary` in
`src/App.css` only (plus the one new token in `:root`). The `.vera-onboarding`
width/padding overrides in onboarding.css must keep working but are not edited.
Reduced motion: hover/active only change `background-color` (transitioned), no
transform, so `prefers-reduced-motion` needs no special handling.

## User-visible behavior

### Tap never leaves a button dimmed (touch)
On a touch device, tapping a primary or secondary onboarding button briefly
darkens it (the pressed fill) and then returns to the rest fill. The button
never latches a hover/pressed color after the finger lifts.

### Pressed feedback darkens the button
Pressing a button immediately darkens its background while held — press is a
step darker than hover — and reverts on release. Fires on both touch and mouse.

### Hover darkens on pointer devices
On a device with a real hover-capable pointer (mouse/trackpad), hovering darkens
the button one step (primary → `--vera-primary-hover`, secondary →
`--vera-gray-100`). Not applied on touch.

### Enabled looks enabled, disabled looks disabled
An enabled button always renders at its full rest fill; only a genuinely
`disabled` button renders dimmed at 50% opacity. No enabled button is confused
for a disabled one.

## Failure modes
- **Touch device with sticky hover (the bug):** hover styling is gated behind
  `@media (hover: hover)`; on `hover: none` pointers no hover fill is applied, so
  a tap can't latch a darkened color — the button shows the rest fill.
- **Hybrid device (touchscreen laptop):** `@media (hover: hover)` keys off the
  primary pointer; hover applies for the mouse and the `:active` fill still
  covers touch taps, so neither input is left without feedback.
- **Reduced motion requested:** hover/active only change `background-color`
  (no transform), so `prefers-reduced-motion: reduce` needs no special handling.
- **Concurrent modification (a button disabled during async work):** hover and
  active are guarded by `:not(:disabled)`, so a `disabled` (50%) button never
  picks up a hover/press fill and never looks interactive.

## Rollout
CSS-only change to `src/App.css`. No feature flag; ships with the next build.
Verification is manual cross-device QA — iOS Safari PWA (standalone) and Android
Chrome to confirm the sticky-hover is gone, plus a desktop mouse check that
hover and press each darken (press darker than hover) — since the project has no
browser/E2E harness (Vitest + jsdom only). Rollback = revert the commit; there
is no data or state migration.

## Out of scope
- `:focus-visible` keyboard focus rings (the app has none anywhere; a separate,
  larger accessibility effort — not the reported bug).
- Programmatically moving focus to a step's primary CTA on mount.
- The skip link and back arrow (no `:hover` rule, so they don't exhibit the bug).
- Redesigning button color, shape, hierarchy, or copy; and any onboarding
  layout/navigation changes.

## Open questions
- None. Root cause confirmed by Arnaud (2026-07-07): sticky hover after tap on
  touch.
