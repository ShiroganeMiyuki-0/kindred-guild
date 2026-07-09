// ============================================
// KINDRED GUILD — QUEST BOARD CONTROLLER
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Uses shared window.sb from supabase-client.js
// ============================================

let currentUser = null;
let quests = [];
let currentView = 'open';
let activeTagFilter = null;
let searchTimeout = null;

const questGrid = document.getElementById('questGrid');
const filterType = document.getElementById('filterType');
const sortBy = document.getElementById('sortBy');
const searchInput = document.getElementById('searchInput');

(async function init() {
  const user = await window.requireAuth();
  if (!user) return;
  currentUser = user;

  const profile = await window.getUserProfile(user.id);
  const name = profile?.display_name || profile?.username || 'Guild Member';
  document.getElementById('userName').textContent = 'Welcome, ' + name;

  if (profile?.is_admin) {
    const adminLink = document.createElement('a');
    adminLink.href = 'admin_dashboard_ui.html';
    adminLink.className = 'btn btn-ghost btn-sm';
    adminLink.textContent = '🛡️ Admin';
    document.querySelector('.page-header .actions').prepend(adminLink);
  }

  const { data: balance } = await window.sb.rpc('get_coin_balance', { p_user_id: user.id });
  document.getElementById('coinBalance').textContent = balance || 0;

  loadQuests();
  renderPresetTags();
})();

function renderPresetTags() {
  const cloud = document.getElementById('tagCloud');
  const presets = ['#Showcase', '#Fundraiser', '#Art', '#Coding', '#SkillShare', '#Goodwill', '#Design'];
  cloud.innerHTML = presets.map(tag => `
    <span class="tag-badge ${activeTagFilter === tag ? 'active' : ''}" onclick="toggleTagFilter('${tag}')">${tag}</span>
  `).join('');
}

window.toggleTagFilter = function (tag) {
  activeTagFilter = activeTagFilter === tag ? null : tag;
  renderPresetTags();
  loadQuests();
};

window.resetFilters = function () {
  activeTagFilter = null;
  searchInput.value = '';
  filterType.value = 'all';
  sortBy.value = 'newest';
  renderPresetTags();
  loadQuests();
};

window.handleSearch = function () {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadQuests(), 300);
};

window.switchView = function (viewName) {
  currentView = viewName;
  document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
  const tabId = 'view-' + viewName.replace('my_', '');
  document.getElementById(tabId)?.classList.add('active');
  loadQuests();
};

async function loadQuests() {
  questGrid.innerHTML = '<div class="empty-state"><h2>Loading...</h2></div>';

  let query = window.sb
    .from('quests')
    .select(`
      id, title, description, payment_type, coin_amount, upi_amount,
      status, deadline, created_at, poster_id, worker_id, tags,
      poster:user_profiles!quests_poster_id_fkey(username, display_name, reputation_score)
    `);

  if (currentView === 'open') {
    query = query.eq('status', 'open').eq('is_deleted', false);
  } else if (currentView === 'my_active') {
    query = query.in('status', ['accepted', 'submitted', 'disputed']);
  } else if (currentView === 'my_posted') {
    query = query.eq('poster_id', currentUser.id).eq('is_deleted', false);
  } else if (currentView === 'my_completed') {
    query = query.eq('status', 'approved');
  }

  const typeFilter = filterType.value;
  if (typeFilter !== 'all') query = query.eq('payment_type', typeFilter);

  const sort = sortBy.value;
  if (sort === 'newest') query = query.order('created_at', { ascending: false });
  else if (sort === 'deadline') query = query.order('deadline', { ascending: true });
  else if (sort === 'pay') query = query.order('coin_amount', { ascending: false });

  const { data, error } = await query;

  if (error) {
    questGrid.innerHTML = `<div class="empty-state"><h2>Error loading board</h2><p>${error.message}</p></div>`;
    return;
  }

  quests = data || [];

  if (currentView === 'my_active' || currentView === 'my_completed') {
    quests = quests.filter(q => q.worker_id === currentUser.id || q.poster_id === currentUser.id);
  }

  const term = searchInput.value.toLowerCase().trim();
  if (term || activeTagFilter) {
    quests = quests.filter(q => {
      const matchSearch = !term ||
        q.title.toLowerCase().includes(term) ||
        q.description.toLowerCase().includes(term) ||
        (q.tags && q.tags.some(t => t.toLowerCase().includes(term)));
      const matchTag = !activeTagFilter ||
        (q.tags && q.tags.some(t => t.toLowerCase() === activeTagFilter.toLowerCase()));
      return matchSearch && matchTag;
    });
  }

  renderQuests();
}

