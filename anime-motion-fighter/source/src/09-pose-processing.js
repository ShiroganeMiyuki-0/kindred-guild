// ===================== POSE PROCESSING =====================
function processPose(landmarks) {
  liveVisible = !!landmarks;
  updateCalibration(landmarks);
  const now = performance.now();

  if (!finiteLandmarks(landmarks) || gameState !== 'PLAYING' || roundLocked) {
    livePoseLandmarks = null;
    playerReadyForCombat = false;
    player.isGuarding = false;
    prevWristL = null; prevWristR = null; prevAnkleL = null; prevAnkleR = null;
    lastPoseFrameAt = 0; lastValidPoseAt = 0; lastChargeToneAt = 0; smoother.prev = null;
    if (gameState === 'PLAYING' && !roundLocked) setCombatPhase('TRACKING', 'TRACKING LOST — STEP INTO FRAME', 'text-amber-400');
    return;
  }

  const smoothed = smoother.filter(landmarks);
  livePoseLandmarks = smoothed;
  playerReadyForCombat = true;
  const wrists = [smoothed[15], smoothed[16]], feet = [smoothed[27], smoothed[28]];
  lastValidPoseAt = now;
  const poseDelta = lastPoseFrameAt ? Math.min(120, Math.max(16, now - lastPoseFrameAt)) : 33;
  lastPoseFrameAt = now;

  // Check which body parts are visible for feedback
  const handsVisible = (smoothed[15]?.visibility || 0) > 0.5 && (smoothed[16]?.visibility || 0) > 0.5;
  const feetVisible = (smoothed[27]?.visibility || 0) > 0.5 && (smoothed[28]?.visibility || 0) > 0.5;
  const allVisible = handsVisible && feetVisible;

  const shoulderL = smoothed[11], shoulderR = smoothed[12], hipL = smoothed[23], hipR = smoothed[24];

  // Distance normalization — use shoulder width to scale thresholds
  // This makes detection work whether you're close or far from camera
  const shoulderWidth = ptDist3(shoulderL, shoulderR);
  const distScale = Math.max(0.4, Math.min(2.0, shoulderWidth / 0.18)); // 0.18 = 'ideal' shoulder width
  globalDistScale = distScale;

  // Frame-rate normalized velocity (distance / time in seconds)
  const timeFactor = poseDelta > 0 ? 1000 / poseDelta : 30;
  const handSpeedL = prevWristL ? ptDist3(wrists[0], prevWristL) * timeFactor : 0;
  const handSpeedR = prevWristR ? ptDist3(wrists[1], prevWristR) * timeFactor : 0;
  const footSpeedL = prevAnkleL ? ptDist3(feet[0], prevAnkleL) * timeFactor : 0;
  const footSpeedR = prevAnkleR ? ptDist3(feet[1], prevAnkleR) * timeFactor : 0;
  const handVelocity = Math.max(handSpeedL, handSpeedR);
  const footVelocity = Math.max(footSpeedL, footSpeedR);
  const handReachL = ptDist3(wrists[0], shoulderL), handReachR = ptDist3(wrists[1], shoulderR);
  const footReachL = ptDist3(feet[0], hipL), footReachR = ptDist3(feet[1], hipR);
  const handReach = Math.max(handReachL, handReachR), footReach = Math.max(footReachL, footReachR);
  const prevHandReachL = prevWristL ? ptDist3(prevWristL, shoulderL) : 0;
  const prevHandReachR = prevWristR ? ptDist3(prevWristR, shoulderR) : 0;
  const prevFootReachL = prevAnkleL ? ptDist3(prevAnkleL, hipL) : 0;
  const prevFootReachR = prevAnkleR ? ptDist3(prevAnkleR, hipR) : 0;
  // Scale extension thresholds by distance
  const extThreshold = 0.006 / distScale;
  const handExtending = (handReachL - prevHandReachL > extThreshold) || (handReachR - prevHandReachR > extThreshold);
  const footExtending = (footReachL - prevFootReachL > extThreshold) || (footReachR - prevFootReachR > extThreshold);
  const handExtended = handReach > 0.18 / distScale, footExtended = footReach > 0.24 / distScale;

  prevWristL = wrists[0]; prevWristR = wrists[1]; prevAnkleL = feet[0]; prevAnkleR = feet[1];
  const speedMetricEl = document.getElementById('speedMetric');
  if (speedMetricEl) speedMetricEl.textContent = Math.max(handVelocity, footVelocity).toFixed(2);

  // Update velocity meters — show how close to attack threshold
  const attackThreshold = (sensitivityThreshold * 20) / distScale;
  const punchPct = Math.min(100, (handVelocity / attackThreshold) * 100);
  const kickPct = Math.min(100, (footVelocity / (attackThreshold * 0.8)) * 100);
  const punchMeter = document.getElementById('punchMeter');
  const kickMeter = document.getElementById('kickMeter');
  if (punchMeter) {
    punchMeter.style.width = punchPct + '%';
    punchMeter.style.background = punchPct >= 100 ? '#fbbf24' : '#38bdf8';
  }
  if (kickMeter) {
    kickMeter.style.width = kickPct + '%';
    kickMeter.style.background = kickPct >= 100 ? '#fbbf24' : '#10b981';
  }

  const shoulderCenterY = (shoulderL.y + shoulderR.y) / 2;
  const hipCenterY = (hipL.y + hipR.y) / 2;
  const wristCenterY = (wrists[0].y + wrists[1].y) / 2;
  // Guard: at least ONE hand raised above shoulder level (more forgiving)
  const guardPose = (wrists[0].y < shoulderL.y - 0.03) || (wrists[1].y < shoulderR.y - 0.03);
  // Charge: hands close together, between chest and belly
  const chargePose = !guardPose && ptDist3(wrists[0], wrists[1]) < 0.25 && wristCenterY > shoulderCenterY + 0.04 && wristCenterY < hipCenterY + 0.2;
  // Crouch: hips much lower than shoulders (squatting)
  const crouchPose = hipCenterY - shoulderCenterY > 0.26;

  // Debounced pose state detection — require consistent pose for POSE_DEBOUNCE_FRAMES
  poseStateFrames.GUARD = guardPose ? poseStateFrames.GUARD + 1 : 0;
  poseStateFrames.CHARGE = chargePose ? poseStateFrames.CHARGE + 1 : 0;
  poseStateFrames.CROUCH = crouchPose ? poseStateFrames.CROUCH + 1 : 0;

  const guardConfirmed = poseStateFrames.GUARD >= POSE_DEBOUNCE_FRAMES;
  const chargeConfirmed = poseStateFrames.CHARGE >= POSE_DEBOUNCE_FRAMES;
  const crouchConfirmed = poseStateFrames.CROUCH >= POSE_DEBOUNCE_FRAMES;

  // A partial pose can be useful for calibration, but must never turn into a
  // combat action. This avoids a cropped wrist/ankle creating phantom hits on
  // narrow or low-resolution camera feeds.
  if (!allVisible) {
    player.isGuarding = false; player.isCharging = false; player.isCrouching = false;
    setCombatPhase('TRACKING', 'SHOW HANDS + FEET TO FIGHT', 'text-amber-400');
    return;
  }

  // Priority: Guard > Attack > Charge > Crouch > Idle
  // Update camera preview border color based on detected pose
  const camPanel = document.getElementById('cameraFeedPanel');
  if (guardConfirmed && now - player.lastGestureTime > 120) {
    player.isGuarding = true; player.stance = 'GUARD'; player.isCharging = false; player.isCrouching = false;
    setCombatPhase('GUARD', 'GUARD — HOLD YOUR GROUND', 'text-indigo-400');
    if (camPanel) camPanel.style.borderColor = 'rgba(99,102,241,0.6)'; // indigo
    return;
  }
  // Time-based hit cooldown (ms instead of frame count)
  if (p1PhysicalHitCooldown > 0) { p1PhysicalHitCooldown = Math.max(0, p1PhysicalHitCooldown - poseDelta); if (p1PhysicalHitCooldown > 0) return; }
  // Show cooldown indicator
  const cdEl = document.getElementById('cooldownIndicator');
  if (cdEl) {
    const attackReady = now >= player.attackLockUntil;
    cdEl.textContent = attackReady ? '✓ ATTACK READY' : '⏳ RECOVERING...';
    cdEl.style.color = attackReady ? '#10b981' : '#f59e0b';
    cdEl.classList.toggle('hidden', false);
  }
  if (chargeConfirmed && now - player.lastGestureTime > 120) {
    player.isCharging = true; player.isGuarding = false; player.isCrouching = false; player.stance = 'CHARGING';
    player.ki = Math.min(100, player.ki + poseDelta * 0.035 * fighterMods(1).ki);
    if (now - lastChargeToneAt > 240) { sound.playCharge(); lastChargeToneAt = now; }
    updateHud();
    setCombatPhase('CHARGE', player.ki >= 100 ? 'KI FULL — EXTEND BOTH HANDS' : 'CHARGING KI...', 'text-amber-400');
    if (camPanel) camPanel.style.borderColor = 'rgba(251,191,36,0.6)'; // amber
    return;
  }
  if (crouchConfirmed && now - player.lastGestureTime > 120) {
    player.isCrouching = true; player.isGuarding = false; player.isCharging = false; player.stance = 'CROUCH';
    setCombatPhase('CROUCH', 'DUCKING — AVOID HIGH ATTACKS', 'text-purple-400');
    if (camPanel) camPanel.style.borderColor = 'rgba(168,85,247,0.6)'; // purple
    return;
  }

  // Velocity thresholds — scaled by distance from camera
  // Lower base threshold = easier to trigger attacks
  const velThreshold = (sensitivityThreshold * 20) / distScale;
  if (footVelocity > velThreshold * 0.8 && footExtended && footExtending && now - player.lastGestureTime > 360) {
    player.lastGestureTime = now; player.stance = 'KICK'; player.isGuarding = false; player.isCrouching = false; player.isCharging = false;
    setCombatPhase('STRIKE', 'KICK!', 'text-emerald-400');
    resolvePoseStrike('FOOT', footVelocity);
  } else if (handVelocity > velThreshold && handExtended && handExtending && now - player.lastGestureTime > 300) {
    player.lastGestureTime = now; player.stance = 'PUNCH'; player.isGuarding = false; player.isCrouching = false; player.isCharging = false;
    setCombatPhase('STRIKE', 'PUNCH!', 'text-cyan-400');
    resolvePoseStrike('HAND', handVelocity);
  } else if (performance.now() > combatPhaseUntil) {
    player.stance = 'READY'; player.isGuarding = false; player.isCrouching = false; player.isCharging = false;
    // Reset camera border color
    const camPanel = document.getElementById('cameraFeedPanel');
    if (camPanel) camPanel.style.borderColor = 'rgba(56,189,248,0.3)';
    // Show range status when ready
    const range = getRangeStatus();
    if (!allVisible) {
      const missing = [];
      if (!handsVisible) missing.push('HANDS');
      if (!feetVisible) missing.push('FEET');
      setCombatPhase('READY', 'SHOW YOUR ' + missing.join(' + '), 'text-amber-400');
    } else if (range) {
      setCombatPhase('READY', range.status + ' — MOVE TO STRIKE', range.color);
    } else {
      setCombatPhase('READY', 'READY — MOVE TO STRIKE', 'text-emerald-400');
    }
  }
}
