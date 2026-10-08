// ===================== USABILITY TEST MODE (?test=1) =====================
// Local-only observer panel documented in docs/usability-test.md. Records
// high-level in-session events to memory; never uploads anything.
Object.assign(usabilityObserver, {
  enabled: false,
  events: [],
  recording: false,
  startedAt: 0,
  log(type, data = {}) {
    if (!this.enabled || !this.recording) return;
    this.events.push({ t: Date.now() - this.startedAt, type, ...data });
    const counter = document.getElementById('usabilityEventCount');
    if (counter) counter.textContent = this.events.length;
  },
  exportLog() {
    const payload = {
      startedAt: new Date(this.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      mode: selectedGameMode,
      p1: selectedP1Char?.id,
      p2: selectedP2Char?.id,
      level: gameLevel,
      events: this.events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amf-observation-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
});
function mountUsabilityPanel() {
  if (!usabilityObserver.enabled) return;
  const panel = document.createElement('div');
  panel.id = 'usabilityPanel';
  panel.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:70;background:rgba(2,6,23,.92);border:1px solid rgba(56,189,248,.3);border-radius:12px;padding:10px 12px;font-family:Orbitron,sans-serif;color:#e2e8f0;backdrop-filter:blur(8px);min-width:200px;font-size:10px;';
  panel.innerHTML = `
    <div style="color:#38bdf8;letter-spacing:.1em;margin-bottom:6px;">OBSERVER</div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span id="usabilityRecDot" style="width:8px;height:8px;border-radius:50%;background:#94a3b8;"></span>
      <span id="usabilityRecLabel" style="color:#94a3b8;">IDLE</span>
    </div>
    <div style="color:#94a3b8;">Events: <b id="usabilityEventCount" style="color:#fbbf24;">0</b></div>
    <div style="display:flex;gap:6px;margin-top:8px;">
      <button id="usabilityRecBtn" style="flex:1;padding:4px 8px;background:rgba(56,189,248,.15);border:1px solid rgba(56,189,248,.4);border-radius:6px;color:#38bdf8;font:inherit;cursor:pointer;">RECORD</button>
      <button id="usabilityExpBtn" style="flex:1;padding:4px 8px;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.4);border-radius:6px;color:#fbbf24;font:inherit;cursor:pointer;">EXPORT</button>
    </div>
  `;
  document.body.appendChild(panel);
  const dot = document.getElementById('usabilityRecDot');
  const lbl = document.getElementById('usabilityRecLabel');
  document.getElementById('usabilityRecBtn').onclick = () => {
    usabilityObserver.recording = !usabilityObserver.recording;
    if (usabilityObserver.recording) {
      usabilityObserver.startedAt = Date.now();
      usabilityObserver.events = [];
      dot.style.background = '#f43f5e';
      lbl.textContent = 'RECORDING';
      lbl.style.color = '#f43f5e';
      usabilityObserver.log('observer_start', { mode: selectedGameMode });
    } else {
      usabilityObserver.log('observer_stop');
      dot.style.background = '#94a3b8';
      lbl.textContent = 'IDLE';
      lbl.style.color = '#94a3b8';
    }
  };
  document.getElementById('usabilityExpBtn').onclick = () => usabilityObserver.exportLog();
}
