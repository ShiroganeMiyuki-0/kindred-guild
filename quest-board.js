// ============================================
// KINDRED GUILD — QUEST BOARD (DEBUGGED)
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let quests = [];
let selectedQuestId = null;

const questGrid = document.getElementById('questGrid');
const filterType = document.getElementById('filterType');
const sortBy = document.getElementById('sortBy');
const acceptModal = document.getElementById('acceptModal');
const modalContent = document.getElementById('modalContent');

// Load user
(async function init() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;
  console.log('Current user ID:', user.id);

  const { data: profile } = await sb
    .from('user_profiles')
    .select('username, display_name')
    .eq('user_id', user.id)
    .single();

  const name = profile?.display_name || profile?.username || 'Guild Member';
  document.getElementById('userName').textContent = 'Welcome, ' + name;

  if (isYashAdmin(user)) {
    const adminLink = document.createElement('a');
    adminLink.href = 'admin_dashboard_ui.html';
    adminLink.className = 'btn btn-outline';
    adminLink.style.marginLeft = '12px';
    adminLink.textContent = 'Admin Console';
    document.querySelector('.header .actions').prepend(adminLink);
  }

  const { data: balance } = await sb.rpc('get_coin_balance', { p_user_id: user.id });
  document.getElementById('coinBalance').textContent = balance || 0;

  loadQuests();
})();

