// ===================== MODALS =====================
function openModeSelectModal() {
  const grid = document.getElementById('modeModalGrid');
  grid.innerHTML = '';
  GAME_MODES.forEach(mode => {
    const card = document.createElement('div');
    const isDisabled = !!mode.disabled;
    const active = !isDisabled && selectedModeVariant === 'CORE' && selectedGameMode === mode.id;
    card.className = 'mode-card p-3' + (active ? ' selected' : '') + (isDisabled ? ' opacity-50 cursor-not-allowed' : '');
    const colorMap = { cyan:'#38bdf8', rose:'#f43f5e', emerald:'#10b981', purple:'#a855f7', orange:'#f97316' };
    const hex = colorMap[mode.color] || '#38bdf8';
    card.innerHTML = `
      <div class="flex items-center gap-2 mb-1"><i class="fa-solid ${mode.icon}" style="color:${hex}"></i><span class="font-orbitron text-xs font-bold" style="color:${hex}">${mode.name}</span>${isDisabled ? '<span class="ml-auto text-[8px] font-orbitron text-amber-400 border border-amber-500/30 rounded px-1 py-0.5">SOON</span>' : ''}</div>
      <p class="text-[10px] text-slate-400 font-inter">${mode.desc}</p>
    `;
    if (isDisabled) {
      card.setAttribute('aria-disabled', 'true');
    } else {
      card.onclick = () => {
        grid.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedModeVariant = 'CORE';
        selectedGameMode = mode.id;
      };
    }
    grid.appendChild(card);
  });
  document.getElementById('modeSelectModal').classList.remove('hidden');
}

function closeModeSelectModal() { document.getElementById('modeSelectModal').classList.add('hidden'); }

function confirmModeAndStart() {
  gameLevel = 1;
  closeModeSelectModal();
  // Small delay so modal fade-out doesn't overlap with round banner
  setTimeout(() => {
    startMatch();
    if (selectedGameMode === '2P') toggleKeyboardDrawer();
    if (isMobile) document.getElementById('touchControls').classList.add('active');
  }, 80);
}

function showHelpModal() { document.getElementById('helpModal').classList.add('active'); }
function hideHelpModal() { document.getElementById('helpModal').classList.remove('active'); }
function toggleKeyboardDrawer() { document.getElementById('keyboardDrawer').classList.toggle('active'); }
function toggleMobileSettings() { document.getElementById('mobileSettingsPanel').classList.toggle('hidden'); }
