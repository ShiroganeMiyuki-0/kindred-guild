// ============================================
// KINDRED GUILD — PROFILE LOGIC
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Uses shared window.sb from supabase-client.js
// ============================================

let currentUser = null;
let profileUser = null;
let customModalResolve = null;

function showCustomAlert(title, text, confirmOnly) {
  document.getElementById('customModalTitle').textContent = title;
  document.getElementById('customModalText').textContent = text;
  document.getElementById('customModalCancel').style.display = confirmOnly ? 'none' : 'block';
  document.getElementById('customModalOverlay').style.display = 'flex';
  return new Promise(resolve => { customModalResolve = resolve; });
}

document.getElementById('customModalConfirm').onclick = function () {
  document.getElementById('customModalOverlay').style.display = 'none';
  if (customModalResolve) customModalResolve(true);
};
document.getElementById('customModalCancel').onclick = function () {
  document.getElementById('customModalOverlay').style.display = 'none';
  if (customModalResolve) customModalResolve(false);
};

function getUsernameParam() { return getUrlParam('username'); }

(async function init() {
  const { data: { user } } = await window.sb.auth.getUser();
  if (user) currentUser = user;

  const targetUsername = getUsernameParam();
  if (!targetUsername && !currentUser) { window.location.href = 'auth.html'; return; }

  let query = window.sb.from('user_profiles').select('*');
  if (targetUsername) query = query.eq('username', targetUsername).single();
  else query = query.eq('user_id', currentUser.id).single();

  const { data: profile, error } = await query;
  if (error || !profile) {
    await showCustomAlert('Not Found', 'Profile not found.', true);
    window.location.href = 'quest-board.html';
    return;
  }

  profileUser = profile;
  renderProfileOverview();

  if (currentUser && currentUser.id === profileUser.user_id) {
    document.getElementById('editProfileTabBtn').style.display = 'block';
    document.getElementById('editDisplayName').value = profileUser.display_name || '';
    document.getElementById('editAvatarUrl').value = profileUser.avatar_url || '';
    document.getElementById('editUpiId').value = profileUser.upi_id || '';
    document.getElementById('editUpiQrUrl').value = profileUser.upi_qr_url || '';
    if (profileUser.upi_qr_url) {
      const st = document.getElementById('upiQrStatus');
      st.textContent = '✅ QR code saved.'; st.style.display = 'block';
    }
    const { data: balance } = await window.sb.rpc('get_coin_balance', { p_user_id: currentUser.id });
    document.getElementById('privateBalanceDisplay').textContent = balance || 0;
  } else {
    document.getElementById('privateBalanceDisplay').parentElement.style.display = 'none';
    // Add Message button for other users' profiles
    if (currentUser) {
      const msgBtn = document.createElement('a');
      msgBtn.href = '#';
      msgBtn.className = 'btn btn-primary btn-sm';
      msgBtn.style.marginTop = '8px';
      msgBtn.textContent = '💬 Message';
      msgBtn.onclick = async (e) => {
        e.preventDefault();
        const { data: convId, error } = await window.sb.rpc('get_or_create_dm', { p_other_user_id: profileUser.user_id });
        if (error) { window.showToast('Failed: ' + error.message, 'error'); return; }
        window.location.href = 'dm.html';
      };
      document.querySelector('.meta-details').appendChild(msgBtn);
    }
  }

  loadUserQuestsHistory();
})();

function renderProfileOverview() {
  const p = profileUser;
  document.getElementById('profileDisplayName').textContent = p.display_name || p.username;
  document.getElementById('profileUsername').textContent = '@' + p.username;
  const score = p.reputation_score ? (p.reputation_score / 10).toFixed(1) : '0.0';
  document.getElementById('profileRepScore').textContent = `${score} / 5.0`;
  if (p.is_verified) {
    const nameEl = document.getElementById('profileDisplayName');
    nameEl.innerHTML = escapeHtml(p.display_name || p.username) + ' <span title="Verified Worker" style="color:#10b981;font-size:1.2rem;">✅</span>';
  }
  // Show rank badge (Guild Master for admins, rank for others)
  const repEl = document.getElementById('profileRepScore');
  if (p.is_admin) {
    repEl.innerHTML = `<span style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;padding:4px 12px;border-radius:6px;font-weight:900;font-size:0.85rem;margin-right:6px;">👑 Guild Master</span> ${score} / 5.0`;
  } else if (p.rank) {
    repEl.innerHTML = `<span class="rank-badge rank-${p.rank}" style="margin-right:6px;">${p.rank}</span> ${score} / 5.0`;
  }
  if (p.avatar_url) document.getElementById('profileAvatar').src = p.avatar_url;
  if (p.is_suspended) document.getElementById('suspensionNotice').style.display = 'block';
  loadProfileStats();
}

