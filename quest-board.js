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

  const { data: balance } = await sb.rpc('get_coin_balance', { p_user_id: user.id });
  document.getElementById('coinBalance').textContent = balance || 0;

  loadQuests();
})();

async function loadQuests() {
  questGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><h2>Loading quests...</h2></div>';

  let query = sb
    .from('quests')
    .select(`
      id, title, description, payment_type, coin_amount, upi_amount,
      status, deadline, created_at, poster_id,
      poster:user_profiles!quests_poster_id_fkey(username, display_name, reputation_score)
    `)
    .eq('status', 'open');

  // Filter by type
  const typeFilter = filterType.value;
  if (typeFilter !== 'all') {
    query = query.eq('payment_type', typeFilter);
  }

  // Sort
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
    console.error('Load quests error:', error);
    questGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><h2>Error loading quests</h2><p>' + error.message + '</p></div>';
    return;
  }

  quests = data || [];
  console.log('Loaded quests:', quests.length, quests);

  // Client-side sort for "pay"
  if (sort === 'pay') {
    quests.sort((a, b) => {
      const aVal = a.payment_type === 'coins' ? a.coin_amount : a.upi_amount;
      const bVal = b.payment_type === 'coins' ? b.coin_amount : b.upi_amount;
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
  
  if (diffMs < 0) return 'Expired';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHrs / 24);
  
  if (diffMins < 60) return diffMins + ' min left';
  if (diffHrs < 24) return diffHrs + ' hrs left';
  if (diffDays === 1) return '1 day left';
  if (diffDays < 7) return diffDays + ' days left';
  if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks left';
  
  // Far future - show date only
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
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
        <span class="badge ${badgeClass}">${badgeText}</span>
        <h3>${escapeHtml(quest.title)}</h3>
        <div class="poster">by <span>${escapeHtml(posterName)}</span> ⭐ ${rep}/5</div>
        <div class="description">${escapeHtml(quest.description)}</div>
        <div class="meta">
          <span class="reward">${rewardText}</span>
          <span class="deadline">⏰ ${deadlineStr}</span>
        </div>
        <button class="accept-btn ${isOwn ? 'own' : ''}" 
                ${isOwn ? 'disabled' : 'onclick="openAcceptModal(\'' + quest.id + '\')"'}>
          ${isOwn ? 'Your Quest' : 'Accept Quest'}
        </button>
      </div>
    `;
  }).join('');
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

  closeModal();
  alert('Quest accepted! Redirecting to quest detail...');
  window.location.href = 'quest-detail.html?id=' + selectedQuestId;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'auth.html';
}