function formatDate(dateStr) {
  if (!dateStr) return 'No deadline';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date - now;
  if (diffMs < 0) return '<span class="date-expired">Expired</span>';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHrs / 24);

  let timeStr = '';
  if (diffMins < 60) timeStr = `${diffMins}m left`;
  else if (diffHrs < 24) timeStr = `${diffHrs}h left`;
  else if (diffDays < 7) timeStr = `${diffDays}d left`;
  else timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `
    <div class="modern-date">
      <span class="date-main">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      <span class="date-sub">${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · <span class="date-relative">${timeStr}</span></span>
    </div>
  `;
}

function renderQuests() {
  if (quests.length === 0) {
    questGrid.innerHTML = `
      <div class="empty-state">
        <h2>No Tasks Found</h2>
        <p>Try different filters, or post a new task.</p>
        <a href="quest-post.html" class="btn btn-primary" style="margin-top:12px">Post a Task</a>
      </div>`;
    return;
  }

  questGrid.innerHTML = quests.map(quest => {
    const isOwn = quest.poster_id === currentUser?.id;
    const badgeClass = quest.payment_type === 'coins' ? 'badge-coins' : quest.payment_type === 'upi' ? 'badge-upi' : 'badge-free';
    const badgeText = quest.payment_type === 'coins' ? '🪙 Coins' : quest.payment_type === 'upi' ? '₹ UPI' : '🎁 Free';
    const rewardText = quest.payment_type === 'coins' ? quest.coin_amount + ' FC' : quest.payment_type === 'upi' ? '₹' + quest.upi_amount : 'Free';
    const posterName = quest.poster?.display_name || quest.poster?.username || 'Unknown';
    const rep = quest.poster?.reputation_score ? (quest.poster.reputation_score / 10).toFixed(1) : '—';

    const tagsHtml = quest.tags?.length ? `<div class="card-tags">${quest.tags.map(t => `<span class="card-tag" onclick="event.stopPropagation();toggleTagFilter('${t}')">${t}</span>`).join('')}</div>` : '';

    let actionBtn = '';
    if (quest.status === 'open') {
      actionBtn = isOwn
        ? `<a href="quest-edit.html?id=${quest.id}" class="action-btn own">✏️ Edit / Cancel</a>`
        : `<button class="action-btn" onclick="acceptQuest('${quest.id}')">Accept This Task</button>`;
    } else {
      actionBtn = `<a href="quest-detail.html?id=${quest.id}" class="action-btn">View Details (${quest.status})</a>`;
    }

    return `
      <div class="quest-card">
        <div class="quest-body">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="status-badge status-${quest.status}">${quest.status}</span>
          <h3>${escapeHtml(quest.title)}</h3>
          <div class="poster">by <a href="profile.html?username=${quest.poster?.username}">${escapeHtml(posterName)}</a> ⭐ ${rep}</div>
          <div class="description">${escapeHtml(quest.description)}</div>
          ${tagsHtml}
        </div>
        <div>
          <div class="meta">
            <span class="reward">${rewardText}</span>
            <span>${formatDate(quest.deadline)}</span>
          </div>
          ${actionBtn}
        </div>
      </div>`;
  }).join('');
}

window.acceptQuest = async function (questId) {
  const quest = quests.find(q => q.id === questId);
  if (!quest) return;

  const doAccept = async () => {
    const profile = await window.getUserProfile(currentUser.id);
    if (!profile) {
      window.location.href = 'username-setup.html';
      return;
    }

    const { error } = await window.sb
      .from('quests')
      .update({ worker_id: currentUser.id, status: 'accepted' })
      .eq('id', questId)
      .eq('status', 'open');

    if (error) {
      alert('Failed: ' + error.message);
      return;
    }
    // Notify poster that quest was accepted
    if (quest.poster_id) window.sendNotification('quest_accepted', quest.poster_id, questId);
    window.location.href = 'quest-detail.html?id=' + questId;
  };

  if (quest.payment_type === 'free') {
    showGuildModal('free-quest', doAccept, () => {});
  } else if (quest.payment_type === 'upi') {
    showGuildModal('upi-warning', doAccept, () => {});
  } else {
    if (confirm('Accept this task? The reward will be locked for you.')) doAccept();
  }
};

window.logout = async function () {
  await window.sb.auth.signOut();
  window.location.href = 'auth.html';
};
