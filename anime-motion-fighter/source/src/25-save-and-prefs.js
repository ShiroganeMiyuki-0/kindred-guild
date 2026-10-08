// ===================== SAVE + PREFS =====================
// Remembers your mode, fighters, mute setting and career record between visits.
// Everything stays in this browser's localStorage; every access is guarded because
// storage can be unavailable (private mode, blocked cookies, quota).
const SAVE_KEY = 'amf.save.v1';
let lastCareer = null;

function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
}
function writeSave(patch) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...readSave(), ...patch })); } catch (e) { /* storage unavailable */ }
}

function savePrefs() {
  writeSave({ mode: selectedGameMode, p1: selectedP1Char.id, p2: selectedP2Char.id, muted: !!sound.muted });
}

function loadSavedPrefs() {
  const s = readSave();
  if (GAME_MODES.some(m => m.id === s.mode && !m.disabled)) selectedGameMode = s.mode;
  if (CHARACTERS[s.p1]) selectedP1Char = CHARACTERS[s.p1];
  if (CHARACTERS[s.p2]) selectedP2Char = CHARACTERS[s.p2];
  if (typeof s.muted === 'boolean') {
    sound.muted = s.muted;
    const btn = document.getElementById('muteBtn');
    if (btn && s.muted) btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
  }
}

// Only Solo vs AI counts toward the career record.
function recordMatchResult(playerWon) {
  const c = { matches: 0, wins: 0, losses: 0, bestCombo: 0, topTier: 1, ...(readSave().career || {}) };
  c.matches++;
  if (playerWon) c.wins++; else c.losses++;
  c.bestCombo = Math.max(c.bestCombo, bestCombo);
  c.topTier = Math.max(c.topTier, gameLevel);
  writeSave({ career: c });
  return c;
}

// Pause automatically if the tab/window is hidden mid-fight (the AI and round timers keep running otherwise).
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameState === 'PLAYING' && !roundLocked) togglePause();
});
