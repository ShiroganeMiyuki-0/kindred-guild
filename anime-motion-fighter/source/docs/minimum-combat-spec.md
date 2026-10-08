# Minimum reliable combat contract

## Player inputs

The first stable game loop supports two input families. A player may use camera pose tracking when the browser and camera permit it, or use the existing manual keyboard fallback when tracking is unavailable. The fallback is not an optional afterthought; it is part of the supported experience.

## Combat points

Hands are worth one point when they enter the opponent’s single torso target. Feet are worth two points. In the same-camera mode, contact between a hand or foot and an opponent hand or foot blocks that contact and cancels the torso hit.

## Contact behavior

A torso is represented by one padded box derived from shoulders and hips. A limb scores on entry into the box, not on every frame that it remains inside. This prevents a stationary hand held against the torso from producing repeated hits. If required landmarks are missing or non-finite, the frame is ignored and prior motion/contact state is reset so tracking recovery cannot create a false swing.

## Round behavior

A valid hit produces an explicit points response, updates health, updates the HUD, and passes through the existing round win/loss resolver. A blocked contact produces a visible BLOCK response and does not score a torso hit. Evade remains intentionally deferred until the base contact loop is fair and repeatable.

## Reliability boundaries

Do not add new attack types, online multiplayer, advanced AI promises, or economy mechanics until the following can be verified repeatedly: camera permission recovery, manual fallback, same-camera two-player tracking, one hit per contact entry, block cancellation, round completion, rematch, and clean page-exit camera shutdown.
