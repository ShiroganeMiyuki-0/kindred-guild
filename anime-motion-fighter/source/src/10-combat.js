// ===================== COMBAT =====================
function setPortraitState(side, state, duration = 360) {
  const el = document.getElementById(side === 'p1' ? 'p1Portrait' : 'p2Portrait');
  if (!el) return;
  clearTimeout(el._stateTimer);
  el.dataset.state = state;
  if (state !== 'ready') el._stateTimer = setTimeout(() => { el.dataset.state = 'ready'; }, duration);
}

// Per-fighter stat traits (see CHARACTERS in 01-constants.js).
const NEUTRAL_MODS = { dmg:1, cd:1, ki:1 };
function fighterMods(num) { return (num === 1 ? selectedP1Char : selectedP2Char).mods || NEUTRAL_MODS; }
function gainKi(actor, amount) { actor.ki = Math.min(actor.maxKi || 100, actor.ki + amount); }
// P2 only earns a counter window when it is a human; the AI never gets one.
function hasCounterWindow(num) { return num === 1 || selectedGameMode !== '1P'; }

function beginCombatAttack(attackerNum, type) {
  if (gameState !== 'PLAYING' || roundLocked) return false;
  const actor = attackerNum === 1 ? player : ai;
  const rule = COMBAT_RULES[type];
  if (!rule) return false;
  const now = performance.now();
  if (now < actor.attackLockUntil) {
    if (attackerNum === 1) setCombatPhase('RECOVERY', 'RECOVERY — WAIT...', 'text-slate-400');
    return false;
  }
  const cooldown = rule.cooldown * fighterMods(attackerNum).cd;
  actor.lastAttackTime = now;
  actor.attackLockUntil = now + cooldown;
  actor.stance = type;
  setPortraitState(attackerNum === 1 ? 'p1' : 'p2', 'attack', Math.min(320, cooldown));
  setTimeout(() => {
    if (actor.stance === type && !actor.isGuarding && !actor.isCrouching) actor.stance = 'READY';
  }, Math.min(260, cooldown - 40));
  return true;
}

function resetCombo() {
  combo = 0; clearTimeout(comboTimer);
  document.getElementById('comboDisplay')?.classList.remove('active');
}

function incrementCombo() {
  combo++;
  if (combo > bestCombo) bestCombo = combo;
  const el = document.getElementById('comboDisplay');
  const numEl = document.getElementById('comboNumber');
  el.classList.add('active');
  numEl.textContent = combo;
  sound.playCombo(combo);
  clearTimeout(comboTimer);
  comboTimer = setTimeout(resetCombo, 1800);
}

function triggerHitStop(frames) { hitStopFrames = Math.max(hitStopFrames, frames); }
function applyKnockback(target, attackerIsP1, amount) { target.knockback = amount * (attackerIsP1 ? 1 : -1); }

// Presentation + meter data for the two basic strikes. Punch and kick used to be
// two ~50-line copies of the same function; they only differ by these numbers.
const STRIKE_FX = {
  PUNCH: { sfx:'playPunch', points:1, sparks:14, blockSparks:8,  stop:4, blockStop:3, flash:0.08, impact:false, lines:8,  color:'#f43f5e', kiGain:4, kiTaken:2,
           hitText: d => '-' + d + ' HP',    floatText: d => '-' + d,           counterText: d => 'COUNTER! +' + d },
  KICK:  { sfx:'playKick',  points:2, sparks:20, blockSparks:10, stop:6, blockStop:4, flash:0.14, impact:true,  lines:12, color:'#10b981', kiGain:6, kiTaken:3,
           hitText: d => '-' + d + ' KICK!', floatText: d => '-' + d + ' KICK!', counterText: d => 'COUNTER KICK! +' + d }
};

