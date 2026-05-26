const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUILD_FEE_PERCENT = 10; // YOU control this. Users cannot change it.

let currentUser = null;
let quests = [];
let ratings = [];
let strikes = [];
let comments = [];
let currentFilter = 'all';
let currentTab = 'all';

const loginForm = document.getElementById('loginForm');
const userInfo = document.getElementById('userInfo');
const questBoard = document.getElementById('questBoard');
const lockedMessage = document.getElementById('lockedMessage');
const questForm = document.getElementById('questForm');
const questList = document.getElementById('questList');
const questTemplate = document.getElementById('questTemplate');
const totalQuestsEl = document.getElementById('totalQuests');
const paidQuestsEl = document.getElementById('paidQuests');
const guildRevenueEl = document.getElementById('guildRevenue');

document.getElementById('btnSignUp').addEventListener('click', signUp);
document.getElementById('btnSignIn').addEventListener('click', signIn);
document.getElementById('btnSignOut').addEventListener('click', signOut);

supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  updateUI();
  if (currentUser) loadQuests();
});

async function signUp() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { alert('Enter email and password'); return; }
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) alert('Error: ' + error.message);
  else alert('Account created! Now click Login.');
}

async function signIn() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { alert('Enter email and password'); return; }
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert('Error: ' + error.message);
}

async function signOut() {
  await supabaseClient.auth.signOut();
  quests = [];
  ratings = [];
  strikes = [];
  comments = [];
  renderQuests();
}

function getRankInfo(count) {
  if (count >= 50) return { rank: 'S-Rank', color: '#ff7a18', bg: '#ff7a1822' };
  if (count >= 30) return { rank: 'A-Rank', color: '#ffd700', bg: '#ffd70022' };
  if (count >= 15) return { rank: 'B-Rank', color: '#86b0ff', bg: '#86b0ff22' };
  if (count >= 5)  return { rank: 'C-Rank', color: '#cd7f32', bg: '#cd7f3222' };
  return { rank: 'D-Rank', color: '#a0a0a0', bg: '#a0a0a022' };
}

function getUserRating(userId) {
  const userRatings = ratings.filter(r => r.to_user === userId);
  if (userRatings.length === 0) return null;
  return (userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length).toFixed(1);
}

function getUserStrikes(userId) {
  return strikes.filter(s => s.user_id === userId && !s.resolved).length;
}

function hasRated(questId, toUserId) {
  return ratings.some(r => r.quest_id === questId && r.from_user === currentUser?.id && r.to_user === toUserId);
}

function isBanned(userId) {
  return getUserStrikes(userId) >= 3;
}

function updateUI() {
  if (currentUser) {
    loginForm.style.display = 'none';
    userInfo.style.display = 'flex';
    questBoard.style.display = 'block';
    lockedMessage.style.display = 'none';
    document.getElementById('userEmail').textContent = currentUser.email;

    const completed = quests.filter(q => q.accepted_by === currentUser.id && q.status === 'completed').length;
    const info = getRankInfo(completed);
    const badge = document.getElementById('userRank');
    badge.textContent = info.rank;
    badge.style.background = info.bg;
    badge.style.color = info.color;
    badge.style.border = '1px solid ' + info.color;

    const avg = getUserRating(currentUser.id);
    document.getElementById('userRating').textContent = avg ? `(${avg}⭐)` : '';

    const strikeCount = getUserStrikes(currentUser.id);
    const strikeBadge = document.getElementById('userStrikes');
    if (strikeCount > 0) {
      strikeBadge.textContent = `⚠ ${strikeCount} Strikes`;
      strikeBadge.style.display = 'inline';
    } else {
      strikeBadge.style.display = 'none';
    }

    if (isBanned(currentUser.id)) {
      alert('🚫 You are banned! 3+ unpaid quests. Contact admin.');
      signOut();
    }
  } else {
    loginForm.style.display = 'flex';
    userInfo.style.display = 'none';
    questBoard.style.display = 'none';
    lockedMessage.style.display = 'block';
  }
}

async function loadQuests() {
  const { data: questData, error: questError } = await supabaseClient
    .from('quests')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: ratingData, error: ratingError } = await supabaseClient
    .from('ratings')
    .select('*');

  const { data: strikeData, error: strikeError } = await supabaseClient
    .from('strikes')
    .select('*');

  const { data: commentData, error: commentError } = await supabaseClient
    .from('comments')
    .select('*')
    .order('created_at', { ascending: true });

  if (questError) { console.error(questError); return; }
  if (ratingError) console.error(ratingError);
  if (strikeError) console.error(strikeError);
  if (commentError) console.error(commentError);

  quests = questData || [];
  ratings = ratingData || [];
  strikes = strikeData || [];
  comments = commentData || [];
  updateUI();
  renderQuests();
}

supabaseClient
  .channel('public:quests')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, () => {
    loadQuests();
  })
  .subscribe();

supabaseClient
  .channel('public:ratings')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, () => {
    loadQuests();
  })
  .subscribe();

supabaseClient
  .channel('public:strikes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'strikes' }, () => {
    loadQuests();
  })
  .subscribe();

supabaseClient
  .channel('public:comments')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
    loadQuests();
  })
  .subscribe();

questForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { alert('Login first!'); return; }
  
  if (isBanned(currentUser.id)) {
    alert('🚫 You are banned! Cannot post quests.');
    return;
  }

  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const reward = Number(document.getElementById('reward').value) || 0;
  const category = document.getElementById('category').value;
  const upiId = document.getElementById('upiId').value.trim();
  const deadlineVal = document.getElementById('deadline').value;
  
  if (!title || !description) { alert('Fill in title and description'); return; }
  if (reward > 0 && !upiId) { alert('UPI ID required for paid quests'); return; }

  let deadline = null;
  if (deadlineVal) {
    deadline = new Date(deadlineVal).toISOString();
  }

  const { error } = await supabaseClient.from('quests').insert({
    title, description, reward, fee_percent: GUILD_FEE_PERCENT, status: 'pending', category,
    posted_by: currentUser.id, poster_email: currentUser.email, poster_upi: upiId, deadline
  });
  
  if (error) alert('Error: ' + error.message);
  else {
    questForm.reset();
    document.getElementById('reward').value = 0;
    document.getElementById('category').value = 'Misc';
    await loadQuests();
  }
});

async function acceptQuest(id) {
  if (!currentUser) { alert('Login first!'); return; }
  if (isBanned(currentUser.id)) {
    alert('🚫 You are banned! Cannot accept quests.');
    return;
  }
  const { error } = await supabaseClient
    .from('quests')
    .update({ status: 'accepted', accepted_by: currentUser.id, acceptor_email: currentUser.email })
    .eq('id', id);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function completeQuest(id) {
  if (!currentUser) { alert('Login first!'); return; }
  const { error } = await supabaseClient
    .from('quests')
    .update({ status: 'completed' })
    .eq('id', id);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function cancelQuest(id) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === id);
  if (!quest || quest.accepted_by !== currentUser.id) return;
  if (!confirm('Cancel this quest? It will go back to pending.')) return;
  const { error } = await supabaseClient
    .from('quests')
    .update({ status: 'pending', accepted_by: null, acceptor_email: null })
    .eq('id', id);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function deleteQuest(id) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === id);
  if (!quest || quest.posted_by !== currentUser.id) return;
  if (!confirm('Delete this quest forever?')) return;
  const { error } = await supabaseClient.from('quests').delete().eq('id', id);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function confirmPayment(questId, field) {
  if (!currentUser) return;
  const updateObj = {};
  updateObj[field] = true;
  const { error } = await supabaseClient.from('quests').update(updateObj).eq('id', questId);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function submitRating(questId, toUser, toEmail, ratingValue) {
  if (!currentUser) return;
  const { error } = await supabaseClient.from('ratings').insert({
    quest_id: questId,
    from_user: currentUser.id,
    to_user: toUser,
    from_email: currentUser.email,
    to_email: toEmail,
    rating: ratingValue
  });
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function addStrike(userId, userEmail, questId, reason) {
  if (!currentUser) return;
  const { error } = await supabaseClient.from('strikes').insert({
    user_id: userId,
    user_email: userEmail,
    quest_id: questId,
    reason: reason
  });
  if (error) alert('Error: ' + error.message);
  else {
    alert('Strike added! User will be banned at 3 strikes.');
    await loadQuests();
  }
}

async function sendComment(questId, message) {
  if (!currentUser || !message.trim()) return;
  const { error } = await supabaseClient.from('comments').insert({
    quest_id: questId,
    user_id: currentUser.id,
    user_email: currentUser.email,
    message: message.trim()
  });
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

function createStarRating(questId, toUser, toEmail, container) {
  const label = document.createElement('div');
  label.textContent = 'Rate your partner:';
  label.style.cssText = 'font-size:.85rem; color:#ffe1cc; margin-bottom:.3rem;';
  container.appendChild(label);

  const row = document.createElement('div');
  row.className = 'rating-stars';
  [1, 2, 3, 4, 5].forEach(n => {
    const btn = document.createElement('button');
    btn.textContent = '⭐';
    btn.className = 'star-btn';
    btn.addEventListener('click', () => submitRating(questId, toUser, toEmail, n));
    row.appendChild(btn);
  });
  container.appendChild(row);
}

function createPaymentCheckbox(quest, labelText, field, container) {
  const label = document.createElement('label');
  label.style.cssText = 'display:flex; align-items:center; gap:.4rem; margin-top:.3rem; cursor:pointer; font-size:.85rem; color:#ddd6ef;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.addEventListener('change', () => confirmPayment(quest.id, field));
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(labelText));
  container.appendChild(label);
}

function formatDeadline(deadlineStr) {
  if (!deadlineStr) return '';
  const d = new Date(deadlineStr);
  const now = new Date();
  const diff = d - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (diff < 0) return `<span class="deadline-overdue">⏰ OVERDUE by ${Math.abs(hours)} hours</span>`;
  if (hours < 24) return `<span style="color:#ff7a18;">⏰ Due in ${hours} hours</span>`;
  return `<span style="color:#89f0b8;">⏰ Due in ${Math.floor(hours/24)} days</span>`;
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderQuests();
}

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderQuests();
}

function renderQuests() {
  questList.innerHTML = '';
  let displayQuests = quests;

  if (currentTab === 'posted') {
    displayQuests = displayQuests.filter(q => q.posted_by === currentUser?.id);
  } else if (currentTab === 'accepted') {
    displayQuests = displayQuests.filter(q => q.accepted_by === currentUser?.id);
  }

  if (currentFilter !== 'all') {
    displayQuests = displayQuests.filter(q => q.category === currentFilter);
  }

  if (displayQuests.length === 0) {
    questList.innerHTML = '<p style="color:#c3bdd4; text-align:center; padding:2rem;">No quests here.</p>';
    computeStats(displayQuests);
    return;
  }

  displayQuests.forEach(quest => {
    const node = questTemplate.content.firstElementChild.cloneNode(true);
    const badge =
