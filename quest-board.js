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
let bookmarkedIds = [];

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
    const actionsEl = document.querySelector('.page-header .actions');
    if (actionsEl) actionsEl.prepend(adminLink);
  }

  const { data: balance } = await window.sb.rpc('get_coin_balance', { p_user_id: user.id });
  document.getElementById('coinBalance').textContent = balance || 0;

  // Load bookmarked quest IDs
  const { data: bmData } = await window.sb.rpc('get_bookmarked_quest_ids');
  bookmarkedIds = (bmData || []).map(r => r.quest_id);

  loadQuests();
  renderPresetTags();
})();

function renderPresetTags() {
  const cloud = document.getElementById('tagCloud');
  const presets = ['#Coding', '#Design', '#Writing', '#Art', '#IRL', '#Tutoring', '#Music', '#Marketing', '#SkillShare', '#Goodwill', '#Showcase', '#Fundraiser'];
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
  // Restore "Highest Pay" option visibility
  const payOption = sortBy.querySelector('option[value="pay"]');
  if (payOption) payOption.style.display = '';
  renderPresetTags();
  loadQuests();
};

window.handleSearch = function () {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadQuests(), 300);
};

window.onFilterTypeChange = function () {
  const type = filterType.value;
  const payOption = sortBy.querySelector('option[value="pay"]');
  if (type === 'free') {
    // "Highest Pay" makes no sense for free tasks — hide it and reset if selected
    payOption.style.display = 'none';
    if (sortBy.value === 'pay') {
      sortBy.value = 'newest';
    }
  } else {
    payOption.style.display = '';
  }
  loadQuests();
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
      status, deadline, created_at, poster_id, worker_id, tags, min_rank,
      poster:user_profiles!quests_poster_id_fkey(username, display_name, reputation_score, is_verified, is_admin)
    `);

  if (currentView === 'open') {
    query = query.eq('status', 'open').eq('is_deleted', false);
  } else if (currentView === 'my_active') {
    query = query.in('status', ['pending_acceptance', 'accepted', 'submitted', 'disputed']);
  } else if (currentView === 'my_posted') {
    query = query.eq('poster_id', currentUser.id).eq('is_deleted', false);
  } else if (currentView === 'my_completed') {
    query = query.eq('status', 'approved');
  } else if (currentView === 'bookmarked') {
    if (bookmarkedIds.length === 0) { quests = []; renderQuests(); return; }
    query = query.in('id', bookmarkedIds);
  } else if (currentView === 'expired') {
    query = query.eq('status', 'expired').eq('is_deleted', false);
  }

  const typeFilter = filterType.value;
  if (typeFilter !== 'all') query = query.eq('payment_type', typeFilter);

  const sort = sortBy.value;
  if (sort === 'newest') query = query.order('created_at', { ascending: false });
  else if (sort === 'deadline') query = query.order('deadline', { ascending: true });
  // For 'pay' sort: let server return default order, we sort client-side after
  else if (sort === 'pay') query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    questGrid.innerHTML = `<div class="empty-state"><h2>Error loading board</h2><p>${error.message}</p></div>`;
    return;
  }

  quests = data || [];

  // Client-side pay sort: compute effective amount across all payment types
  if (sort === 'pay') {
    quests.sort((a, b) => {
      const aVal = a.payment_type === 'coins' ? (a.coin_amount || 0) : a.payment_type === 'upi' ? (a.upi_amount || 0) : 0;
      const bVal = b.payment_type === 'coins' ? (b.coin_amount || 0) : b.payment_type === 'upi' ? (b.upi_amount || 0) : 0;
      return bVal - aVal;
    });
  }

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
    const rewardText = quest.payment_type === 'coins' ? (quest.coin_amount || 0) + ' FC' : quest.payment_type === 'upi' ? '₹' + (quest.upi_amount || 0) : 'Free';
    const posterName = quest.poster?.display_name || quest.poster?.username || 'Unknown';
    const rep = quest.poster?.reputation_score ? (quest.poster.reputation_score / 10).toFixed(1) : '—';
    const posterVerified = quest.poster?.is_verified ? ' <span style="color:#10b981" title="Verified">✅</span>' : '';

    const tagsHtml = quest.tags?.length ? `<div class="card-tags">${quest.tags.map(t => `<span class="card-tag" onclick="event.stopPropagation();toggleTagFilter('${t}')">${t}</span>`).join('')}</div>` : '';

    const rankBadge = quest.min_rank ? `<span class="rank-requirement">🏆 Min Rank: <span class="rank-badge rank-${quest.min_rank}" style="width:20px;height:20px;font-size:0.65rem;">${quest.min_rank}</span></span>` : '';
    const posterBadge = quest.poster?.is_admin ? '<span style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;padding:2px 6px;border-radius:4px;font-weight:900;font-size:0.6rem;margin-left:4px;">👑 GM</span>' : '';

    // Trust badges
    let trustBadges = '';
    if (quest.payment_type === 'coins') trustBadges += '<span style="font-size:0.7rem;background:rgba(16,185,129,0.1);color:#10b981;padding:2px 8px;border-radius:10px;margin-right:4px">🛡️ Escrow</span>';
    if (quest.payment_type === 'upi') trustBadges += '<span style="font-size:0.7rem;background:rgba(249,115,22,0.1);color:#f97316;padding:2px 8px;border-radius:10px;margin-right:4px">🔒 Trust Deposit</span>';
    if (quest.status === 'open') trustBadges += '<span style="font-size:0.7rem;background:rgba(59,130,246,0.1);color:#3b82f6;padding:2px 8px;border-radius:10px;margin-right:4px">⏰ Auto-Approve</span>';
    const deadlineDate = new Date(quest.deadline);
    const hoursLeft = (deadlineDate - new Date()) / 3600000;
    if (hoursLeft > 0 && hoursLeft < 48 && quest.status === 'open') trustBadges += '<span style="font-size:0.7rem;background:rgba(239,68,68,0.1);color:#ef4444;padding:2px 8px;border-radius:10px">🔥 Urgent</span>';

    let actionBtn = '';
    if (quest.status === 'expired') {
      actionBtn = isOwn
        ? `<button class="action-btn" onclick="repostQuest('${quest.id}')" style="background:var(--accent);color:#000;font-weight:700;">🔄 Re-post This Quest</button>`
        : `<span class="action-btn" style="opacity:0.5;cursor:default">⏰ Expired</span>`;
    } else if (quest.status === 'open') {
      actionBtn = isOwn
        ? `<a href="quest-edit.html?id=${quest.id}" class="action-btn own">✏️ Edit / Cancel</a>`
        : `<button class="action-btn" onclick="acceptQuest('${quest.id}')">Accept This Task</button>`;
    } else if (quest.status === 'pending_acceptance' && isOwn) {
      actionBtn = `<div class="approve-reject-actions"><button class="btn-approve" onclick="approveWorker('${quest.id}', true)">✅ Approve</button><button class="btn-reject" onclick="approveWorker('${quest.id}', false)">❌ Reject</button></div>`;
    } else if (quest.status === 'pending_acceptance') {
      actionBtn = `<span class="action-btn" style="opacity:0.6;cursor:default">⏳ Awaiting Approval</span>`;
    } else if (quest.status === 'accepted' && quest.worker_id === currentUser?.id) {
      actionBtn = `<a href="quest-detail.html?id=${quest.id}" class="action-btn">View Details</a><button class="btn-drop" onclick="dropQuest('${quest.id}')" style="margin-top:6px;">🚪 Drop Quest</button>`;
    } else {
      actionBtn = `<a href="quest-detail.html?id=${quest.id}" class="action-btn">View Details (${quest.status})</a>`;
    }

    const isBookmarked = bookmarkedIds.includes(quest.id);

    return `
      <div class="quest-card">
        <div class="quest-body">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="status-badge status-${quest.status}">${quest.status}</span>
          <button class="bookmark-btn" onclick="event.stopPropagation();toggleBookmark('${quest.id}')" title="${isBookmarked ? 'Remove bookmark' : 'Bookmark this quest'}" style="float:right;background:none;border:none;cursor:pointer;font-size:1.2rem;${isBookmarked ? 'color:var(--accent)' : 'color:var(--text-dim)'}">${isBookmarked ? '🔖' : '📑'}</button>
          <h3>${escapeHtml(quest.title)}</h3>
          <div class="poster">by <a href="profile.html?username=${quest.poster?.username}">${escapeHtml(posterName)}</a>${posterBadge}${posterVerified} ⭐ ${rep}</div>
          <div class="description">${escapeHtml(quest.description)}</div>
          ${tagsHtml}
          ${trustBadges}
          ${rankBadge}
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

    // Use the new RPC that handles rank checking
    const { data: result, error } = await window.sb.rpc('worker_accept_quest', {
      p_quest_id: questId,
      p_worker_id: currentUser.id
    });

    if (error) {
      window.showToast('Failed: ' + error.message, 'error');
      return;
    }

    if (result && !result.success) {
      window.showToast(result.error || 'Could not accept quest', 'error');
      return;
    }

    // Notify poster
    if (quest.poster_id) window.sendNotification('quest_pending', quest.poster_id, questId);

    if (result?.status === 'pending_acceptance') {
      window.showToast('Application sent! The poster will review your request.', 'success');
    } else {
      window.location.href = 'quest-detail.html?id=' + questId;
    }
    loadQuests();
  };

  if (quest.payment_type === 'free') {
    showGuildModal('free-quest', doAccept, () => {});
  } else if (quest.payment_type === 'upi') {
    showGuildModal('upi-warning', doAccept, () => {});
  } else {
    if (confirm('Apply for this task? The poster will review your application.')) doAccept();
  }
};

