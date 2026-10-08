// ===================== FX =====================
// Dynamic arena lighting — flashes color on hits
let arenaLightFlash = null;
function flashArenaLight(colorHex) {
  if (!scene) return;
  // Find existing flash light or create one
  if (!arenaLightFlash) {
    arenaLightFlash = new THREE.PointLight(0xffffff, 0, 15);
    arenaLightFlash.position.set(0, 5, 0);
    scene.add(arenaLightFlash);
  }
  arenaLightFlash.color.setHex(colorHex);
  arenaLightFlash.intensity = 3;
  // Decay over time
  const decay = () => {
    if (arenaLightFlash.intensity > 0.1) {
      arenaLightFlash.intensity *= 0.88;
      requestAnimationFrame(decay);
    } else {
      arenaLightFlash.intensity = 0;
    }
  };
  decay();
}

let _sparkGeo = null;
function _getSparkGeo() {
  if (!_sparkGeo) _sparkGeo = new THREE.SphereGeometry(0.06, 6, 6);
  return _sparkGeo;
}

function create3DHitSparks(x, y, z, colorHex, count = 15) {
  cameraShake = Math.max(cameraShake, 8);
  flashArenaLight(colorHex);
  const safeCount = Math.min(count, 30);
  const geo = _getSparkGeo();
  for (let i = 0; i < safeCount; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(x, y, z);
    p.userData = { vx: (Math.random()-0.5)*0.32, vy: Math.random()*0.28, vz: (Math.random()-0.5)*0.32, life: 1.0 };
    scene.add(p); particles3D.push(p);
  }
}

function trigger3DBeam(startX, endX, colorHex) {
  if (beamMesh) { scene.remove(beamMesh); disposeObject3D(beamMesh); beamMesh = null; }
  const len = Math.abs(endX - startX);
  const beamGeo = new THREE.CylinderGeometry(0.38, 0.38, len, 16);
  const beamMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 });
  beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.rotation.z = Math.PI / 2;
  beamMesh.position.set((startX + endX) / 2, 1.65, 0);
  scene.add(beamMesh);
  create3DHitSparks((startX + endX) / 2, 1.65, 0, colorHex, 10);
  setTimeout(() => { if (beamMesh) { scene.remove(beamMesh); disposeObject3D(beamMesh); beamMesh = null; } }, 380);
}

function triggerProjectileSuper(startX, endX, colorHex, style) {
  const group = new THREE.Group();
  const coreGeo = style === 'VOID' ? new THREE.SphereGeometry(0.3, 20, 20) : new THREE.SphereGeometry(0.24, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.92 });
  group.add(new THREE.Mesh(coreGeo, coreMat));
  const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32 + i * 0.05, 0.02, 8, 20), ringMat);
    ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    group.add(ring);
  }
  group.position.set(startX, 1.65, 0); scene.add(group);
  const startTime = performance.now(), duration = 300;
  function tick() {
    const t = Math.min(1, (performance.now() - startTime) / duration);
    group.position.x = lerp(startX, endX, t);
    group.rotation.y += 0.35; group.rotation.x += 0.2;
    if (t < 1) requestAnimationFrame(tick);
    else { scene.remove(group); disposeObject3D(group); create3DHitSparks(endX, 1.65, 0, colorHex, style === 'VOID' ? 26 : 16); }
  }
  tick();
}

function triggerCharacterSuperFX(attackerChar, startX, endX) {
  if (attackerChar.id === 'SHINOBI') triggerProjectileSuper(startX, endX, attackerChar.colorHex, 'RASENGAN');
  else if (attackerChar.id === 'VOIDLORD') triggerProjectileSuper(startX, endX, attackerChar.colorHex, 'VOID');
  else trigger3DBeam(startX, endX, attackerChar.colorHex);
}

function flashScreen(intensity) {
  if (reducedMotion) intensity *= 0.3;   // photosensitivity: soften full-screen white flashes
  const el = document.getElementById('hitFlash');
  el.style.background = intensity > 0.15 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)';
  el.style.opacity = intensity;
  requestAnimationFrame(() => { el.style.transition = 'opacity 200ms ease-out'; el.style.opacity = 0; });
  setTimeout(() => { el.style.transition = ''; }, 250);
}

