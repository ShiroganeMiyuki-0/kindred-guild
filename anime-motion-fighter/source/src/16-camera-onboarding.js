// ===================== CAMERA ONBOARDING =====================
let onboardingShown = false;
function showCameraOnboarding() {
  if (onboardingShown) return;
  onboardingShown = true;

  const panel = document.getElementById('cameraFeedPanel');
  if (!panel) return;

  const guide = document.createElement('div');
  guide.id = 'cameraOnboarding';
  guide.className = 'camera-onboarding';
  guide.innerHTML = `
    <div class="camera-onboarding-title">WEBCAM GUIDE</div>
    <div class="camera-onboarding-body">
      <div>👋 <strong style="color:#38bdf8;">Stand back</strong> until you see your full body</div>
      <div>🎯 <strong style="color:#10b981;">Green dots</strong> = body parts detected</div>
      <div>🔴 <strong style="color:#ef4444;">Red dots</strong> = move into view</div>
      <div>👊 <strong style="color:#fbbf24;">Punch forward</strong> to attack</div>
      <div>🛡️ <strong style="color:#818cf8;">Hands up</strong> to guard</div>
    </div>
    <button class="camera-onboarding-dismiss" onclick="this.parentElement.remove()">GOT IT</button>
  `;
  panel.appendChild(guide);

  setTimeout(() => { guide.remove(); }, 8000);
}
