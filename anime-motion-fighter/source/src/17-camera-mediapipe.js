// ===================== CAMERA / MEDIAPIPE =====================
let cameraInstance = null, poseInstance = null;
let dualCamLandmarker = null;

function applyCameraPreviewState() {
  const panel = document.getElementById('cameraFeedPanel');
  const label = document.getElementById('camVisLabel');
  const visible = cameraFeedVisible && !!cameraStream;
  panel?.classList.toggle('visible', visible);
  if (label) label.textContent = cameraFeedVisible ? 'HIDE CAM' : 'SHOW CAM';
}

function showCameraError(message) {
  const overlay = document.getElementById('gameOverlay');
  if (!overlay) return;
  document.getElementById('overlayTitle').innerHTML = '<span class="text-amber-400">CAMERA ISSUE</span>';
  document.getElementById('overlayDesc').textContent = message;
  document.getElementById('overlayButtons').innerHTML = `
    <button onclick="initCamera()" class="cta-button cta-primary text-sm"><i class="fa-solid fa-video mr-2"></i>TRY AGAIN</button>
    <button onclick="document.getElementById('gameOverlay').classList.add('hidden')" class="cta-button cta-secondary text-sm"><i class="fa-solid fa-gamepad mr-2"></i>USE KEYBOARD/TOUCH</button>
  `;
  overlay.classList.remove('hidden');
}

// Range indicator — shows if player is in effective attack range
function getRangeStatus() {
  if (!livePoseLandmarks || !finiteLandmarks(livePoseLandmarks)) return null;
  const shoulderL = livePoseLandmarks[11], shoulderR = livePoseLandmarks[12];
  const shoulderWidth = Math.abs(shoulderL.x - shoulderR.x);
  // Shoulder width < 0.08 means too far away, > 0.35 means too close
  if (shoulderWidth < 0.08) return { status: 'TOO FAR', color: 'text-rose-400', icon: 'fa-arrow-left' };
  if (shoulderWidth < 0.12) return { status: 'AT RANGE', color: 'text-amber-400', icon: 'fa-circle' };
  if (shoulderWidth > 0.35) return { status: 'TOO CLOSE', color: 'text-rose-400', icon: 'fa-arrow-right' };
  return { status: 'GOOD RANGE', color: 'text-emerald-400', icon: 'fa-check-circle' };
}

function stopCameraStream() {
  poseLoopRunning = false;
  onboardingShown = false;
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  const video = document.getElementById('webcamInput');
  if (video) video.srcObject = null;
  applyCameraPreviewState();
  poseInstance?.close?.(); poseInstance = null;
  dualContactState = { p1: Object.create(null), p2: Object.create(null) };
  p2LiveLandmarks = null; livePoseLandmarks = null;
  trackingLossFrames = 0; cameraInstance = null;
}

function changeCameraFacing(mode) { cameraFacingMode = mode === 'environment' ? 'environment' : 'user'; if (cameraStream) initCamera(); }
function changeCameraView(view) { cameraView = ['FRONT','SIDE','REAR'].includes(view) ? view : 'FRONT'; updateMainCameraView(true); }
function changeTrackingProfile(profile) { trackingProfile = profile === 'SIDE' ? 'SIDE' : 'FRONT'; }
function changeSensitivity(val) { sensitivityThreshold = val === 'LOW' ? 0.075 : val === 'HIGH' ? 0.035 : 0.055; }
function changeCameraQuality(value) {
  cameraQuality = ['AUTO', 'HIGH', 'LOW'].includes(value) ? value : 'AUTO';
  document.querySelectorAll('[id="cameraQualitySelect"]').forEach(select => { select.value = cameraQuality; });
  if (cameraStream) initCamera();
}
function toggleCameraVisibility() { cameraFeedVisible = !cameraFeedVisible; applyCameraPreviewState(); }
function toggleSplitScreen() { splitScreenOn = !splitScreenOn; }

function getCameraConstraints() {
  // Portrait-friendly mobile capture and 4:3 desktop capture keep a standing body
  // in view while avoiding unnecessary 1080p processing on laptops.
  const presets = {
    HIGH: { width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 30, max: 30 } },
    LOW: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
    AUTO: { width: { ideal: isMobile ? 720 : 960 }, height: { ideal: isMobile ? 960 : 720 }, frameRate: { ideal: 30, max: 30 } },
  };
  return { ...presets[cameraQuality], facingMode: { ideal: cameraFacingMode } };
}

