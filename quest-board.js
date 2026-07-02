// ============================================
// KINDRED GUILD — QUEST BOARD CONTROLLER
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let quests = [];
let currentView = 'open'; // 'open', 'my_active', 'my_posted', 'my_completed'

const questGrid = document.getElementById('questGrid');
const filterType = document.getElementById('filterType');
const sortBy = document.getElementById('sortBy');

// Initialization
(async function init() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  const { data: profile } = await sb
    .from('user_profiles')
    .select('username, display_name, is_admin')
    .eq('user_id', user.id)
    .single();

  const name = profile?.display_name || profile?.username || 'Guild Member';
  document.getElementById('userName').textContent = 'Welcome, ' + name + ' 👤';

  if (profile?.is_admin) {
    const adminLink = document.createElement('a');
    adminLink.href = 'admin_dashboard_ui.html';
    adminLink.className = 'btn btn-outline';
    adminLink.style.marginLeft = '12px';
    adminLink.textContent = '🛡️ Admin Panel';
    document.querySelector('.header .actions').prepend(adminLink);
  }

  const { data: balance } = await sb.rpc('get_coin_balance', { p_user_id: user.id });
  document.getElementById('coinBalance').textContent = balance || 0;

  loadQuests();
})();

// Switch Views
window.switchView = function(viewName) {
  currentView = viewName;
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.getElementById('view-' + viewName.replace('my_', '')).classList.add('active');
  loadQuests();
};

async function loadQuests() {
  questGrid.innerHTML = '<div class="empty-state"><h2>Loading quests...</h2></div>';

  let query = sb
    .from('quests')
    .select(`
      id, title, description, payment_type, coin_amount, upi_amount,
      status, deadline, created_at, poster_id, worker_id,
      poster:user_profiles!quests_poster_id_fkey(username, display_name, reputation_score)
    `);

  // View Filtering logic (handles disappearing issue)
  if (currentView === 'open') {
    query = query.eq('status', 'open');
  } else if (currentView === 'my_active') {
    query = query.in('status', ['accepted', 'submitted', 'disputed']);
  } else if (currentView === 'my_posted') {
    query = query.eq('poster_id', currentUser.id);
  } else if (currentView === 'my_completed') {
    query = query.eq('status', 'approved');
  }

  // Payment Type Filter
  const typeFilter = filterType.value;
  if (typeFilter !== 'all') {
    query = query.eq('payment_type', typeFilter);
  }

  // Database Sorting
  const sort = sortBy.value;
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'deadline') {
    query = query.order('deadline', { ascending: true });
  } else if (sort === 'pay') {
    query = query.order('coin_amount', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error('Fetch quests error:', error);
    questGrid.innerHTML = '<div class="empty-state"><h2>Error loading quests</h2><p>' + error.message + '</p></div>';
    return;
  }

  quests = data || [];

  // Post-query matching for Active & Completed user associations
  if (currentView === 'my_active' || currentView === 'my_completed') {
    quests = quests.filter(q => q.worker_id === currentUser.id || q.poster_id === currentUser.id);
  }

  // Client-side Sort compensation for UPI vs Coin payouts
  if (sort === 'pay') {
    quests.sort((a, b) => {
      const aVal = a.payment_type === 'coins' ? (a.coin_amount || 0) : (a.upi_amount || 0);
      const bVal = b.payment_type === 'coins' ? (b.coin_amount || 0) : (b.upi_amount || 0);
      return bVal - aVal;
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
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHrs / 24);
  
  let timeStr = '';
  if (diffMins < 60) timeStr = `${diffMins}m left`;
  else if (diffHrs < 24) timeStr = `${diffHrs}h left`;
  else if (diffDays === 1) timeStr = `1d left`;
  else if (diffDays < 7) timeStr = `${diffDays}d left`;
  else if (diffDays < 30) timeStr = `${Math.floor(diffDays / 7)}w left`;
  else timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit'
  });

  return `
    <div class="modern-date">
      <span class="date-main">${formattedDate}</span>
      <span class="date-sub">${formattedTime} • <span class="date-relative">${timeStr}</span></span>
    </div>
  `;
}

