// ===================== ADAPTIVE AI =====================
function queueAIAction(action) {
  ai.pendingAction = action;
  // The wind-up shrinks as the threat tier rises (900ms at tier 1 -> 460ms at tier 5), so late tiers demand real reads.
  ai.telegraphTimer = Math.max(460, 900 - (gameLevel - 1) * 110);
  ai.stance = 'CHARGING'; ai.isCharging = true;
  updateGestureStatus(action === 'SUPER' ? 'INCOMING SUPER — GUARD!' : 'ATTACK INCOMING', 'text-rose-400');
}

function updateAdaptiveAI(delta) {
  if (selectedGameMode !== '1P' || dualCamMode || gameState !== 'PLAYING' || roundLocked || !playerReadyForCombat) return;
  if (trainingBeat) {
    trainingBeatTimer -= delta;
    if (playerScore > 0 || combo > 0 || trainingBeatTimer <= 0) {
      trainingBeat = false;
      setCombatPhase('READY', 'OPPONENT IS LIVE', 'text-emerald-400');
    } else {
      if (performance.now() > combatPhaseUntil) setCombatPhase('READY', 'TRAINING — LAND ONE HIT', 'text-amber-400');
      return;
    }
  }
  if (ai.pendingAction) {
    ai.telegraphTimer -= delta;
    ai.stance = 'CHARGING'; ai.isCharging = true;
    if (ai.telegraphTimer <= 0) {
      const action = ai.pendingAction; ai.pendingAction = null; ai.isCharging = false;
      if (action === 'SUPER') executePlayerSuper(2);
      else if (action === 'PUNCH') { ai.stance = 'PUNCH'; executePlayerPunch(2); }
      else { ai.stance = 'KICK'; executePlayerKick(2); }
    }
    return;
  }
  ai.actionTimer += delta;
  if (ai.actionTimer < ai.reactionDelay) return;
  ai.actionTimer = 0;
  const rand = Math.random();
  const h = ai.history;
  const favMove = Object.keys(h).reduce((a, b) => h[b] > h[a] ? b : a, 'PUNCH');
  const aggro = Math.min(0.25, (gameLevel - 1) * 0.05);

  if (ai.ki >= 100 && rand < 0.8 + aggro) { queueAIAction('SUPER'); return; }
  if (player.stance === 'PUNCH' && rand < 0.55 + aggro) {
    ai.stance = 'GUARD'; ai.isGuarding = true; ai.isCrouching = false; ai.isCharging = false;
    setCombatPhase('AI_GUARD', 'OPPONENT GUARDS', 'text-rose-300');
    setTimeout(() => { if (ai.stance === 'GUARD') { ai.isGuarding = false; ai.stance = 'IDLE'; } }, 450);
    return;
  }
  if (player.stance === 'CHARGING' && rand < 0.7 + aggro) { queueAIAction('PUNCH'); return; }
  if (favMove === 'KICK' && rand < 0.35 + aggro) { ai.stance = 'CROUCH'; ai.isCrouching = true; ai.isGuarding = false; ai.isCharging = false; setTimeout(() => { ai.isCrouching = false; if (ai.stance === 'CROUCH') ai.stance = 'IDLE'; }, 500); return; }
  if (favMove === 'PUNCH' && rand < 0.3 + aggro) { ai.stance = 'GUARD'; ai.isGuarding = true; ai.isCrouching = false; ai.isCharging = false; setTimeout(() => { ai.isGuarding = false; if (ai.stance === 'GUARD') ai.stance = 'IDLE'; }, 450); return; }
  if (rand < 0.35) { ai.stance = 'CHARGING'; gainKi(ai, 15 * fighterMods(2).ki); updateHud(); return; }
  if (rand < 0.68) { queueAIAction('PUNCH'); return; }
  queueAIAction('KICK');
}