function syncPreviewCanvas(video) {
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;
  // Cap backing-store work while preserving the actual camera aspect ratio.
  const scale = Math.min(1, 720 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(2, Math.round(sourceWidth * scale));
  const height = Math.max(2, Math.round(sourceHeight * scale));
  if (pipCanvas.width !== width || pipCanvas.height !== height) {
    pipCanvas.width = width;
    pipCanvas.height = height;
  }
}

function updateMainCameraView(force = false) {
  if (!camera) return;
  const targets = { FRONT: { x: 0, z: 10 }, SIDE: { x: 10, z: 0 }, REAR: { x: 0, z: -10 } };
  const target = targets[cameraView] || targets.FRONT;
  const smoothing = force ? 1 : 0.12;
  camera.position.x = lerp(camera.position.x, target.x, smoothing);
  camera.position.z = lerp(camera.position.z, target.z, smoothing);
  camera.position.y = lerp(camera.position.y, 2.6, smoothing);
  camera.lookAt(0, 1.25, 0);
}

async function initCamera() {
  const camBtn = document.getElementById('startCamBtn');
  if (camBtn && camBtn.dataset.loading === 'true') return;
  if (camBtn) { camBtn.dataset.loading = 'true'; camBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i><span class="label-full">LOADING...</span>'; }
  if (selectedGameMode === 'CAM2P') { try { await initDualCamera(); } finally { if (camBtn) { camBtn.dataset.loading = 'false'; camBtn.innerHTML = '<i class="fa-solid fa-video mr-1"></i><span class="label-full">WEBCAM</span>'; } } return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    if (camBtn) { camBtn.dataset.loading = 'false'; camBtn.innerHTML = '<i class="fa-solid fa-video mr-1"></i><span class="label-full">WEBCAM</span>'; }
    updateGestureStatus('WEBCAM UNAVAILABLE — USE TOUCH/KEYBOARD', 'text-rose-400');
    showCameraError('This browser does not support webcam access. Use Chrome, Edge, or Firefox on desktop, or switch to keyboard/touch controls.');
    return;
  }
  dualCamMode = false; sound.init();
  if (gameState === 'START' || gameState === 'OVER') startMatch();
  stopCameraStream();

  const videoElement = document.getElementById('webcamInput');
  try {
    // Check if MediaPipe loaded
    if (typeof Pose === 'undefined') {
      throw new Error('MediaPipe Pose library not loaded. Check your internet connection and disable ad blockers for this site.');
    }
    poseInstance = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
    poseInstance.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
    poseInstance.onResults((results) => {
      syncPreviewCanvas(videoElement);
      pipCtx.save(); pipCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
      pipCtx.drawImage(results.image, 0, 0, pipCanvas.width, pipCanvas.height);
      if (results.poseLandmarks) {
        drawSkeletonOverlay(pipCtx, results.poseLandmarks, pipCanvas.width, pipCanvas.height);
        processPose(results.poseLandmarks);
      } else {
        processPose(null);
      }
      pipCtx.restore();
    });
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: getCameraConstraints(), audio: false });
    videoElement.srcObject = cameraStream;
    await videoElement.play();
    poseLoopRunning = true;
    const sendFrame = async () => {
      if (!poseLoopRunning) return;
      try { if (poseInstance && videoElement.readyState >= 2) await poseInstance.send({ image: videoElement }); }
      catch (error) { console.warn('Pose frame skipped', error); }
      if (poseLoopRunning) setTimeout(sendFrame, 33); // throttle to ~30fps; re-check in case stopCameraStream ran during await
    };
    cameraInstance = { stop: stopCameraStream };
    sendFrame();
    playerReadyForCombat = true;
    applyCameraPreviewState();
    updateGestureStatus('CAMERA ACTIVE — SHOW HANDS + FEET', 'text-emerald-400');
    if (camBtn) { camBtn.dataset.loading = 'false'; camBtn.innerHTML = '<i class="fa-solid fa-video mr-1"></i><span class="label-full">WEBCAM</span>'; }
    // Show onboarding guide for first-time users
    showCameraOnboarding();
  } catch (error) {
    console.error('Camera failed', error);
    stopCameraStream();
    if (camBtn) { camBtn.dataset.loading = 'false'; camBtn.innerHTML = '<i class="fa-solid fa-video mr-1"></i><span class="label-full">WEBCAM</span>'; }
    updateGestureStatus('CAMERA FAILED — USE TOUCH/KEYBOARD', 'text-rose-400');
    showCameraError(error.name === 'NotAllowedError'
      ? 'Camera permission was blocked. Allow webcam access in your browser, then try again — keyboard and touch controls are always available.'
      : 'We could not start this camera at the selected quality. Try Performance quality or use keyboard/touch controls.');
  }
}

