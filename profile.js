// ============================================
// KINDRED GUILD — PROFILE LOGIC
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let profileUser = null;
let customModalResolve = null;

function showCustomAlert(title, text, confirmOnly = false) {
  document.getElementById('customModalTitle').textContent = title;
  document.getElementById('customModalText').textContent = text;
  
  const cancelBtn = document.getElementById('customModalCancel');
  if (confirmOnly) {
    cancelBtn.style.display = 'none';
  } else {
    cancelBtn.style.display = 'block';
  }

  document.getElementById('customModalOverlay').style.display = 'flex';
  return new Promise((resolve) => {
    customModalResolve = resolve;
  });
}

document.getElementById('customModalConfirm').onclick = function() {
  document.getElementById('customModalOverlay').style.display = 'none';
  if (customModalResolve) customModalResolve(true);
};

document.getElementById('customModalCancel').onclick = function() {
  document.getElementById('customModalOverlay').style.display = 'none';
  if (customModalResolve) customModalResolve(false);
};

function getUsernameParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('username');
}

(async function init() {
  const { data: { user } } = await sb.auth.getUser();
  if (user) currentUser = user;

  const targetUsername = getUsernameParam();
  if (!targetUsername && !currentUser) {
    window.location.href = 'auth.html';
    return;
  }

  let query = sb.from('user_profiles').select('*');
  if (targetUsername) {
    query = query.eq('username', targetUsername).single();
  } else {
    query = query.eq('user_id', currentUser.id).single();
  }

  const { data: profile, error } = await query;
  if (error || !profile) {
    await showCustomAlert('Not Found', 'Guild profile details not found.', true);
    window.location.href = 'quest-board.html';
    return;
  }

  profileUser = profile;
  renderProfileOverview();
  
  // Settings tab visibility validation
  if (currentUser && currentUser.id === profileUser.user_id) {
    document.getElementById('editProfileTabBtn').style.display = 'block';
    document.getElementById('editDisplayName').value = profileUser.display_name || '';
    document.getElementById('editAvatarUrl').value = profileUser.avatar_url || '';
    document.getElementById('editUpiId').value = profileUser.upi_id || '';
    document.getElementById('editUpiQrUrl').value = profileUser.upi_qr_url || '';
    
    if (profileUser.upi_qr_url) {
      const qrStatus = document.getElementById('upiQrStatus');
      qrStatus.textContent = '✅ Verified QR code is saved.';
      qrStatus.style.display = 'block';
    }

    const { data: balance } = await sb.rpc('get_coin_balance', { p_user_id: currentUser.id });
    document.getElementById('privateBalanceDisplay').textContent = balance || 0;
  } else {
    document.getElementById('privateBalanceDisplay').parentElement.style.display = 'none';
  }

  loadUserQuestsHistory();
})();

function renderProfileOverview() {
  const p = profileUser;
  document.getElementById('profileDisplayName').textContent = p.display_name || p.username;
  document.getElementById('profileUsername').textContent = '@' + p.username;

  const score = p.reputation_score ? (p.reputation_score / 10).toFixed(1) : '0.0';
  document.getElementById('profileRepScore').textContent = `${score} / 5.0`;

  if (p.avatar_url) {
    document.getElementById('profileAvatar').src = p.avatar_url;
  }

  if (p.is_suspended) {
    document.getElementById('suspensionNotice').style.display = 'block';
  }
}

window.switchProfileTab = function(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(tabId).classList.add('active');
};

window.handleQrFileUpload = async function(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const status = document.getElementById('upiQrStatus');
    const saveBtn = document.getElementById('saveProfileBtn');
    
    saveBtn.disabled = true;
    status.textContent = 'Uploading QR code...';
    status.style.display = 'block';

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qrs/${currentUser.id}-${Date.now()}.${fileExt}`;

      const { data, error } = await sb.storage
        .from('quest-images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicData } = sb.storage
        .from('quest-images')
        .getPublicUrl(fileName);

      document.getElementById('editUpiQrUrl').value = publicData.publicUrl;
      status.textContent = '✅ QR code uploaded. Save changes to complete.';
    } catch (err) {
      status.textContent = '❌ Upload failed. Choose another file.';
      console.error(err);
    } finally {
      saveBtn.disabled = false;
    }
  }
};

async function loadUserQuestsHistory() {
  const { data: posted, error: err1 } = await sb
    .from('quests')
    .select('*')
    .eq('poster_id', profileUser.user_id)
    .order('created_at', { ascending: false });

  const { data: completed, error: err2 } = await sb
    .from('quests')
    .select('*')
    .eq('worker_id', profileUser.user_id)
    .order('created_at', { ascending: false });

  if (err1 || err2) return;

  const pList = document.getElementById('postedQuestsList');
  if (posted.length === 0) {
    pList.innerHTML = '<div style="color: var(--text-dim); padding: 10px;">No historical posted records.</div>';
  } else {
    pList.innerHTML = posted.map(q => `
      <div class="quest-item">
        <a href="quest-detail.html?id=${q.id}">${escapeHtml(q.title)}</a>
        <span class="status-badge" style="font-size:0.8rem; text-transform:uppercase;">[${q.status}]</span>
      </div>
    `).join('');
  }

  const cList = document.getElementById('completedQuestsList');
  if (completed.length === 0) {
    cList.innerHTML = '<div style="color: var(--text-dim); padding: 10px;">No completed tasks on file.</div>';
  } else {
    cList.innerHTML = completed.map(q => `
      <div class="quest-item">
        <a href="quest-detail.html?id=${q.id}">${escapeHtml(q.title)}</a>
        <span class="status-badge" style="font-size:0.8rem; text-transform:uppercase;">[${q.status}]</span>
      </div>
    `).join('');
  }
}

window.saveProfileChanges = async function() {
  const dName = document.getElementById('editDisplayName').value.trim();
  const avatar = document.getElementById('editAvatarUrl').value.trim();
  const upiId = document.getElementById('editUpiId').value.trim();
  const upiQr = document.getElementById('editUpiQrUrl').value.trim();

  if (!dName) return;

  const { error } = await sb
    .from('user_profiles')
    .update({ 
      display_name: dName, 
      avatar_url: avatar,
      upi_id: upiId,
      upi_qr_url: upiQr
    })
    .eq('user_id', currentUser.id);

  if (error) {
    await showCustomAlert('Save Failed', 'Failed to update changes: ' + error.message, true);
    return;
  }

  await showCustomAlert('Save Successful', 'Your profile updates are securely saved!', true);
  window.location.reload();
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
