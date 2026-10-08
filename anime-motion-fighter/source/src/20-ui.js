// ===================== UI =====================
function updateGestureStatus(text, colorClass) {
  const el = document.getElementById('gestureStatus');
  if (el) { el.textContent = text; el.className = 'font-orbitron text-[10px] sm:text-xs font-bold bg-slate-900/90 border border-amber-500/30 px-4 py-1.5 rounded-full uppercase tracking-wider backdrop-blur inline-block ' + (colorClass || 'text-amber-300'); }
}

const PHASE_REASONS = {
  READY: 'Move one clear hand or foot forward.',
  'WIND-UP': 'Motion detected — keep extending.',
  STRIKE: 'Attack resolving...',
  CONTACT: 'Your limb reached the target.',
  MISS: 'Did not reach target. Reset and try again.',
  BLOCK: 'Limb met a defending limb.',
  GUARD: 'Both hands raised — guard active.',
  CHARGE: 'Hands together — building Ki.',
  CROUCH: 'Hips lowered — dodging.',
  RECOVERY: 'Exchange settling. Return to neutral.',
  TRACKING: 'Cannot trust body landmarks.',
  DODGE: 'Opponent moved out of attack line.',
  COUNTER: 'Punish landed during the guard window.',
  AI_GUARD: 'Opponent read your move — wait it out.',
  AI_BLOCK: 'Opponent defended — try a feint.',
};

function setCombatPhase(phase, text, colorClass) {
  combatPhase = phase;
  combatPhaseUntil = performance.now() + 550;
  usabilityObserver.log('phase', { phase, text });

  const phaseEl = document.getElementById('phaseText');
  const subEl = document.getElementById('phaseSub');
  const reasonEl = document.getElementById('combatReason');

  if (phaseEl) {
    phaseEl.textContent = text;
    phaseEl.className = 'phase-text active ' + (colorClass || 'text-amber-400');
    clearTimeout(phaseEl._hideTimer);
    phaseEl._hideTimer = setTimeout(() => { phaseEl.classList.remove('active'); }, 500);
  }
  if (subEl) {
    subEl.textContent = PHASE_REASONS[phase] || '';
    subEl.classList.add('active');
    clearTimeout(subEl._hideTimer);
    subEl._hideTimer = setTimeout(() => { subEl.classList.remove('active'); }, 600);
  }
  if (reasonEl) {
    reasonEl.textContent = PHASE_REASONS[phase] || '';
    reasonEl.classList.toggle('hidden', !PHASE_REASONS[phase]);
  }
  updateGestureStatus(text, colorClass);
}

function updateHud() {
  document.getElementById('playerScoreText').textContent = playerScore;
  document.getElementById('aiScoreText').textContent = aiScore;
  document.getElementById('playerHpLabel').textContent = Math.ceil(player.hp) + ' / ' + player.maxHp;
  document.getElementById('aiHpLabel').textContent = Math.ceil(ai.hp) + ' / ' + ai.maxHp;
  document.getElementById('playerHpBar').style.width = (player.hp / player.maxHp * 100) + '%';
  document.getElementById('aiHpBar').style.width = (ai.hp / ai.maxHp * 100) + '%';
  document.getElementById('playerKiText').textContent = Math.floor(player.ki) + '%';
  document.getElementById('aiKiText').textContent = Math.floor(ai.ki) + '%';
  document.getElementById('playerKiBar').style.width = player.ki + '%';
  document.getElementById('aiKiBar').style.width = ai.ki + '%';
}

function checkWinLoss() {
  if (gameState !== 'PLAYING' || roundLocked) return;
  if (ai.hp <= 0) resolveRound(true);
  else if (player.hp <= 0) resolveRound(false);
}

