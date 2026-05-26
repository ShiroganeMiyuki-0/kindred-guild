// ==========================================
// STEP 1: PASTE YOUR SUPABASE KEYS HERE
// ==========================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';  // <-- REPLACE THIS WITH YOUR URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';                  // <-- REPLACE THIS WITH YOUR LONG KEY

// ==========================================
// STEP 2: DO NOT TOUCH ANYTHING BELOW
// ==========================================
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let quests = [];

// Grab elements from the page
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

// Hook up buttons
document.getElementById('btnSignUp').addEventListener('click', signUp);
document.getElementById('btnSignIn').addEventListener('click', signIn);
document.getElementById('btnSignOut').addEventListener('click', signOut);

// Watch for login/logout
supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  updateUI();
  if (currentUser) loadQuests();
});

// Sign up
async function signUp() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { alert('Enter email and password'); return; }
  
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) alert('Error: ' + error.message);
  else alert('Account created! Now click Login.');
}

// Sign in
async function signIn() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { alert('Enter email and password'); return; }
  
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert('Error: ' + error.message);
}

// Sign out
async function signOut() {
  await supabaseClient.auth.signOut();
  quests = [];
  renderQuests();
}

// Show/hide stuff based on login
function updateUI() {
  if (currentUser) {
    loginForm.style.display = 'none';
    userInfo.style.display = 'flex';
    questBoard.style.display = 'block';
    lockedMessage.style.display = 'none';
    document.getElementById('userEmail').textContent = currentUser.email;
  } else {
    loginForm.style.display = 'flex';
    userInfo.style.display = 'none';
    questBoard.style.display = 'none';
    lockedMessage.style.display = 'block';
  }
}

// Load quests from the database
async function loadQuests() {
  const { data, error } = await supabaseClient
    .from('quests')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) { console.error(error); return; }
  quests = data || [];
  renderQuests();
}

// Real-time magic: if someone else posts/accepts/completes, your screen updates instantly
supabaseClient
  .channel('public:quests')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, () => {
    loadQuests();
  })
  .subscribe();

// Post a quest
questForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { alert('Login first!'); return; }
  
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const reward = Number(document.getElementById('reward').value) || 0;
  let fee = Number(document.getElementById('fee').value) || 0;
  
  if (!title || !description) { alert('Fill in title and description'); return; }
  if (reward === 0) fee = 0;
  
  const { error } = await supabaseClient.from('quests').insert({
    title, description, reward, fee_percent: fee, status: 'pending',
    posted_by: currentUser.id, poster_email: currentUser.email
  });
  
  if (error) alert('Error: ' + error.message);
  else {
    questForm.reset();
    document.getElementById('reward').value = 0;
    document.getElementById('fee').value = 10;
  }
});

// Accept quest
async function acceptQuest(id) {
  if (!currentUser) { alert('Login first!'); return; }
  const { error } = await supabaseClient
    .from('quests')
    .update({ status: 'accepted', accepted_by: currentUser.id, acceptor_email: currentUser.email })
    .eq('id', id);
  if (error) alert('Error: ' + error.message);
}

// Complete quest
async function completeQuest(id) {
  if (!currentUser) { alert('Login first!'); return; }
  const { error } = await supabaseClient
    .from('quests')
    .update({ status: 'completed' })
    .eq('id', id);
  if (error) alert('Error: ' + error.message);
}

// Draw quests on screen
function renderQuests() {
  questList.innerHTML = '';
  
  if (quests.length === 0) {
    questList.innerHTML = '<p style="color:#c3bdd4; text-align:center; padding:2rem;">No quests yet. Be the first to post one!</p>';
    computeStats();
    return;
  }
  
  quests.forEach(quest => {
    const node = questTemplate.content.firstElementChild.cloneNode(true);
    
    const badge = node.querySelector('.badge');
    badge.className = 'badge ' + quest.status;
    badge.textContent = quest.status;
    
    node.querySelector('.quest-title').textContent = quest.title;
    node.querySelector('.quest-description').textContent = quest.description;
    
    const feeLabel = quest.reward > 0 ? ` • Guild fee ${quest.fee_percent}%` : ' • Free mission';
    node.querySelector('.reward').textContent = formatMoney(quest.reward) + feeLabel;
    
    let peopleText = `Posted by: ${quest.poster_email || 'Unknown'}`;
    if (quest.acceptor_email) peopleText += ` | Accepted by: ${quest.acceptor_email}`;
    node.querySelector('.quest-people').textContent = peopleText;
    
    const acceptBtn = node.querySelector('.accept');
    const completeBtn = node.querySelector('.complete');
    
    // Hide Accept if not pending or if it's your own quest
    if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) {
      acceptBtn.style.display = 'none';
    }
    // Hide Complete if not accepted by YOU
    if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) {
      completeBtn.style.display = 'none';
    }
    
    acceptBtn.addEventListener('click', () => acceptQuest(quest.id));
    completeBtn.addEventListener('click', () => completeQuest(quest.id));
    
    questList.appendChild(node);
  });
  
  computeStats();
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function computeStats() {
  const total = quests.length;
  const paid = quests.filter(q => q.reward > 0).length;
  const revenue = quests
    .filter(q => q.status === 'completed' && q.reward > 0)
    .reduce((sum, q) => sum + (q.reward * (q.fee_percent / 100)), 0);
  
  totalQuestsEl.textContent = total;
  paidQuestsEl.textContent = paid;
  guildRevenueEl.textContent = formatMoney(revenue);
}

// Start
updateUI();