function resolveStrike(attackerNum, type, damageMultiplier = 1.0) {
  if (!beginCombatAttack(attackerNum, type)) return;
  const fx = STRIKE_FX[type], rule = COMBAT_RULES[type];
  sound[fx.sfx]();
  const isP1 = attackerNum === 1;
  const attacker = isP1 ? player : ai;
  const target = isP1 ? ai : player;
  const attackerChar = isP1 ? selectedP1Char : selectedP2Char;
  const mods = fighterMods(attackerNum);
  const side = isP1 ? 0.7 : 0.3;
  if (isP1) ai.history[type] = (ai.history[type] || 0) + 1;   // the adaptive AI studies attempts, not just hits

  if (Math.abs(target.dodgeZ || 0) > 0.75 && !target.isGuarding) {
    setCombatPhase('DODGE', 'DODGED!', 'text-lime-300');
    addFloatingText('DODGED!', 0.3, 0.4, '#a3e635');
    updateHud(); checkWinLoss(); return;
  }

  if (target.isGuarding) {
    target.ki = Math.min(100, target.ki + rule.guardKi); sound.playBlock();
    setPortraitState(isP1 ? 'p2' : 'p1', 'guard', 520);
    create3DHitSparks(target.x, 1.7, 0, 0x93c5fd, fx.blockSparks);
    addFloatingText('BLOCKED', side, 0.4, '#38bdf8');
    if (hasCounterWindow(isP1 ? 2 : 1)) target.counterUntil = performance.now() + 700;
    if (target === player) setCombatPhase('BLOCK', 'BLOCKED — COUNTER READY', 'text-indigo-400');
    else setCombatPhase('BLOCK', selectedGameMode === '1P' ? 'AI BLOCKED' : 'P2 BLOCKED — COUNTER READY', 'text-indigo-400');
    triggerHitStop(fx.blockStop);
    updateHud(); checkWinLoss(); return;
  }

  // ---- the strike lands ----
  let damage = rule.damage * damageMultiplier * mods.dmg;
  const isCounter = hasCounterWindow(attackerNum) && (attacker.counterUntil || 0) > performance.now();
  if (isCounter) { damage = rule.counterDamage * damageMultiplier * mods.dmg; attacker.counterUntil = 0; }
  if (isP1) {
    incrementCombo();                                  // only landed hits build a combo
    if (combo > 1) damage *= 1 + Math.min(combo - 1, 10) * 0.05;   // +5% per combo hit, caps at +50%
    playerScore += fx.points;
  } else {
    aiScore += fx.points;
    resetCombo();                                      // getting hit breaks your combo
  }
  // (The old code announced COUNTER and then instantly overwrote it with CONTACT.)
  if (isCounter) setCombatPhase('COUNTER', fx.counterText(Math.ceil(damage)), 'text-amber-300');
  else setCombatPhase('CONTACT', fx.hitText(Math.ceil(damage)), 'text-emerald-400');
  sound.playHit(); target.hp = Math.max(0, target.hp - damage);
  gainKi(attacker, fx.kiGain * mods.ki); gainKi(target, fx.kiTaken);   // fighters build meter by fighting
  setPortraitState(isP1 ? 'p2' : 'p1', 'hit');
  create3DHitSparks(target.x, 1.7, 0, attackerChar.colorHex, fx.sparks);
  addFloatingText(fx.floatText(Math.ceil(damage)), side, 0.4, fx.color);
  target.hitFlash = 1; applyKnockback(target, isP1, rule.knockback); triggerHitStop(rule.hitStop); flashScreen(fx.flash);
  if (fx.impact) triggerImpactFrame();
  speedLinesActive = true; speedLinesTimer = fx.lines;
  updateHud(); checkWinLoss();
}

function executePlayerPunch(attackerNum, damageMultiplier = 1.0) { resolveStrike(attackerNum, 'PUNCH', damageMultiplier); }
function executePlayerKick(attackerNum, damageMultiplier = 1.0) { resolveStrike(attackerNum, 'KICK', damageMultiplier); }

function executePlayerSuper(attackerNum) {
  if (!beginCombatAttack(attackerNum, 'SUPER')) return;
  const isP1 = attackerNum === 1;
  const attacker = isP1 ? player : ai;
  const target = isP1 ? ai : player;
  const attackerChar = isP1 ? selectedP1Char : selectedP2Char;
  const side = isP1 ? 0.7 : 0.3;
  attacker.ki = 0; sound.playBeam();
  triggerCharacterSuperFX(attackerChar, attacker.x, target.x);
  speedLinesActive = true; speedLinesTimer = 30;
  triggerHitStop(8); flashScreen(0.22); triggerImpactFrame(); triggerSlowMotion(600);
  let damage = Math.round(COMBAT_RULES.SUPER.damage * fighterMods(attackerNum).dmg);

  if (target.isCrouching) {
    setCombatPhase('DODGE', 'DUCKED THE SUPER!', 'text-lime-300');
    addFloatingText('DUCKED!', side, 0.4, '#a855f7');
    damage = 0;
  } else if (target.isGuarding) {
    setCombatPhase('BLOCK', 'SUPER BLOCKED!', 'text-indigo-400');
    damage = 0; target.ki = Math.min(100, target.ki + 15); sound.playBlock();
    addFloatingText('BLOCKED +15 KI', side, 0.4, '#38bdf8');
    if (hasCounterWindow(isP1 ? 2 : 1)) target.counterUntil = performance.now() + 900;
  } else {
    setCombatPhase('CONTACT', attackerChar.superName + '! -' + damage, 'text-amber-400');
    addFloatingText('-' + damage + ' ' + attackerChar.superName + '!', side, 0.4, '#f43f5e');
    target.hitFlash = 1; applyKnockback(target, isP1, 0.5);
    if (!isP1) resetCombo();
    if (isP1) playerScore += 3; else aiScore += 3;
  }
  target.hp = Math.max(0, target.hp - damage);
  updateHud(); checkWinLoss();
}