function renderRoundPips() {
  const el = document.getElementById('roundPips');
  el.innerHTML = '';
  for (let i = 0; i < roundsToWin; i++) {
    const s = document.createElement('span');
    s.className = 'w-2.5 h-2.5 rounded-full border ' + (i < p1RoundWins ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_6px_rgba(56,189,248,0.8)]' : 'bg-slate-800 border-slate-600');
    el.appendChild(s);
  }
  const spacer = document.createElement('span'); spacer.className = 'w-3'; el.appendChild(spacer);
  for (let i = 0; i < roundsToWin; i++) {
    const s = document.createElement('span');
    s.className = 'w-2.5 h-2.5 rounded-full border ' + (i < p2RoundWins ? 'bg-rose-500 border-rose-300 shadow-[0_0_6px_rgba(244,63,94,0.8)]' : 'bg-slate-800 border-slate-600');
    el.appendChild(s);
  }
}

function showBanner(text, ms) {
  return new Promise(res => {
    const banner = document.getElementById('roundBanner');
    const txt = document.getElementById('roundBannerText');
    txt.textContent = text;
    // Dramatic entrance
    txt.style.transform = 'scale(2.5) rotate(-5deg)';
    txt.style.opacity = '0';
    banner.classList.add('active');
    requestAnimationFrame(() => {
      txt.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      txt.style.transform = 'scale(1) rotate(0deg)';
      txt.style.opacity = '1';
    });
    // Flash effect on banner
    flashScreen(0.15);
    cameraShake = Math.max(cameraShake, 5);
    setTimeout(() => {
      txt.style.transition = 'all 0.3s ease-in';
      txt.style.transform = 'scale(0.8)';
      txt.style.opacity = '0';
      setTimeout(() => {
        banner.classList.remove('active');
        txt.style.transition = '';
        res();
      }, 300);
    }, ms);
  });
}

async function resolveRound(playerWon) {
  roundLocked = true; sound.playKO();
  if (playerWon) p1RoundWins++; else p2RoundWins++;
  renderRoundPips();
  const matchOver = p1RoundWins >= roundsToWin || p2RoundWins >= roundsToWin;

  // Play dramatic KO sequence
  await playKOSequence(playerWon);

  if (matchOver) {
    await showBanner(playerWon ? 'MATCH WIN!' : 'MATCH LOST', 1000);
    endGame(p1RoundWins > p2RoundWins);
  } else {
    await showBanner(playerWon ? 'ROUND WIN!' : 'ROUND LOST', 1000);
    currentRound++;
    await startNextRound();
  }
}

function endGame(playerWon) {
  gameState = 'OVER';
  lastCareer = selectedGameMode === '1P' ? recordMatchResult(playerWon) : null;
  if (playerWon && selectedGameMode === '1P') {
    gameLevel = Math.min(THREAT_TIERS.length, gameLevel + 1);
  }
  if (playerWon) sound.playVictory(); else sound.playDefeat();
  showMatchResult(playerWon);
}