// Dual camera (same-camera 2P)
async function initDualCamera() {
  dualCamMode = true; dualCamRunning = false; sound.init();
  if (gameState === 'START' || gameState === 'OVER') startMatch();
  updateGestureStatus('LOADING DUAL TRACKER...', 'text-amber-400');
  const videoElement = document.getElementById('webcamInput');
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');
    const stream = await navigator.mediaDevices.getUserMedia({ video: getCameraConstraints(), audio: false });
    cameraStream = stream; cameraInstance = { stop: stopCameraStream };
    videoElement.srcObject = stream; await videoElement.play();
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    const { PoseLandmarker, FilesetResolver } = vision;
    const filesetResolver = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    dualCamLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' },
      runningMode: 'VIDEO', numPoses: 2
    });
    dualCamRunning = true; applyCameraPreviewState();
    updateGestureStatus('TWO FIGHTERS — BOTH IN FRAME', 'text-emerald-400');
    dualCamLoop(videoElement);
  } catch (err) {
    console.error('Dual camera failed', err);
    stopCameraStream(); dualCamLandmarker?.close?.(); dualCamLandmarker = null;
    updateGestureStatus('DUAL TRACKER FAILED — USE MANUAL', 'text-rose-400');
    dualCamMode = false;
  }
}

function dualCamLoop(videoElement) {
  if (!dualCamRunning) return;
  if (videoElement.readyState >= 2 && dualCamLandmarker) {
    let result;
    try { result = dualCamLandmarker.detectForVideo(videoElement, performance.now()); }
    catch (error) { requestAnimationFrame(() => dualCamLoop(videoElement)); return; }
    pipCtx.save(); pipCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
    pipCtx.drawImage(videoElement, 0, 0, pipCanvas.width, pipCanvas.height);
    const poses = result.landmarks || [];
    if (poses.length >= 1) {
      const withCenter = poses.map(lm => ({ lm, cx: (lm[23].x + lm[24].x) / 2 })).sort((a, b) => a.cx - b.cx);
      livePoseLandmarks = withCenter[0]?.lm ? smoother.filter(withCenter[0].lm) : null;
      p2LiveLandmarks = withCenter[1]?.lm ? p2Smoother.filter(withCenter[1].lm) : null;
      liveVisible = !!livePoseLandmarks;
    } else { livePoseLandmarks = null; p2LiveLandmarks = null; }
    pipCtx.restore();
  }
  requestAnimationFrame(() => dualCamLoop(videoElement));
}

function checkDualCamCollisions(dt) {
  if (!finiteLandmarks(livePoseLandmarks) || !finiteLandmarks(p2LiveLandmarks)) {
    dualContactState = { p1: Object.create(null), p2: Object.create(null) }; return;
  }
  const lmA = livePoseLandmarks, lmB = p2LiveLandmarks;
  const LIMB_POINTS = { LW: 15, RW: 16, LA: 27, RA: 28 };
  const BLOCK_RADIUS = 0.075;
  function torsoBox(lm) {
    const shL = lm[11], shR = lm[12], hipL = lm[23], hipR = lm[24];
    const xs = [shL.x, shR.x, hipL.x, hipR.x], ys = [shL.y, shR.y, hipL.y, hipR.y];
    const pad = 0.05;
    return { minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad, minY: Math.min(...ys) - pad * 0.6, maxY: Math.max(...ys) + pad };
  }
  function inBox(pt, box) { return pt.x >= box.minX && pt.x <= box.maxX && pt.y >= box.minY && pt.y <= box.maxY; }
  const boxA = torsoBox(lmA), boxB = torsoBox(lmB);
  for (const k in p1LimbCooldown) if (p1LimbCooldown[k] > 0) p1LimbCooldown[k] -= dt;
  for (const k in p2LimbCooldown) if (p2LimbCooldown[k] > 0) p2LimbCooldown[k] -= dt;

  const blockedA = {}, blockedB = {};
  for (const ka in LIMB_POINTS) {
    const ptA = lmA[LIMB_POINTS[ka]];
    for (const kb in LIMB_POINTS) {
      const ptB = lmB[LIMB_POINTS[kb]];
      if (ptDist(ptA, ptB) < BLOCK_RADIUS) {
        blockedA[ka] = true; blockedB[kb] = true;
        if (p1LimbCooldown[ka] <= 0 && p2LimbCooldown[kb] <= 0) {
          p1LimbCooldown[ka] = 0.4; p2LimbCooldown[kb] = 0.4;
          sound.playBlock(); create3DHitSparks((player.x + ai.x) / 2, 1.5, 0, 0x93c5fd, 10);
          addFloatingText('BLOCK', 0.5, 0.4, '#38bdf8');
          triggerHitStop(2);
        }
      }
    }
  }
  for (const ka in LIMB_POINTS) {
    const ptA = lmA[LIMB_POINTS[ka]];
    const inside = inBox(ptA, boxB);
    const wasInside = dualContactState.p1[ka] === true;
    dualContactState.p1[ka] = inside;
    if (blockedA[ka] || p1LimbCooldown[ka] > 0 || !inside || wasInside) continue;
    p1LimbCooldown[ka] = 0.5;
    landDualCamHit(true, ka[1] === 'W' ? 'HAND' : 'FOOT');
  }
  for (const kb in LIMB_POINTS) {
    const ptB = lmB[LIMB_POINTS[kb]];
    const inside = inBox(ptB, boxA);
    const wasInside = dualContactState.p2[kb] === true;
    dualContactState.p2[kb] = inside;
    if (blockedB[kb] || p2LimbCooldown[kb] > 0 || !inside || wasInside) continue;
    p2LimbCooldown[kb] = 0.5;
    landDualCamHit(false, kb[1] === 'W' ? 'HAND' : 'FOOT');
  }
}

