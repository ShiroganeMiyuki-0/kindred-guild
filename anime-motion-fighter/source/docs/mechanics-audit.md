# Anime Motion Fighter mechanics audit

## Why the current combat feels wrong

The current camera loop treats almost any sufficiently fast hand or foot movement as an attack. It does not require the movement to be directed toward the opponent, does not require the limb to be extended from a neutral position, and does not provide a real wind-up-to-contact decision. The collision check then uses a generous 3D distance gate around the opponent, so the player can receive a hit result without feeling that they intentionally reached the target.

The game also has different rules in different paths. Camera mode uses velocity plus a broad spatial distance check, manual mode directly executes punch and kick actions, and two-person mode uses landmark torso boxes. This makes the same gesture mean different things depending on the selected mode. Blocking is understandable in two-person mode and manual mode, but camera mode does not yet give the player a reliable defensive action.

## Next mechanical contract

The first camera duel should recognize **intent**, not just motion. A hand or foot must begin from a neutral position, extend toward the opponent’s side of the arena, cross an impact gate, and then enter a short recovery window. A movement that is fast but retracts, travels sideways, or never reaches the extension gate is a miss or movement—not a free hit.

Every strike should move through four readable stages: READY, WIND-UP, CONTACT or MISS, and RECOVERY. Only the transition into CONTACT can deal damage. A blocked or invalid movement must not silently damage either fighter. The existing manual fallback and two-person landmark-box mode remain supported and are not removed.

## Acceptance checks

A stationary pose must never score. A fast movement away from the opponent must not score. One forward extension must produce at most one contact. Returning to neutral must re-arm the limb. A camera permission failure must still leave manual controls usable. The player should be able to explain why a result occurred by reading the visible combat phase.

## Browser verification

The new opening and fighter-selection flow load without visible runtime failure. The player-facing promise is clearer, but the selection screen still reveals the central product risk: the game advertises hand/foot contact combat, while the camera implementation previously recognized raw movement plus a broad spatial distance gate. The next mechanics patch therefore prioritizes intent gating over additional modes, characters, or effects. Existing mode choices and camera preferences remain in place.

## Arena verification

After entering a fresh arena, both fighters remained at full health and the center state read “STEP INTO FRAME OR USE MANUAL,” confirming the readiness gate still works. The shared arena framing kept both fighters readable. Opening Manual Controls exposed the existing P1/P2 action controls without removing camera or view preferences, confirming the fallback path remains available while camera mechanics are tightened.

## Defensive response

The camera duel now recognizes a simple guard posture: both hands raised above the shoulders holds the player in GUARD and displays “GUARD — HOLD YOUR GROUND.” This gives the player a clear answer to the AI telegraph without adding a complicated evade system. The posture is intentionally conservative so ordinary arm movement does not silently become a shield.

## Full basic blocks

Guard now fully negates basic punch and kick damage instead of reducing it to a partial chip. A guarded super is also stopped. This matches the intended contact rule more closely: when the defender establishes a block, the attacker receives a readable BLOCKED response and the defender keeps the exchange.

## Defense creates a counter choice

A successful Guard now opens a short counter window. A follow-up punch or kick during that window becomes a stronger counter contact, with explicit feedback such as “COUNTER CONTACT” or “COUNTER KICK.” The window resets at each round boundary, so defense creates a deliberate next decision without adding a persistent hidden advantage.

## Counter-window browser verification

The Fighter opening still presents a concise first-round objective, the original sci-fi arena identity, front/back capture choices, front/side/rear views, manual fallback, split POV, and webcam access after the counter-window change. The new decision remains a combat-layer change rather than a new technical panel.

## AI guard recovery

When the adaptive opponent reacts to a player punch with Guard, it now communicates “OPPONENT GUARDS — RESET OR COUNTER” and exits that defensive stance after a bounded recovery window. This prevents a reactive guard from becoming an indefinite passive state.


## Front-facing and side-facing camera contract

The game now separates three choices that were previously easy to confuse. **Capture** selects the physical device lens (`FRONT` or `BACK`); **Arena** selects the 3D presentation camera (`FRONT`, `SIDE`, or `REAR`); and **Tracking** describes how the player stands relative to the selected lens (`FACING LENS` or `SIDE-FACING`). The arena view does not change which camera is capturing the player, so a Shadow Fight-style side arena can be used with either front- or back-camera capture.

In `SIDE-FACING`, the player should turn roughly 70–90 degrees while keeping the full body, hands, feet, and shoulders visible. The contact rules remain the same—hands and feet are the action points, and the torso is the target—so the side preference changes presentation and guidance rather than secretly changing scoring thresholds. This keeps the game understandable and fair across orientations.

## Camera preview privacy control

The live camera preview is now an aesthetic, local preference rather than a requirement for tracking. **Hide Camera** removes only the picture-in-picture monitor; the hidden video element, camera stream, and pose loop continue until the player stops or changes the webcam. The button changes to **Show Camera**, uses an accessible pressed state, and persists the preference locally. This supports players who want the game to feel like a clean arena rather than a self-view screen without pretending that camera capture has stopped.

Tracking-loss feedback now refers to the selected orientation. A side-facing player sees a direction such as “TURN PROFILE, KEEP HANDS + FEET VISIBLE” instead of a generic failure message. Manual controls remain the explicit fallback when camera access or pose tracking is unavailable.

## Camera contract verification

The local browser rendered the new independent controls for capture direction, arena view, tracking profile, and preview visibility. Selecting `SIDE-FACING` updated the persisted preference, and toggling the visibility control changed the label to `SHOW CAMERA` while leaving the tracking contract intact. Static JavaScript checks and the existing game verification script passed after the change.


## Calibration and explainable feedback

The Fighter now has an explicit **Calibrate** action. It checks that the player is centered, that the full body is visible, and that the selected front-facing or side-facing posture is plausible before the player relies on camera combat. A failed check explains the adjustment in human terms, such as moving back, centering the body, or turning more clearly into profile.

Combat feedback now includes a short explanation beneath the main phase label. The player can see whether the game is waiting for a clear extension, checking a valid intent gate, counting contact, recognizing a block, or pausing because tracking is not trustworthy.

Appending `?test=1` enables a local-only usability panel. It gives a moderator a neutral instruction, records high-level in-session events such as calibration start and combat phases, and exports a JSON observation log locally. It does not upload camera frames or telemetry.
