// ===================== LOADING =====================
function updateLoading(percent, status) {
  const fill = document.getElementById('loadingBarFill');
  const statusEl = document.getElementById('loadingStatus');
  if (fill) fill.style.width = percent + '%';
  if (statusEl) statusEl.textContent = status;
}

function hideLoading() {
  const el = document.getElementById('loadingScreen');
  if (el) { el.classList.add('fade-out'); setTimeout(() => el.classList.add('hidden'), 600); }
}