function renderQuests() {
  if (quests.length === 0) {
    let msg = "No open quests available.";
    if (currentView === 'my_active') msg = "You don't have any active quests right now. Accept some work to get started!";
    if (currentView === 'my_posted') msg = "You haven't posted any quests yet.";
    if (currentView === 'my_completed') msg = "No completed quests found.";

    questGrid.innerHTML = `
      <div class="empty-state">
        <h2>Nothing Here</h2>
        <p>${msg}</p>
        <a href="quest-post.html" class="btn" style="margin-top: 16px;">Post a Quest</a>
      </div>
    `;
    return;
  }

  questGrid.innerHTML = quests.map(quest => {
    const isOwn = quest.poster_id === currentUser?.id;
    const badgeClass = quest.payment_type === 'coins' ? 'badge-coins' :
                       quest.payment_type === 'upi' ? 'badge-upi' : 'badge-free';
    const badgeText = quest.payment_type === 'coins' ? '🪙 Fairy Coins' :
                      quest.payment_type === 'upi' ? '₹ UPI Direct' : '🎁 Free';
    const rewardText = quest.payment_type === 'coins' ? quest.coin_amount + ' FC' :
                       quest.payment_type === 'upi' ? '₹' + quest.upi_amount : 'Free';
    const posterName = quest.poster?.display_name || quest.poster?.username || 'Unknown';
    const rep = quest.poster?.reputation_score ? (quest.poster.reputation_score / 10).toFixed(1) : '0.0';
    const deadlineStr = formatDate(quest.deadline);

    // Conditional button logic based on status and view
    let actionButtonHtml = '';
    if (quest.status === 'open') {
      actionButtonHtml = `
        <button class="action-btn ${isOwn ? 'own' : ''}" 
                ${isOwn ? 'disabled' : 'onclick="openAcceptPrompt(\'' + quest.id + '\')"'}>
          ${isOwn ? 'Your Quest' : 'Accept Quest'}
        </button>
      `;
    } else {
      // Direct Link for accepted active items so they can complete or coordinate
      actionButtonHtml = `
        <a href="quest-detail.html?id=${quest.id}" class="action-btn">
          View Coordination Board (${quest.status})
        </a>
      `;
    }

    return `
      <div class="quest-card">
        <div class="quest-body">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="status-badge">${quest.status}</span>
          <h3>${escapeHtml(quest.title)}</h3>
          <div class="poster">by <a href="profile.html?username=${quest.poster?.username}">${escapeHtml(posterName)}</a> ⭐ ${rep}/5</div>
          <div class="description">${escapeHtml(quest.description)}</div>
        </div>
        <div class="card-footer">
          <div class="meta">
            <span class="reward">${rewardText}</span>
            <span class="deadline">${deadlineStr}</span>
          </div>
          ${actionButtonHtml}
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Accept Modals triggering using modals_controller.js
window.openAcceptPrompt = function(questId) {
  const quest = quests.find(q => q.id === questId);
  if (!quest) return;

  const handleConfirm = async () => {
    // Check membership
    const { data: profile, error: profileError } = await sb
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', currentUser.id)
      .single();

    if (profileError || !profile) {
      alert('Profile setup required. Redirecting to complete your membership...');
      window.location.href = 'username-setup.html';
      return;
    }

    const { error } = await sb
      .from('quests')
      .update({ worker_id: currentUser.id, status: 'accepted' })
      .eq('id', questId)
      .eq('status', 'open');

    if (error) {
      alert('Failed to accept quest: ' + error.message);
      return;
    }

    alert('Quest accepted! Opening active workspace...');
    window.location.href = 'quest-detail.html?id=' + encodeURIComponent(questId);
  };

  const handleCancel = () => {
    console.log('Acceptance cancelled.');
  };

  if (quest.payment_type === 'free') {
    showGuildModal('free-quest', handleConfirm, handleCancel);
  } else if (quest.payment_type === 'upi') {
    showGuildModal('upi-warning', handleConfirm, handleCancel);
  } else {
    // Standard validation
    if (confirm('Are you sure you want to accept this quest? Once taken, you should complete it by the designated deadline.')) {
      handleConfirm();
    }
  }
};

window.logout = async function() {
  await sb.auth.signOut();
  window.location.href = 'auth.html';
};
