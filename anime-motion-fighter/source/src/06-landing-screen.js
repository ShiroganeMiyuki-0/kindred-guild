// ===================== LANDING SCREEN =====================
function initLanding() {
  const grid = document.getElementById('landingModeGrid');
  if (!grid) return;
  grid.innerHTML = '';
  GAME_MODES.forEach(mode => {
    const card = document.createElement('div');
    const isDisabled = !!mode.disabled;
    card.className = 'mode-card p-4' + (mode.id === selectedGameMode ? ' selected' : '') + (isDisabled ? ' opacity-50 cursor-not-allowed' : '');
    card.dataset.mode = mode.id;
    const colorMap = { cyan:'#38bdf8', rose:'#f43f5e', emerald:'#10b981', purple:'#a855f7', orange:'#f97316' };
    const hex = colorMap[mode.color] || '#38bdf8';
    card.innerHTML = `
      <div class="flex items-center gap-3 mb-2">
        <i class="fa-solid ${mode.icon} text-xl" style="color:${hex}"></i>
        <span class="font-orbitron font-bold text-sm" style="color:${hex}">${mode.name}</span>
        ${isDisabled ? '<span class="ml-auto text-[9px] font-orbitron text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">SOON</span>' : ''}
      </div>
      <p class="text-xs text-slate-400 font-inter leading-relaxed">${mode.desc}</p>
    `;
    if (isDisabled) {
      card.setAttribute('aria-disabled', 'true');
    } else {
      card.onclick = () => {
        grid.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedGameMode = mode.id;
        selectedModeVariant = 'CORE';
      };
    }
    grid.appendChild(card);
  });

  const p1NameEl = document.getElementById('landingP1Name'), p2NameEl = document.getElementById('landingP2Name');
  if (p1NameEl) p1NameEl.textContent = selectedP1Char.name;
  if (p2NameEl) p2NameEl.textContent = selectedP2Char.name;

  // Character grids
  renderCharGrid('landingP1Grid', ch => { selectedP1Char = ch; document.getElementById('landingP1Name').textContent = ch.name; }, selectedP1Char);
  renderCharGrid('landingP2Grid', ch => { selectedP2Char = ch; document.getElementById('landingP2Name').textContent = ch.name; }, selectedP2Char);

  document.getElementById('landingStartBtn').onclick = async () => {
    savePrefs();
    document.getElementById('landingScreen').classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('hidden');
    document.getElementById('gameContainer').classList.add('flex');
    await bootGame();
  };
}

function renderCharGrid(gridId, onSelect, selectedChar) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  Object.values(CHARACTERS).forEach(ch => {
    const hex = '#' + ch.colorHex.toString(16).padStart(6, '0');
    const btn = document.createElement('button');
    btn.className = 'p-2 rounded-lg border text-left transition ' + (ch.id === selectedChar.id
      ? 'bg-slate-800 border-cyan-500/50 shadow-[0_0_12px_rgba(56,189,248,.15)]'
      : 'bg-slate-900 border-slate-700/50 hover:border-slate-500');
    btn.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${hex};box-shadow:0 0 6px ${hex}"></span>
        <span class="font-orbitron text-[10px] font-bold">${ch.name}</span>
      </div>
      <div class="text-[9px] text-slate-500 mt-0.5 font-inter">${ch.desc} · <span class="text-amber-300/80">${ch.trait}</span></div>
    `;
    btn.onclick = () => {
      grid.querySelectorAll('button').forEach(b => {
        b.className = 'p-2 rounded-lg border text-left transition bg-slate-900 border-slate-700/50 hover:border-slate-500';
      });
      btn.className = 'p-2 rounded-lg border text-left transition bg-slate-800 border-cyan-500/50 shadow-[0_0_12px_rgba(56,189,248,.15)]';
      onSelect(ch);
    };
    grid.appendChild(btn);
  });
}
