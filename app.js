// ==========================================
// STEP 1: PASTE YOUR SUPABASE KEYS HERE
// ==========================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';  // <-- REPLACE THIS WITH YOUR URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';                  // <-- REPLACE THIS WITH YOUR LONG KEY


const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let quests = [];
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
  renderQuests();
}

function getRankInfo(count) {
  if (count >= 50) return { rank: 'S-Rank', color: '#ff7a18', bg: '#ff7a1822' };
  if (count >= 30) return { rank: 'A-Rank', color: '#ffd700', bg: '#ffd70022' };
  if (count >= 15) return { rank: 'B-Rank', color: '#86b0ff', bg: '#86b0ff22' };
  if (count >= 5)  return { rank: 'C-Rank', color: '#cd7f32', bg: '#cd7f3222' };
  return { rank: 'D-Rank', color: '#a0a0a0', bg: '#a0a0a022' };
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
  } else {
    loginForm.style.display = 'flex';
    userInfo.style.display = 'none';
    questBoard.style.display = 'none';
    lockedMessage.style.display = 'block';
  }
}

async function loadQuests() {
  const { data, error } = await supabaseClient
    .from('quests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  quests = data || [];
  updateUI();
  renderQuests();
}

supabaseClient
  .channel('public:quests')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, () => {
    loadQuests();
  })
  .subscribe();

questForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { alert('Login first!'); return; }
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const reward = Number(document.getElementById('reward').value) || 0;
  let fee = Number(document.getElementById('fee').value) || 0;
  const category = document.getElementById('category').value;
  if (!title || !description) { alert('Fill in title and description'); return; }
  if (reward === 0) fee = 0;
  const { error } = await supabaseClient.from('quests').insert({
    title, description, reward, fee_percent: fee, status: 'pending', category,
    posted_by: currentUser.id, poster_email: currentUser.email
  });
  if (error) alert('Error: ' + error.message);
  else {
    questForm.reset();
    document.getElementById('reward').value = 0;
    document.getElementById('fee').value = 10;
    document.getElementById('category').value = 'Misc';
  }
});

async function acceptQuest(id) {
  if (!currentUser) { alert('Login first!'); return; }
  const { error } = await supabaseClient
    .from('quests')
    .update({ status: 'accepted', accepted_by: currentUser.id, acceptor_email: currentUser.email })
    .eq('id', id);
  if (error) alert('Error: ' + error.message);
}

async function completeQuest(id) {
  if (!currentUser) { alert('Login first!'); return; }
  const { error } = await supabaseClient
    .from('quests')
    .update({ status: 'completed' })
    .eq('id', id);
  if (error) alert('Error: ' + error.message);
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
    const badge = node.querySelector('.badge');
    badge.className = 'badge ' + quest.status;
    badge.textContent = quest.status;

    node.querySelector('.cat-badge').textContent = quest.category || 'Misc';
    node.querySelector('.quest-title').textContent = quest.title;
    node.querySelector('.quest-description').textContent = quest.description;

    const feeLabel = quest.reward > 0 ? ` • Guild fee ${quest.fee_percent}%` : ' • Free mission';
    node.querySelector('.reward').textContent = formatMoney(quest.reward) + feeLabel;

    let peopleText = `Posted by: ${quest.poster_email || 'Unknown'}`;
    if (quest.acceptor_email) peopleText += ` | Accepted by: ${quest.acceptor_email}`;
    node.querySelector('.quest-people').textContent = peopleText;

    const acceptBtn = node.querySelector('.accept');
    const completeBtn = node.querySelector('.complete');

    if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) {
      acceptBtn.style.display = 'none';
    }
    if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) {
      completeBtn.style.display = 'none';
    }

    acceptBtn.addEventListener('click', () => acceptQuest(quest.id));
    completeBtn.addEventListener('click', () => completeQuest(quest.id));

    questList.appendChild(node);
  });

  computeStats(displayQuests);
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function computeStats(displayList) {
  const total = displayList.length;
  const paid = displayList.filter(q => q.reward > 0).length;
  const revenue = quests
    .filter(q => q.status === 'completed' && q.reward > 0)
    .reduce((sum, q) => sum + (q.reward * (q.fee_percent / 100)), 0);
  totalQuestsEl.textContent = total;
  paidQuestsEl.textContent = paid;
  guildRevenueEl.textContent = formatMoney(revenue);
}

updateUI();
renderQuests();
