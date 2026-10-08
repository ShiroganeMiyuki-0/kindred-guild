// ===================== BOOT =====================
async function bootGame() {
  try {
    // Check for CDN script load failures — if critical globals are missing,
    // the CDN scripts failed (ad blocker, network issue, etc.)
    if (typeof THREE === 'undefined') {
      const overlay = document.getElementById('gameOverlay');
      document.getElementById('overlayTitle').innerHTML = '<span class="text-rose-400">RESOURCE LOAD ERROR</span>';
      document.getElementById('overlayDesc').textContent = 'The 3D engine (Three.js) failed to load. Check your internet connection, disable ad blockers for this site, and reload.';
      document.getElementById('overlayButtons').innerHTML = '<button onclick="location.reload()" class="cta-button cta-primary text-sm">RELOAD</button>';
      overlay.classList.remove('hidden');
      return;
    }
    // Wait for fonts to load so canvas text renders correctly
    if (document.fonts) { try { await document.fonts.load('700 16px Orbitron'); } catch(e) {} }
    init3DWorld();
    renderCharGrid('landingP1Grid', ch => { selectedP1Char = ch; }, selectedP1Char);
    renderCharGrid('landingP2Grid', ch => { selectedP2Char = ch; }, selectedP2Char);
    requestAnimationFrame(animate3D);
    sound.init();
    sound.startAmbient();

    // Observer panel is opt-in via ?test=1 (per docs/usability-test.md)
    if (new URLSearchParams(location.search).get('test') === '1') {
      usabilityObserver.enabled = true;
      mountUsabilityPanel();
    }

    // Show touch controls on mobile
    if (isMobile) {
      document.getElementById('touchControls').classList.add('active');
    }

    // Show overlay
    const overlay = document.getElementById('gameOverlay');
    document.getElementById('overlayTitle').textContent = 'ANIME MOTION FIGHTER';
    document.getElementById('overlayDesc').textContent = 'Stand where the camera can see you, or use keyboard/touch controls. Make clear hand or foot motions to attack.';
    document.getElementById('overlayButtons').innerHTML = `
      <button onclick="startMatch()" class="cta-button cta-primary text-sm"><i class="fa-solid fa-play mr-2"></i>START MATCH</button>
      <button onclick="openModeSelectModal()" class="cta-button cta-secondary text-sm"><i class="fa-solid fa-users mr-2"></i>CHANGE MODE</button>
    `;
    overlay.classList.remove('hidden');
  } catch (error) {
    console.error('Game boot failed', error);
    const overlay = document.getElementById('gameOverlay');
    document.getElementById('overlayTitle').innerHTML = '<span class="text-rose-400">ENGINE ERROR</span>';
    document.getElementById('overlayDesc').textContent = 'The 3D engine could not start. Try a modern browser with hardware acceleration.';
    document.getElementById('overlayButtons').innerHTML = '<button onclick="location.reload()" class="cta-button cta-primary text-sm">RELOAD</button>';
    overlay.classList.remove('hidden');
  }
}
