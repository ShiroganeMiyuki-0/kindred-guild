// ===================== CALIBRATION =====================
function updateCalibration(landmarks) {
  if (!calibrationActive || !finiteLandmarks(landmarks)) return;
  const now = performance.now();
  const torsoCenter = (landmarks[11].x + landmarks[12].x + landmarks[23].x + landmarks[24].x) / 4;
  calibrationSamples.push({
    centered: torsoCenter > 0.22 && torsoCenter < 0.78,
    fullBody: Math.min(landmarks[0].y, landmarks[27].y, landmarks[28].y) < 0.20 && Math.max(landmarks[27].y, landmarks[28].y) > 0.88,
    shoulderWidth: Math.abs(landmarks[11].x - landmarks[12].x)
  });
  if (now - calibrationStartedAt >= 3500) finishCalibration();
}

function finishCalibration() {
  calibrationActive = false;
  const samples = calibrationSamples;
  const enough = samples.length >= 18;
  const centered = samples.filter(s => s.centered).length / Math.max(1, samples.length) >= 0.75;
  const fullBody = samples.filter(s => s.fullBody).length / Math.max(1, samples.length) >= 0.75;
  const pass = enough && centered && fullBody;
  if (pass) updateGestureStatus('CAMERA CALIBRATED — READY', 'text-emerald-400');
  else updateGestureStatus('ADJUST POSITION — TRY AGAIN', 'text-amber-400');
}

async function startCalibration() {
  if (calibrationActive) return;
  calibrationActive = true; calibrationStartedAt = performance.now(); calibrationSamples = [];
  usabilityObserver.log('calibration_start');
  updateGestureStatus('CALIBRATING — HOLD STILL...', 'text-amber-400');
  if (!cameraStream) await initCamera();
  if (!cameraStream) { calibrationActive = false; return; }
}