async function loadQuests() {
  questGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><h2>Loading quests...</h2></div>';

  const questSelect = `
    id, title, description, payment_type, coin_amount, upi_amount,
    status, deadline, created_at, poster_id, worker_id,
    poster:user_profiles!quests_poster_id_fkey(username, display_name, reputation_score),
    worker:user_profiles!quests_worker_id_fkey(username, display_name, reputation_score)
  `;
  const typeFilter = filterType.value;

  let openQuery = sb
    .from('quests')
    .select(questSelect)
    .eq('status', 'open');

  if (typeFilter !== 'all') {
    openQuery = openQuery.eq('payment_type', typeFilter);
  }

  let activeQuery = sb
    .from('quests')
    .select(questSelect)
    .in('status', ['accepted', 'submitted', 'disputed'])
    .or(`poster_id.eq.${currentUser.id},worker_id.eq.${currentUser.id}`);

  if (typeFilter !== 'all') {
    activeQuery = activeQuery.eq('payment_type', typeFilter);
  }

  const [{ data: openData, error: openError }, { data: activeData, error: activeError }] = await Promise.all([
    openQuery,
    activeQuery
  ]);

  const error = openError || activeError;
  if (error) {
    console.error('Load quests error:', error);
    questGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><h2>Error loading quests</h2><p>' + error.message + '</p></div>';
    return;
  }

  const byId = new Map();
  [...(activeData || []), ...(openData || [])].forEach(quest => byId.set(quest.id, quest));
  quests = Array.from(byId.values());
  console.log('Loaded quests:', quests.length, quests);

  // Client-side sort
  const sort = sortBy.value;
  if (sort === 'newest') {
    quests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (sort === 'deadline') {
    quests.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  } else if (sort === 'pay') {
    quests.sort((a, b) => {
      const aVal = a.payment_type === 'coins' ? a.coin_amount : a.payment_type === 'upi' ? a.upi_amount : 0;
      const bVal = b.payment_type === 'coins' ? b.coin_amount : b.payment_type === 'upi' ? b.upi_amount : 0;
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
    questGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h2>No open quests</h2>
        <p>Be the first to post one! Or check back later.</p>
        <a href="quest-post.html" class="btn" style="margin-top: 16px;">Post a Quest</a>
      </div>
    `;
    return;
  }

  questGrid.innerHTML = quests.map(quest => {
    const isOwn = quest.poster_id === currentUser?.id;
    const isWorker = quest.worker_id === currentUser?.id;
    const canAccept = quest.status === 'open' && !isOwn;
    const badgeClass = quest.payment_type === 'coins' ? 'badge-coins' :
                       quest.payment_type === 'upi' ? 'badge-upi' : 'badge-free';
    const badgeText = quest.payment_type === 'coins' ? '🪙 Fairy Coins' :
                      quest.payment_type === 'upi' ? '₹ UPI Direct' : '🎁 Free';
    const rewardText = quest.payment_type === 'coins' ? quest.coin_amount + ' FC' :
                       quest.payment_type === 'upi' ? '₹' + quest.upi_amount : 'Free';
    const posterName = quest.poster?.display_name || quest.poster?.username || 'Unknown';
    const rep = quest.poster?.reputation_score ? (quest.poster.reputation_score / 10).toFixed(1) : '0.0';
    const deadlineStr = formatDate(quest.deadline);

    return `
      <div class="quest-card">
        <div class="badge-row">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="badge badge-status-${quest.status}">${formatQuestStatus(quest.status)}</span>
        </div>
        <h3>${escapeHtml(quest.title)}</h3>
        <div class="poster">by <span>${escapeHtml(posterName)}</span> ⭐ ${rep}/5</div>
        <div class="description">${escapeHtml(quest.description)}</div>
        <div class="meta">
          <span class="reward">${rewardText}</span>
          <span class="deadline">${deadlineStr}</span>
        </div>
        <button class="accept-btn ${isOwn ? 'own' : ''}" 
                ${canAccept ? 'onclick="openAcceptModal(\'' + quest.id + '\')"' : 'onclick="openQuestDetail(\'' + quest.id + '\')"'}>
          ${getQuestActionLabel(quest, isOwn, isWorker)}
        </button>
      </div>
    `;
  }).join('');
}

function formatQuestStatus(status) {
  return status.replace(/_/g, ' ');
}

function getQuestActionLabel(quest, isOwn, isWorker) {
  if (quest.status === 'open') return isOwn ? 'Your Quest' : 'Accept Quest';
  if (isWorker) return quest.status === 'accepted' ? 'Continue Quest' : 'View Your Quest';
  if (isOwn) return 'View Posted Quest';
  return 'View Details';
}

function openQuestDetail(questId) {
  window.location.href = 'quest-detail.html?id=' + encodeURIComponent(questId);
}

function isYashAdmin(user) {
  return user?.email?.trim().toLowerCase() === 'yashwanthrangaswamy72@gmail.com';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openAcceptModal(questId) {
  const quest = quests.find(q => q.id === questId);
  if (!quest) return;

  selectedQuestId = questId;
  const isFree = quest.payment_type === 'free';

  if (isFree) {
    modalContent.innerHTML = `
      <h3>🎁 This is a free quest</h3>
      <p>No payment, no ratings, no reputation involved. You're doing this purely out of goodwill. The guild thanks you for it.</p>
      <div class="modal-buttons">
        <button class="cancel" onclick="closeModal()">Back</button>
        <button class="confirm" onclick="confirmAccept()">Accept anyway</button>
      </div>
    `;
  } else {
    modalContent.innerHTML = `
      <h3>Accept Quest</h3>
      <p>Once accepted, you'll be responsible for completing this quest by the deadline. The poster will review your work before payment is released.</p>
      <div class="modal-buttons">
        <button class="cancel" onclick="closeModal()">Cancel</button>
        <button class="confirm" onclick="confirmAccept()">Accept</button>
      </div>
    `;
  }

  acceptModal.classList.add('active');
}

function closeModal() {
  acceptModal.classList.remove('active');
  selectedQuestId = null;
}

async function confirmAccept() {
  if (!selectedQuestId) return;

  // CRITICAL FIX: Verify user has a profile before accepting
  const { data: profile, error: profileError } = await sb
    .from('user_profiles')
    .select('user_id')
    .eq('user_id', currentUser.id)
    .single();

  if (profileError || !profile) {
    alert('Profile setup required. Redirecting to complete your guild membership...');
    window.location.href = 'username-setup.html';
    return;
  }

  const { error } = await sb
    .from('quests')
    .update({
      worker_id: currentUser.id,
      status: 'accepted'
    })
    .eq('id', selectedQuestId)
    .eq('status', 'open');

  if (error) {
    console.error('Accept error:', error);
    alert('Failed to accept quest: ' + error.message);
    closeModal();
    return;
  }

  const acceptedQuestId = selectedQuestId;
  closeModal();
  alert('Quest accepted! Redirecting to quest detail...');
  window.location.href = 'quest-detail.html?id=' + encodeURIComponent(acceptedQuestId);
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'auth.html';
}
