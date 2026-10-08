// ===================== INIT =====================
window.addEventListener('DOMContentLoaded', async () => {
  // Loading sequence
  updateLoading(20, 'Loading 3D engine...');
  await new Promise(r => setTimeout(r, 300));
  updateLoading(50, 'Preparing arena...');
  await new Promise(r => setTimeout(r, 200));
  updateLoading(80, 'Loading fighters...');
  await new Promise(r => setTimeout(r, 200));
  updateLoading(100, 'Ready!');
  await new Promise(r => setTimeout(r, 300));

  hideLoading();
  loadSavedPrefs();
  document.getElementById('landingScreen').classList.remove('hidden');
  initLanding();
});

// Cleanup
window.addEventListener('pagehide', () => {
  dualCamRunning = false;
  stopCameraStream();
  dualCamLandmarker?.close?.(); dualCamLandmarker = null;
  renderer?.dispose?.();
});
window.addEventListener('error', (e) => console.error('[AMF]', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[AMF]', e.reason));