async function loadProfileStats() {
  const { data: stats } = await window.sb.rpc('get_profile_stats', { p_user_id: profileUser.user_id });
  if (!stats) return;
  const el = (id) => document.getElementById(id);
  if (el('statCompleted')) el('statCompleted').textContent = stats.quests_completed || 0;
  if (el('statPosted')) el('statPosted').textContent = stats.quests_posted || 0;
  if (el('statWishesBacked')) el('statWishesBacked').textContent = stats.wishes_backed || 0;
  if (el('statGuildMsgs')) el('statGuildMsgs').textContent = stats.guild_messages || 0;
  if (el('statTotalEarned')) el('statTotalEarned').textContent = (stats.total_earned || 0) + ' FC';
  if (el('statAvgRating')) el('statAvgRating').textContent = stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(1) : '—';
  if (el('statVerified') && stats.is_verified) el('statVerified').style.display = 'block';
}

window.switchProfileTab = function (tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(tabId).classList.add('active');
};

window.handleQrFileUpload = async function (input) {
  if (!input.files?.[0]) return;
  const file = input.files[0];
  const status = document.getElementById('upiQrStatus');
  const saveBtn = document.getElementById('saveProfileBtn');
  saveBtn.disabled = true; status.textContent = 'Uploading...'; status.style.display = 'block';

  try {
    const ext = file.name.split('.').pop();
    const path = `qrs/${currentUser.id}-${Date.now()}.${ext}`;
    const { error } = await window.sb.storage.from('quest-images').upload(path, file);
    if (error) throw error;
    document.getElementById('editUpiQrUrl').value = window.sb.storage.from('quest-images').getPublicUrl(path).data.publicUrl;
    status.textContent = '✅ Uploaded. Save to complete.';
  } catch (err) {
    status.textContent = '❌ Upload failed.';
  } finally {
    saveBtn.disabled = false;
  }
};

async function loadUserQuestsHistory() {
  const { data: posted } = await window.sb.from('quests').select('*').eq('poster_id', profileUser.user_id).eq('is_deleted', false).order('created_at', { ascending: false });
  const { data: completed } = await window.sb.from('quests').select('*').eq('worker_id', profileUser.user_id).eq('is_deleted', false).order('created_at', { ascending: false });

  const pList = document.getElementById('postedQuestsList');
  pList.innerHTML = posted?.length
    ? posted.map(q => `<div class="quest-item"><a href="quest-detail.html?id=${q.id}">${escapeHtml(q.title)}</a><span class="status-badge status-${q.status}">[${q.status}]</span></div>`).join('')
    : '<div style="color:var(--text-dim);padding:10px">No posted tasks yet.</div>';

  const cList = document.getElementById('completedQuestsList');
  cList.innerHTML = completed?.length
    ? completed.map(q => `<div class="quest-item"><a href="quest-detail.html?id=${q.id}">${escapeHtml(q.title)}</a><span class="status-badge status-${q.status}">[${q.status}]</span></div>`).join('')
    : '<div style="color:var(--text-dim);padding:10px">No completed tasks yet.</div>';
}

window.saveProfileChanges = async function () {
  const dName = document.getElementById('editDisplayName').value.trim();
  if (!dName) return;

  const { error } = await window.sb.from('user_profiles').update({
    display_name: dName,
    avatar_url: document.getElementById('editAvatarUrl').value.trim(),
    upi_id: document.getElementById('editUpiId').value.trim(),
    upi_qr_url: document.getElementById('editUpiQrUrl').value.trim()
  }).eq('user_id', currentUser.id);

  if (error) { await showCustomAlert('Error', 'Failed to save: ' + error.message, true); return; }
  await showCustomAlert('Saved', 'Profile updated!', true);
  window.location.reload();
};
