# Product-grade first combat slice

## Product promise

**Move like a fighter. Land the opening. Read the response.** Anime Motion Fighter is a short, camera-based contact duel in which the player’s body becomes the controller. The game should feel like a dramatic training arena, not a pose-detection dashboard.

## Default session

The default session is a single shared arena camera with both fighters visible at a readable distance. Split POV remains available through the existing control, but it is not the first impression. The live camera feed is shown as a small, clean monitoring card rather than a large diagnostic panel. The debug skeleton remains opt-in.

## Core states

The combat loop has five readable states: **READY**, **WIND-UP**, **STRIKE**, **CONTACT**, and **RECOVERY**. A limb does not score merely because it overlaps a target. A strike must begin from a neutral or recovery state, cross a velocity threshold toward the target, and then enter the torso zone. After contact, that limb enters recovery for a short window so one gesture cannot produce repeated hits.

A limb-to-limb intersection resolves as **BLOCK** before torso scoring. A block creates a visible spark, a short “BLOCK” response, and a small momentum shift. A torso hit creates a short hit-stop, impact ring, damage response, and a score event. The game never hides why a point happened.

## Match structure

Each round is first to three clean contacts. A round lasts long enough to understand the rhythm but not long enough to become exhausting. The opponent gives readable telegraph cues. The player’s immediate goal is always visible through a small center prompt, such as “READY,” “GUARD,” or “STRIKE.”

## Presentation rules

The arena uses one camera by default, keeps both fighters inside a safe readable frame, and reserves the center for the contact zone. The HUD shows only health, round score, current state, and one concise feedback label. Sensitivity, camera direction, scene view, split POV, manual controls, and diagnostics are grouped under settings or fallback controls.

## Acceptance criteria

The first redesigned slice is successful when a new player can start a round within two decisions, understand the current state without reading documentation, distinguish a hit from a block, see both fighters clearly, and recover from missing camera permission without losing the match. The existing front/back camera options, front/side/rear view options, two-player mode, and keyboard fallback remain available.
