// ============================================
// KINDRED GUILD — PROFILE LOGIC
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let profileUser = null;

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
    alert('Guild profile details not found.');
    window.location.href = 'quest-board.html';
    return;
  }

  profileUser = profile;
  renderProfileOverview();
  
  // Settings view access mapping
  if (currentUser && currentUser.id === profileUser.user_id) {
    document.getElementById('editProfileTabBtn').style.display = 'block';
    document.getElementById('editDisplayName').value = profileUser.display_name || '';
    document.getElementById('editAvatarUrl').value = profileUser.avatar_url || '';
    
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

  if (!dName) return;

  const { error } = await sb
    .from('user_profiles')
    .update({ display_name: dName, avatar_url: avatar })
    .eq('user_id', currentUser.id);

  if (error) {
    alert('Failed to update: ' + error.message);
    return;
  }

  alert('Profile updated successfully!');
  window.location.reload();
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