window.approveWorker = async function (questId, approved) {
  const action = approved ? 'approve' : 'reject';
  if (!confirm(approved ? 'Approve this worker? They will begin working on your quest.' : 'Reject this worker? The quest will be open for others to accept.')) return;

  const { data: result, error } = await window.sb.rpc('poster_approve_worker', {
    p_quest_id: questId,
    p_poster_id: currentUser.id,
    p_approved: approved
  });

  if (error) { window.showToast('Failed: ' + error.message, 'error'); return; }
  if (result && !result.success) { window.showToast(result.error, 'error'); return; }

  window.showToast(approved ? 'Worker approved! They have been notified.' : 'Worker rejected. Quest is open again.', approved ? 'success' : 'info');
  loadQuests();
};

window.dropQuest = async function (questId) {
  if (!confirm('Drop this quest? It will be open for other workers to accept.')) return;

  const { data: result, error } = await window.sb.rpc('worker_drop_quest', {
    p_quest_id: questId,
    p_worker_id: currentUser.id
  });

  if (error) { window.showToast('Failed: ' + error.message, 'error'); return; }
  if (result && !result.success) { window.showToast(result.error, 'error'); return; }

  window.showToast('Quest dropped. It is now open for other workers.', 'info');
  loadQuests();
};

window.logout = async function () {
  await window.sb.auth.signOut();
  window.location.href = 'auth.html';
};

window.toggleBookmark = async function (questId) {
  const { data: added, error } = await window.sb.rpc('toggle_quest_bookmark', { p_quest_id: questId });
  if (error) { window.showToast('Failed: ' + error.message, 'error'); return; }
  if (added) {
    bookmarkedIds.push(questId);
  } else {
    bookmarkedIds = bookmarkedIds.filter(id => id !== questId);
  }
  if (currentView === 'bookmarked') {
    loadQuests();
  } else {
    renderQuests();
  }
};

window.repostQuest = async function (questId) {
  if (!confirm('Re-post this quest? A new 7-day deadline will be set and coins will be locked again.')) return;

  const { data: newId, error } = await window.sb.rpc('repost_expired_quest', { p_quest_id: questId });
  if (error) { window.showToast('Failed: ' + error.message, 'error'); return; }

  window.showToast('Quest re-posted! New deadline: 7 days from now.', 'success');
  loadQuests();
};
