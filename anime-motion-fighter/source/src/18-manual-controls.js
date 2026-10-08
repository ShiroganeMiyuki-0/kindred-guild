// ===================== MANUAL CONTROLS =====================
function triggerManualAction(playerNum, action) {
  if (gameState !== 'PLAYING' || roundLocked) return;
  if (playerNum === 1) playerReadyForCombat = true;
  const targetObj = playerNum === 1 ? player : ai;
  if (action === 'PUNCH') { targetObj.stance = 'PUNCH'; executePlayerPunch(playerNum); }
  else if (action === 'KICK') { targetObj.stance = 'KICK'; executePlayerKick(playerNum); }
  else if (action === 'GUARD') { targetObj.stance = 'GUARD'; targetObj.isGuarding = true; targetObj.isCrouching = false; targetObj.isCharging = false; setTimeout(() => { targetObj.isGuarding = false; if (targetObj.stance === 'GUARD') targetObj.stance = 'IDLE'; }, 400); }
  else if (action === 'DUCK') { targetObj.stance = 'CROUCH'; targetObj.isCrouching = true; targetObj.isGuarding = false; targetObj.isCharging = false; setTimeout(() => { targetObj.isCrouching = false; if (targetObj.stance === 'CROUCH') targetObj.stance = 'IDLE'; }, 400); }
  else if (action === 'CHARGE') {
    // Was +20 per tap with no limit (5 taps = free super). Now +10, at most 4 taps/second.
    targetObj.stance = 'CHARGING';
    const t = performance.now();
    if (t - (targetObj.lastChargeAt || 0) >= 250) {
      targetObj.lastChargeAt = t;
      gainKi(targetObj, 10 * fighterMods(playerNum).ki); sound.playCharge(); updateHud();
    }
  }
  else if (action === 'SUPER') {
    if (targetObj.ki >= 100) executePlayerSuper(playerNum);
    else addFloatingText('NEED 100% KI!', playerNum === 1 ? 0.3 : 0.7, 0.4, '#eab308');
  }
}

window.addEventListener('keydown', (e) => {
  const target = e.target;
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
  if (e.key === 'Escape' && !isTyping) {
    if (document.getElementById('helpModal').classList.contains('active')) { hideHelpModal(); return; }
    if (!document.getElementById('modeSelectModal').classList.contains('hidden')) { closeModeSelectModal(); return; }
    if (gameState === 'PLAYING' || gameState === 'PAUSED') { e.preventDefault(); togglePause(); }
    return;
  }
  if (gameState !== 'PLAYING' || isTyping || e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'j') triggerManualAction(1, 'PUNCH');
  if (k === 'i') triggerManualAction(1, 'KICK');
  if (k === 'k') triggerManualAction(1, 'GUARD');
  if (k === 's') triggerManualAction(1, 'DUCK');
  if (k === 'l') triggerManualAction(1, 'CHARGE');
  if (e.code === 'Space') { e.preventDefault(); triggerManualAction(1, 'SUPER'); }
  if (k === '1') triggerManualAction(2, 'PUNCH');
  if (k === '2') triggerManualAction(2, 'KICK');
  if (k === '3') triggerManualAction(2, 'GUARD');
  if (k === '4') triggerManualAction(2, 'CHARGE');
  if (k === '5') triggerManualAction(2, 'DUCK');
  if (k === '0') triggerManualAction(2, 'SUPER');
});
