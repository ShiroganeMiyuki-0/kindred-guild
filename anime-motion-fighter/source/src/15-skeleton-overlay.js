// ===================== SKELETON OVERLAY =====================
// Draws the player's body on the camera preview so they can see what the game sees
function drawSkeletonOverlay(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length < 33) return;

  // Connection lines between body parts
  const connections = [
    [11,12], [11,13], [13,15], [12,14], [14,16], // arms
    [11,23], [12,24], [23,24], // torso
    [23,25], [25,27], [24,26], [26,28], // legs
    [0,11], [0,12], // neck
  ];

  // Draw connection lines
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'; // cyan
  ctx.lineCap = 'round';
  for (const [a, b] of connections) {
    const la = landmarks[a], lb = landmarks[b];
    if (!la || !lb) continue;
    ctx.beginPath();
    ctx.moveTo(la.x * w, la.y * h);
    ctx.lineTo(lb.x * w, lb.y * h);
    ctx.stroke();
  }

  // Draw body part dots
  const keyPoints = [
    { idx: 15, label: 'L', color: '#38bdf8' }, // left wrist
    { idx: 16, label: 'R', color: '#38bdf8' }, // right wrist
    { idx: 27, label: 'L', color: '#10b981' }, // left ankle
    { idx: 28, label: 'R', color: '#10b981' }, // right ankle
    { idx: 11, label: '', color: '#94a3b8' },  // left shoulder
    { idx: 12, label: '', color: '#94a3b8' },  // right shoulder
    { idx: 23, label: '', color: '#94a3b8' },  // left hip
    { idx: 24, label: '', color: '#94a3b8' },  // right hip
  ];

  for (const pt of keyPoints) {
    const lm = landmarks[pt.idx];
    if (!lm) continue;
    const x = lm.x * w, y = lm.y * h;
    const vis = lm.visibility || 0;
    const radius = vis > 0.5 ? 6 : 4;
    const alpha = Math.max(0.3, vis);

    // Glow effect — convert hex to rgba with reduced alpha (the prior
    // .replace(')', ...) trick silently no-op'd on hex strings, leaving
    // the glow at full opacity and making the dots look harsh).
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(pt.color, alpha * 0.3);
    ctx.fill();

    // Solid dot
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = vis > 0.5 ? pt.color : '#ef4444';
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Label
    if (pt.label) {
      ctx.font = 'bold 9px Orbitron';
      ctx.fillStyle = '#fff';
      ctx.fillText(pt.label, x + 8, y + 3);
    }
  }

  // Draw attack zones (hands and feet) with larger indicator
  const attackParts = [15, 16, 27, 28];
  for (const idx of attackParts) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const x = lm.x * w, y = lm.y * h;
    // Pulsing ring
    const pulse = Math.sin(performance.now() * 0.005) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = idx <= 16 ? `rgba(56, 189, 248, ${pulse * 0.4})` : `rgba(16, 185, 129, ${pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Tracking quality bar at top
  const visibleCount = [11,12,15,16,23,24,27,28].filter(i => (landmarks[i]?.visibility || 0) > 0.5).length;
  const quality = visibleCount / 8;
  const barW = w - 16;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 4, barW, 6);
  const qColor = quality > 0.75 ? '#10b981' : quality > 0.5 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = qColor;
  ctx.fillRect(8, 4, barW * quality, 6);

  // Quality text
  ctx.font = 'bold 8px Orbitron';
  ctx.fillStyle = qColor;
  ctx.fillText(quality > 0.75 ? 'TRACKING GOOD' : quality > 0.5 ? 'TRACKING OK' : 'ADJUST POSITION', 10, 18);
}