// Anime-style impact frame — white flash with freeze on big hits
function triggerImpactFrame() {
  if (reducedMotion) return;
  const el = document.getElementById('impactFrame');
  el.style.opacity = '0.9';
  setTimeout(() => { el.style.opacity = '0'; }, 80);
}

// Slow motion effect — slows down the game for dramatic moments
let slowMotionActive = false;
let slowMotionTimer = null;
function triggerSlowMotion(durationMs = 800) {
  slowMotionActive = true;
  const overlay = document.getElementById('slowMotionOverlay');
  overlay.style.opacity = '1';
  clearTimeout(slowMotionTimer);
  slowMotionTimer = setTimeout(() => {
    slowMotionActive = false;
    overlay.style.opacity = '0';
  }, durationMs);
}

// Dramatic KO sequence
async function playKOSequence(playerWon) {
  // Slow motion + impact frame
  triggerSlowMotion(1200);
  triggerImpactFrame();
  cameraShake = 15;
  speedLinesActive = true;
  speedLinesTimer = 40;

  // Show KO text
  const koOverlay = document.getElementById('koOverlay');
  const koText = koOverlay.querySelector('.ko-text');
  koText.textContent = 'K.O.';
  koText.style.color = playerWon ? '#38bdf8' : '#f43f5e';
  koText.style.textShadow = playerWon
    ? '0 0 40px rgba(56,189,248,0.8),0 0 80px rgba(56,189,248,0.4),0 4px 0 #000'
    : '0 0 40px rgba(244,63,94,0.8),0 0 80px rgba(244,63,94,0.4),0 4px 0 #000';
  koOverlay.classList.add('active');

  // Wait for dramatic pause
  await new Promise(r => setTimeout(r, 1800));
  koOverlay.classList.remove('active');
}

// Victory/defeat screen with stats
function showMatchResult(playerWon) {
  const overlay = document.getElementById('gameOverlay');
  const title = document.getElementById('overlayTitle');
  const desc = document.getElementById('overlayDesc');
  const buttons = document.getElementById('overlayButtons');

  const winColor = playerWon ? 'text-cyan-400' : 'text-rose-500';
  const winIcon = playerWon ? 'fa-trophy' : 'fa-skull';
  const winText = playerWon ? 'VICTORY' : 'DEFEATED';

  title.innerHTML = `<i class="fa-solid ${winIcon} mr-2"></i><span class="${winColor}">${winText}</span>`;

  // Match stats
  const stats = [
    `Rounds: ${p1RoundWins}-${p2RoundWins}`,
    `Best Combo: ${bestCombo} hits`,
    `Threat Level: ${tierName(gameLevel)}`,
    `Fighter: ${selectedP1Char.name}`,
  ].join(' · ');

  desc.innerHTML = `
    <div style="margin-bottom:12px;">${playerWon ? selectedP1Char.name + ' dominates the arena!' : selectedP2Char.name + ' wins the duel.'}</div>
    <div style="font-size:11px;color:#94a3b8;font-family:Orbitron;letter-spacing:0.05em;">${stats}</div>
    ${lastCareer ? `<div style="margin-top:8px;font-size:10px;color:#64748b;font-family:Orbitron;letter-spacing:0.05em;">CAREER ${lastCareer.wins}W–${lastCareer.losses}L · BEST COMBO ${lastCareer.bestCombo} · TOP TIER ${tierName(lastCareer.topTier)}</div>` : ''}
  `;

  buttons.innerHTML = `
    <button onclick="startMatch()" class="cta-button cta-primary text-sm"><i class="fa-solid fa-rotate-right mr-2"></i>REMATCH</button>
    <button onclick="openModeSelectModal()" class="cta-button cta-secondary text-sm"><i class="fa-solid fa-users mr-2"></i>CHANGE MODE</button>
  `;

  overlay.classList.remove('hidden');
}

function addFloatingText(text, xRatio, yRatio, color) {
  floatingTexts.push({ text, x: window.innerWidth * xRatio, y: window.innerHeight * yRatio, vy: -1.5, life: 1.0, color });
}