async function startNextRound() {
  player.hp = player.maxHp; player.ki = 0; player.stance = 'IDLE'; player.isStealthed = false;
  player.knockback = 0; player.hitFlash = 0; player.homeX = -3.2; player.x = -3.2;
  player.dodgeZ = 0; player.counterUntil = 0; player.lastAttackTime = 0; player.lastGestureTime = 0; player.attackLockUntil = 0;
  ai.maxHp = 100 + (gameLevel - 1) * 15; ai.hp = ai.maxHp; ai.ki = 0; ai.stance = 'IDLE';
  ai.knockback = 0; ai.hitFlash = 0; ai.homeX = 3.2; ai.x = 3.2;
  ai.lastAttackTime = 0; ai.lastGestureTime = 0; ai.attackLockUntil = 0;
  ai.actionTimer = 0;
  ai.reactionDelay = Math.max(260, 620 - (gameLevel - 1) * 70);
  ai.history = { PUNCH:0, KICK:0, GUARD:0, CROUCH:0, CHARGE:0 };
  ai.pendingAction = null; ai.telegraphTimer = 0; ai.isCharging = false; ai.counterUntil = 0;
  combo = 0; document.getElementById('comboDisplay').classList.remove('active');
  p1PhysicalHitCooldown = 0;
  dualContactState = { p1: Object.create(null), p2: Object.create(null) };
  prevWristL = null; prevWristR = null; prevAnkleL = null; prevAnkleR = null;
  lastPoseFrameAt = 0; lastValidPoseAt = 0; lastChargeToneAt = 0; smoother.prev = null;
  setPortraitState('p1', 'ready'); setPortraitState('p2', 'ready');
  rebuildFighters3D();
  if (playerFighter3D?.group) playerFighter3D.group.visible = true;
  updateHud();
  trainingBeat = currentRound === 1 && p1RoundWins === 0 && p2RoundWins === 0 && selectedGameMode === '1P' && !dualCamMode;
  trainingBeatTimer = 6500;
  gameState = 'PLAYING'; playerReadyForCombat = false;
  await showBanner(trainingBeat ? 'FIND YOUR RANGE' : 'ROUND ' + currentRound, 900);
  sound.playRoundStart();
  await showBanner('FIGHT!', 500);
  roundLocked = false;
  setCombatPhase('READY', 'STEP INTO FRAME OR USE TOUCH/KEYBOARD', 'text-amber-400');
}

let bestCombo = 0;

function startMatch() {
  savePrefs();
  currentRound = 1; p1RoundWins = 0; p2RoundWins = 0; playerScore = 0; aiScore = 0; bestCombo = 0; roundLocked = true;
  usabilityObserver.log('match_start', { mode: selectedGameMode, p1: selectedP1Char.id, p2: selectedP2Char.id });
  const p2Suffix = selectedGameMode === '1P' ? ' (AI)' : selectedGameMode === 'CAM2P' ? ' (P2-CAM)' : ' (P2)';
  document.getElementById('p1NameText').textContent = 'P1: ' + selectedP1Char.name;
  document.getElementById('p2NameText').textContent = selectedP2Char.name + p2Suffix;
  document.getElementById('headerModeLabel').textContent = selectedGameMode === '1P' ? '1P VS Adaptive AI' : selectedGameMode === 'CAM2P' ? '2P Shared Camera' : '2P Local VS';
  document.getElementById('settingsModeDisplay').textContent = selectedGameMode === '1P' ? '1P VS AI' : selectedGameMode;
  document.getElementById('settingsLevelDisplay').textContent = 'LVL ' + gameLevel + ': ' + tierName(gameLevel);
  document.getElementById('gameOverlay').classList.add('hidden');
  renderRoundPips();
  startNextRound().catch(err => console.error('Round start failed', err));
}

function togglePause() {
  if (gameState !== 'PLAYING' && gameState !== 'PAUSED') return;
  const isPausing = gameState === 'PLAYING';
  gameState = isPausing ? 'PAUSED' : 'PLAYING';
  const icon = isPausing ? 'play' : 'pause';
  ['pauseBtn', 'headerPauseBtn'].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.innerHTML = `<i class="fa-solid fa-${icon}"></i>`;
    button.setAttribute('aria-label', isPausing ? 'Resume match' : 'Pause match');
    button.setAttribute('aria-pressed', String(isPausing));
    button.title = isPausing ? 'Resume match' : 'Pause match';
  });
  const overlay = document.getElementById('pauseOverlay');
  overlay.classList.toggle('active', isPausing);
  overlay.setAttribute('aria-hidden', String(!isPausing));
  if (isPausing) {
    usabilityObserver.log('match_pause');
    document.getElementById('resumeBtn').focus();
  } else {
    usabilityObserver.log('match_resume');
    document.getElementById('pauseBtn')?.focus();
  }
}
function toggleMute() {
  sound.muted = !sound.muted;
  savePrefs();
  document.getElementById('muteBtn').innerHTML = sound.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
}
