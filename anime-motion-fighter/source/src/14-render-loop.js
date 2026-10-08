// ===================== RENDER LOOP =====================
function renderAnimeOverlayFX() {
  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  if (splitScreenOn) {
    const midX = fxCanvas.width / 2;
    fxCtx.strokeStyle = 'rgba(148,163,184,0.4)'; fxCtx.lineWidth = 2;
    fxCtx.beginPath(); fxCtx.moveTo(midX, 0); fxCtx.lineTo(midX, fxCanvas.height); fxCtx.stroke();
  }
  if (speedLinesActive && reducedMotion) { speedLinesTimer--; if (speedLinesTimer <= 0) speedLinesActive = false; }
  else if (speedLinesActive) {
    fxCtx.strokeStyle = 'rgba(56,189,248,0.2)'; fxCtx.lineWidth = 2;
    const cx = fxCanvas.width / 2, cy = fxCanvas.height / 2;
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2, dist = 100 + Math.random() * 300;
      fxCtx.beginPath();
      fxCtx.moveTo(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
      fxCtx.lineTo(cx + Math.cos(angle) * (dist + 200), cy + Math.sin(angle) * (dist + 200));
      fxCtx.stroke();
    }
    speedLinesTimer--; if (speedLinesTimer <= 0) speedLinesActive = false;
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    fxCtx.font = '700 16px Orbitron'; fxCtx.fillStyle = ft.color; fxCtx.globalAlpha = ft.life;
    fxCtx.fillText(ft.text, ft.x, ft.y);
    ft.y += ft.vy; ft.life -= 0.025;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
  fxCtx.globalAlpha = 1.0;
}

function runFrame(now) {
  let delta = now - lastTime; lastTime = now;
  if (gameState === 'PAUSED') { renderSceneView(); return; }
  // Slow motion effect
  if (slowMotionActive) delta *= 0.3;
  if (hitStopFrames > 0) { hitStopFrames--; delta *= 0.15; }
  const dt = Math.min(delta, 50) / 1000;

  // Resize the FX canvas only when the on-screen size actually changes.
  // Reassigning `width` / `height` clears the canvas and resets the 2D
  // context state, so doing it 60×/s for no reason is wasted work.
  if (fxCanvas._lastW !== fxCanvas.clientWidth || fxCanvas._lastH !== fxCanvas.clientHeight) {
    fxCanvas.width = fxCanvas.clientWidth;
    fxCanvas.height = fxCanvas.clientHeight;
    fxCanvas._lastW = fxCanvas.width;
    fxCanvas._lastH = fxCanvas.height;
  }

  if (cameraShake > 0) {
    const shakeScale = reducedMotion ? 0.2 : 1;
    camera.position.x += (Math.random() - 0.5) * 0.22 * (cameraShake / 8) * shakeScale;
    camera.position.y += (Math.random() - 0.5) * 0.2 * (cameraShake / 8) * shakeScale;
    cameraShake = Math.max(0, cameraShake - 1);
  }
  updateMainCameraView();

  if (playerFighter3D) updateFighterRig(playerFighter3D, player, player.stance, false, dt);
  if (aiFighter3D) updateFighterRig(aiFighter3D, ai, ai.stance, true, dt);
  if (playerFighter3D && aiFighter3D) updateSplitCameras();
  if (dualCamMode && gameState === 'PLAYING') checkDualCamCollisions(dt);

  for (let i = particles3D.length - 1; i >= 0; i--) {
    const p = particles3D[i];
    p.position.x += p.userData.vx; p.position.y += p.userData.vy; p.position.z += p.userData.vz;
    p.userData.vy -= 0.01;
    p.userData.life -= 0.045; p.scale.setScalar(Math.max(0, p.userData.life));
    if (p.userData.life <= 0) { scene.remove(p); p.material?.dispose(); particles3D.splice(i, 1); }
  }

  renderSceneView();
  renderAnimeOverlayFX();
  // Cap so a backgrounded tab / long stall can't make the AI fire instantly on return.
  updateAdaptiveAI(Math.min(delta, 100));
}

let lastTime = performance.now();
function animate3D(now) {
  if (vrActive) return;
  requestAnimationFrame(animate3D);
  runFrame(now);
}

function renderSceneView() {
  if (!renderer || !scene) return;
  const container = document.getElementById('webglContainer');
  const w = container.clientWidth, h = container.clientHeight;
  if (splitScreenOn && cameraP1 && cameraP2) {
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, w / 2, h); renderer.setScissor(0, 0, w / 2, h);
    renderer.render(scene, cameraP1);
    renderer.setViewport(w / 2, 0, w / 2, h); renderer.setScissor(w / 2, 0, w / 2, h);
    renderer.render(scene, cameraP2);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  } else if (camera) {
    renderer.render(scene, camera);
  }
}