function landDualCamHit(fromP1, weapon) {
  const attackType = weapon === 'FOOT' ? 'KICK' : 'PUNCH';
  if (!beginCombatAttack(fromP1 ? 1 : 2, attackType)) return;
  const target = fromP1 ? ai : player;
  const attackerChar = fromP1 ? selectedP1Char : selectedP2Char;
  const rule = COMBAT_RULES[attackType];
  const points = weapon === 'FOOT' ? 2 : 1;
  const attackerMods = fighterMods(fromP1 ? 1 : 2);
  if (fromP1) playerScore += points; else aiScore += points;
  sound.playHit(); target.hp = Math.max(0, target.hp - rule.damage * attackerMods.dmg);
  gainKi(fromP1 ? player : ai, (weapon === 'FOOT' ? 6 : 4) * attackerMods.ki); gainKi(target, weapon === 'FOOT' ? 3 : 2);
  if (!fromP1) resetCombo();
  setPortraitState(fromP1 ? 'p2' : 'p1', 'hit');
  target.hitFlash = 1; applyKnockback(target, fromP1, rule.knockback);
  create3DHitSparks(target.x, 1.6, 0, attackerChar.colorHex, weapon === 'FOOT' ? 16 : 10);
  addFloatingText('+' + points + ' ' + weapon, fromP1 ? 0.7 : 0.3, 0.4, '#fbbf24');
  if (fromP1) incrementCombo();
  triggerHitStop(rule.hitStop); flashScreen(0.1);
  updateHud(); checkWinLoss();
}

function resolvePoseStrike(type, velocity) {
  if (selectedGameMode === '1P' && !dualCamMode) {
    // Velocity-based damage bonus: faster strikes deal up to 20% more
    const velThreshold = (sensitivityThreshold * 20) / (globalDistScale || 1);
    const velRatio = Math.min(2.0, velocity / (velThreshold * 1.2));
    const damageBonus = 1.0 + Math.max(0, velRatio - 1.0) * 0.2;
    if (type === 'FOOT') executePlayerKick(1, damageBonus); else executePlayerPunch(1, damageBonus);
    return;
  }
  // Spatial collision for multi-player
  if (!playerFighter3D || !aiFighter3D) return;
  const attackType = type === 'FOOT' ? 'KICK' : 'PUNCH';
  if (performance.now() < player.attackLockUntil) { setCombatPhase('RECOVERY', 'RECOVERY', 'text-slate-400'); return; }
  const hand = new THREE.Vector3(); playerFighter3D.armR.hand.getWorldPosition(hand);
  const foot = new THREE.Vector3(); playerFighter3D.legR.foot.getWorldPosition(foot);
  const body = new THREE.Vector3(); aiFighter3D.group.getWorldPosition(body); body.y += 1.5;
  const attackPos = type === 'HAND' ? hand : foot;
  const zone = type === 'HAND' ? { forward: 5.9, vertical: 1.22, depth: 1.05 } : { forward: 6.05, vertical: 1.48, depth: 1.15 };
  const contact = attackPos.x <= body.x + 0.45 && Math.abs(attackPos.x - body.x) <= zone.forward && Math.abs(attackPos.y - body.y) <= zone.vertical && Math.abs(attackPos.z - body.z) <= zone.depth;
  p1PhysicalHitCooldown = contact ? 350 : 200;
  if (contact) {
    setCombatPhase('CONTACT', type === 'FOOT' ? 'FOOT HIT' : 'HAND HIT', 'text-emerald-400');
    if (type === 'HAND') executePlayerPunch(1); else executePlayerKick(1);
  } else {
    player.attackLockUntil = performance.now() + COMBAT_RULES[attackType].cooldown * 0.7;
    setCombatPhase('MISS', 'OUT OF RANGE — RESET', 'text-slate-400');
    addFloatingText('MISS', 0.7, 0.4, '#94a3b8');
  }
}
