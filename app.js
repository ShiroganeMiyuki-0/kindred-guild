const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUILD_FEE_PERCENT = 10;
const ADMIN_EMAIL = 'yashwanthrangaswamy72@gmail.com';

let currentUser = null;
let quests = [];
let ratings = [];
let strikes = [];
let comments = [];
let fairyLedger = [];
let currentFilter = 'all';
let currentTab = 'all';

document.getElementById('btnSignUp').addEventListener('click', signUp);
document.getElementById('btnSignIn').addEventListener('click', signIn);
document.getElementById('btnSignOut').addEventListener('click', signOut);

function handleEnter(event) { if (event.key === 'Enter') signIn(); }
function handleCommentEnter(event, input) {
  if (event.key === 'Enter') {
    const card = input.closest('.quest-card');
    const questId = card?.dataset?.questId;
    if (questId && input.value.trim()) {
      sendComment(questId, input.value);
      input.value = '';
    }
  }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  updateUI();
  if (currentUser) loadQuests();
});

// ─── FIXED: Sign-up with better reliability ───
async function signUp() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!email || !password) {
    alert('Please enter both email and password');
    return;
  }
  if (password.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
        alert('This email is already registered. Try logging in instead.');
      } else if (error.message.toLowerCase().includes('rate limit')) {
        alert('Too many attempts. Please wait a minute and try again.');
      } else if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('valid email')) {
        alert('Please enter a valid email address (e.g. yourname@gmail.com).');
      } else {
        alert('Signup error: ' + error.message);
      }
      return;
    }

    // Check if we got a session (email confirmation is OFF)
    if (data.session) {
      currentUser = data.session.user;
      updateUI();
      loadQuests();
      alert('✅ Account created and logged in!');
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
      // User already exists
      alert('This email is already registered. Try logging in instead.');
    } else {
      // Email confirmation is ON — user must check their inbox
      alert('📧 Account created! Check your email inbox for a confirmation link, then come back and log in.');
    }
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function signIn() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { alert('Enter email and password'); return; }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('invalid')) {
        alert('Invalid email or password. Please check your credentials.');
      } else {
        alert('Login error: ' + error.message);
      }
      return;
    }
    // Session is handled by onAuthStateChange
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function signOut() {
  await supabaseClient.auth.signOut();
  quests = []; ratings = []; strikes = []; comments = []; fairyLedger = [];
  currentUser = null;
  updateUI();
  renderQuests();
}

function getRankInfo(count) {
  if (count >= 50) return { rank: 'S-Rank', color: '#ff6b35', bg: '#ff6b3522' };
  if (count >= 30) return { rank: 'A-Rank', color: '#ffd700', bg: '#ffd70022' };
  if (count >= 15) return { rank: 'B-Rank', color: '#6b8cff', bg: '#6b8cff22' };
  if (count >= 5)  return { rank: 'C-Rank', color: '#cd7f32', bg: '#cd7f3222' };
  return { rank: 'D-Rank', color: '#888', bg: '#88888822' };
}

function getUserRating(userId) {
  const userRatings = ratings.filter(r => r.to_user === userId);
  if (userRatings.length === 0) return null;
  return (userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length).toFixed(1);
}

function getUserStrikes(userId) {
  return strikes.filter(s => s.user_id === userId && !s.resolved).length;
}

function getFairyBalance(userId) {
  const userTransactions = fairyLedger.filter(t => t.from_user === userId || t.to_user === userId);
  return userTransactions.reduce((sum, t) => {
    if (t.to_user === userId) return sum + t.amount;
    if (t.from_user === userId) return sum - t.amount;
    return sum;
  }, 0);
}

function hasRated(questId, toUserId) {
  return ratings.some(r => r.quest_id === questId && r.from_user === currentUser?.id && r.to_user === toUserId);
}

function isBanned(userId) { return getUserStrikes(userId) >= 3; }

function isAdmin() {
  return currentUser?.email === ADMIN_EMAIL || currentUser?.email?.includes('yashwanth');
}

function updateUI() {
  const navAuth = document.getElementById('navAuth');
  const userBar = document.getElementById('userBar');
  const questBoard = document.getElementById('questBoard');
  const lockedMessage = document.getElementById('lockedMessage');
  const sidebar = document.getElementById('sidebar');

  if (currentUser) {
    navAuth.style.display = 'none';
    userBar.style.display = 'flex';
    questBoard.style.display = 'block';
    lockedMessage.style.display = 'none';
    sidebar.style.display = 'flex';
    document.getElementById('userEmail').textContent = currentUser.email;

    const completed = quests.filter(q => q.accepted_by === currentUser.id && q.status === 'completed').length;
    const info = getRankInfo(completed);
    const badge = document.getElementById('userRank');
    badge.textContent = info.rank;
    badge.style.background = info.bg;
    badge.style.color = info.color;

    const avg = getUserRating(currentUser.id);
    document.getElementById('userRating').textContent = avg ? `${avg} ⭐` : '';

    const fairyBalance = getFairyBalance(currentUser.id);
    const fairyBadge = document.getElementById('userFairy');
    fairyBadge.textContent = `🧚 ${fairyBalance}`;
    fairyBadge.style.display = 'inline';

    const strikeCount = getUserStrikes(currentUser.id);
    const strikeBadge = document.getElementById('userStrikes');
    if (strikeCount > 0) {
      strikeBadge.textContent = `${strikeCount} STRIKES`;
      strikeBadge.style.display = 'inline';
    } else {
      strikeBadge.style.display = 'none';
    }

    const adminToggle = document.getElementById('adminToggle');
    if (isAdmin()) {
      adminToggle.style.display = 'block';
      updateAdminPanel();
    } else {
      adminToggle.style.display = 'none';
      document.getElementById('adminPanel').style.display = 'none';
    }

    if (isBanned(currentUser.id)) {
      alert('🚫 You are banned! 3+ unpaid quests.');
      signOut();
    }
  } else {
    navAuth.style.display = 'flex';
    userBar.style.display = 'none';
    questBoard.style.display = 'none';
    lockedMessage.style.display = 'block';
    sidebar.style.display = 'none';
    document.getElementById('adminToggle').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
  }
}

function toggleAdmin() {
  const panel = document.getElementById('adminPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') updateAdminPanel();
}

document.getElementById('adminToggle').addEventListener('click', toggleAdmin);

function updateAdminPanel() {
  const totalRevenue = quests
    .filter(q => q.status === 'completed' && q.reward > 0)
    .reduce((sum, q) => sum + (q.reward * (GUILD_FEE_PERCENT / 100)), 0);

  const uniqueUsers = new Set();
  quests.forEach(q => { if (q.posted_by) uniqueUsers.add(q.posted_by); if (q.accepted_by) uniqueUsers.add(q.accepted_by); });

  const pendingPayments = quests.filter(q => q.status === 'completed' && q.reward > 0 && (!q.poster_paid || !q.acceptor_received)).length;

  const totalCoins = fairyLedger.reduce((sum, t) => {
    if (t.to_user && t.amount > 0) return sum + t.amount;
    return sum;
  }, 0);

  document.getElementById('adminRevenue').textContent = '₹ ' + Math.round(totalRevenue).toLocaleString('en-IN');
  document.getElementById('adminUsers').textContent = uniqueUsers.size;
  document.getElementById('adminTotalQuests').textContent = quests.length;
  document.getElementById('adminPending').textContent = pendingPayments;
  document.getElementById('adminCoins').textContent = totalCoins;
}

async function loadQuests() {
  try {
    const [{ data: questData, error: qErr }, { data: ratingData, error: rErr }, { data: strikeData, error: sErr }, { data: commentData, error: cErr }, { data: ledgerData, error: lErr }] = await Promise.all([
      supabaseClient.from('quests').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('ratings').select('*'),
      supabaseClient.from('strikes').select('*'),
      supabaseClient.from('comments').select('*').order('created_at', { ascending: true }),
      supabaseClient.from('fairy_ledger').select('*').order('created_at', { ascending: false })
    ]);

    if (qErr) console.error('Quests error:', qErr);
    if (rErr) console.error('Ratings error:', rErr);
    if (sErr) console.error('Strikes error:', sErr);
    if (cErr) console.error('Comments error:', cErr);
    if (lErr) console.error('Ledger error:', lErr);

    quests = questData || [];
    ratings = ratingData || [];
    strikes = strikeData || [];
    comments = commentData || [];
    fairyLedger = ledgerData || [];
    updateUI();
    renderQuests();
  } catch (err) {
    console.error('Error loading quests:', err);
  }
}

['quests', 'ratings', 'strikes', 'comments', 'fairy_ledger'].forEach(table => {
  supabaseClient.channel(`public:${table}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => loadQuests()).subscribe();
});

questForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { alert('Login first!'); return; }
  if (isBanned(currentUser.id)) { alert('🚫 Banned!'); return; }

  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const reward = Number(document.getElementById('reward').value) || 0;
  const fairyReward = Number(document.getElementById('fairyReward').value) || 0;
  const category = document.getElementById('category').value;
  const upiId = document.getElementById('upiId').value.trim();
  const deadlineVal = document.getElementById('deadline').value;
  const imageFile = document.getElementById('questImage').files[0];

  if (!title || !description) { alert('Fill in title and description'); return; }
  if (reward > 0 && !upiId) { alert('UPI ID required for paid quests'); return; }

  if (fairyReward > 0) {
    const balance = getFairyBalance(currentUser.id);
    if (balance - fairyReward < -100) {
      alert(`🚫 Not enough Fairy Coins! Your balance: ${balance}, Minimum allowed: -100`);
      return;
    }
  }

  let deadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;
  let imageUrl = '';

  // ─── FIXED: Image upload with better error handling ───
  if (imageFile) {
    try {
      const fileExt = imageFile.name.split('.').pop().toLowerCase();
      const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('quest-images')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('⚠️ Image upload failed: ' + uploadError.message + '\nThe quest will be posted without the image.');
      } else {
        const { data: urlData } = supabaseClient.storage
          .from('quest-images')
          .getPublicUrl(fileName);
        imageUrl = urlData?.publicUrl || '';
        console.log('Image uploaded successfully:', imageUrl);
      }
    } catch (uploadErr) {
      console.error('Image upload exception:', uploadErr);
      alert('⚠️ Image upload failed. The quest will be posted without the image.');
    }
  }

  try {
    const { error } = await supabaseClient.from('quests').insert({
      title, description, reward, fairy_coin_reward: fairyReward, fee_percent: GUILD_FEE_PERCENT,
      status: 'pending', category, posted_by: currentUser.id, poster_email: currentUser.email,
      poster_upi: upiId, deadline, image_url: imageUrl
    });

    if (error) {
      alert('Error posting quest: ' + error.message);
      return;
    }

    if (fairyReward > 0) {
      await supabaseClient.from('fairy_ledger').insert({
        from_user: currentUser.id,
        to_user: null,
        quest_id: null,
        amount: fairyReward,
        type: 'quest_post',
        description: `Posted quest: ${title}`
      });
    }

    questForm.reset();
    document.getElementById('reward').value = 0;
    document.getElementById('fairyReward').value = 0;
    document.getElementById('category').value = 'Misc';
    await loadQuests();
  } catch (err) {
    alert('Unexpected error posting quest: ' + err.message);
  }
});

async function acceptQuest(id) {
  if (!currentUser) return;
  if (isBanned(currentUser.id)) { alert('🚫 Banned!'); return; }
  try {
    const { error } = await supabaseClient.from('quests').update({
      status: 'accepted', accepted_by: currentUser.id, acceptor_email: currentUser.email
    }).eq('id', id);
    if (error) alert('Error: ' + error.message);
    else await loadQuests();
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function completeQuest(id) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === id);
  if (!quest) return;

  try {
    const { error } = await supabaseClient.from('quests').update({ status: 'completed' }).eq('id', id);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }

    if (quest.fairy_coin_reward > 0 && quest.accepted_by) {
      await supabaseClient.from('fairy_ledger').insert({
        from_user: quest.posted_by,
        to_user: quest.accepted_by,
        quest_id: quest.id,
        amount: quest.fairy_coin_reward,
        type: 'quest_complete',
        description: `Completed quest: ${quest.title}`
      });
    }

    await loadQuests();
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function cancelQuest(id) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === id);
  if (!quest || quest.accepted_by !== currentUser.id) return;
  if (!confirm('Cancel this quest?')) return;
  try {
    const { error } = await supabaseClient.from('quests').update({
      status: 'pending', accepted_by: null, acceptor_email: null
    }).eq('id', id);
    if (error) alert('Error: ' + error.message);
    else await loadQuests();
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function deleteQuest(id) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === id);
  if (!quest || quest.posted_by !== currentUser.id) return;
  if (!confirm('Delete forever?')) return;
  try {
    const { error } = await supabaseClient.from('quests').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else await loadQuests();
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function confirmPayment(questId, field) {
  if (!currentUser) return;
  if (!['poster_paid', 'acceptor_received'].includes(field)) return;
  const updateObj = {}; updateObj[field] = true;
  try {
    const { error } = await supabaseClient.from('quests').update(updateObj).eq('id', questId);
    if (error) alert('Error: ' + error.message);
    else await loadQuests();
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function submitRating(questId, toUser, toEmail, ratingValue) {
  if (!currentUser) return;
  try {
    const { error } = await supabaseClient.from('ratings').insert({
      quest_id: questId, from_user: currentUser.id, to_user: toUser,
      from_email: currentUser.email, to_email: toEmail, rating: ratingValue
    });
    if (error) alert('Error: ' + error.message);
    else await loadQuests();
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function addStrike(userId, userEmail, questId, reason) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === questId);
  if (!quest || currentUser.id !== quest.accepted_by || quest.posted_by !== userId) return;
  try {
    const { error } = await supabaseClient.from('strikes').insert({
      user_id: userId, user_email: userEmail, quest_id: questId, reason: reason
    });
    if (error) alert('Error: ' + error.message);
    else { alert('Strike added!'); await loadQuests(); }
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

async function sendComment(questId, message) {
  if (!currentUser || !message.trim()) return;
  try {
    const { error } = await supabaseClient.from('comments').insert({
      quest_id: questId, user_id: currentUser.id, user_email: currentUser.email, message: message.trim()
    });
    if (error) {
      alert('Error sending comment: ' + error.message);
    } else {
      await loadQuests();
    }
  } catch (err) {
    alert('Unexpected error: ' + err.message);
  }
}

function formatDeadline(deadlineStr) {
  if (!deadlineStr) return '';
  const d = new Date(deadlineStr);
  const now = new Date();
  const diff = d - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (diff < 0) return `<span class="deadline-overdue">⏰ OVERDUE by ${Math.abs(hours)}h</span>`;
  if (hours < 24) return `<span class="deadline-urgent">⏰ Due in ${hours}h</span>`;
  return `<span style="color:var(--success);">⏰ Due in ${Math.floor(hours/24)}d</span>`;
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-item').forEach(btn => {
    const text = btn.textContent.toLowerCase();
    btn.classList.toggle('active', (filter === 'all' && text.includes('all') && !text.includes('my')) || text.includes(filter.toLowerCase()));
  });
  renderQuests();
}

function setTab(tab) {
  currentTab = tab;
  renderQuests();
}

function createPaymentCheckbox(labelText, onChange) {
  const label = document.createElement('label');
  label.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin:0.25rem 0; cursor:pointer; color:var(--text-muted); font-size:0.9rem;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.addEventListener('change', onChange);
  label.append(checkbox, document.createTextNode(` ${labelText}`));
  return label;
}

function createPaymentStatus(text) {
  const status = document.createElement('div');
  status.style.cssText = 'color:var(--success); font-size:0.9rem;';
  status.textContent = text;
  return status;
}

// ─── FIXED: Complete renderQuests function with comments, images, and ratings ───
function renderQuests() {
  const list = document.getElementById('questList');
  if (!list) return;
  list.innerHTML = '';

  let display = quests;
  if (currentTab === 'posted') display = display.filter(q => q.posted_by === currentUser?.id);
  elfunction getUserRating(userId) {
  const userRatings = ratings.filter(r => r.to_user === userId);
  if (userRatings.length === 0) return null;
  return (userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length).toFixed(1);
}

function getUserStrikes(userId) {
  return strikes.filter(s => s.user_id === userId && !s.resolved).length;
}

function getFairyBalance(userId) {
  const userTransactions = fairyLedger.filter(t => t.from_user === userId || t.to_user === userId);
  return userTransactions.reduce((sum, t) => {
    if (t.to_user === userId) return sum + t.amount;
    if (t.from_user === userId) return sum - t.amount;
    return sum;
  }, 0);
}

function hasRated(questId, toUserId) {
  return ratings.some(r => r.quest_id === questId && r.from_user === currentUser?.id && r.to_user === toUserId);
}

function isBanned(userId) { return getUserStrikes(userId) >= 3; }

function isAdmin() {
  return currentUser?.email === ADMIN_EMAIL || currentUser?.email?.includes('yashwanth');
}

function updateUI() {
  const navAuth = document.getElementById('navAuth');
  const userBar = document.getElementById('userBar');
  const questBoard = document.getElementById('questBoard');
  const lockedMessage = document.getElementById('lockedMessage');
  const sidebar = document.getElementById('sidebar');

  if (currentUser) {
    navAuth.style.display = 'none';
    userBar.style.display = 'flex';
    questBoard.style.display = 'block';
    lockedMessage.style.display = 'none';
    sidebar.style.display = 'flex';
    document.getElementById('userEmail').textContent = currentUser.email;

    const completed = quests.filter(q => q.accepted_by === currentUser.id && q.status === 'completed').length;
    const info = getRankInfo(completed);
    const badge = document.getElementById('userRank');
    badge.textContent = info.rank;
    badge.style.background = info.bg;
    badge.style.color = info.color;

    const avg = getUserRating(currentUser.id);
    document.getElementById('userRating').textContent = avg ? `${avg} ⭐` : '';

    const fairyBalance = getFairyBalance(currentUser.id);
    const fairyBadge = document.getElementById('userFairy');
    fairyBadge.textContent = `🧚 ${fairyBalance}`;
    fairyBadge.style.display = 'inline';

    const strikeCount = getUserStrikes(currentUser.id);
    const strikeBadge = document.getElementById('userStrikes');
    if (strikeCount > 0) {
      strikeBadge.textContent = `${strikeCount} STRIKES`;
      strikeBadge.style.display = 'inline';
    } else {
      strikeBadge.style.display = 'none';
    }

    const adminToggle = document.getElementById('adminToggle');
    if (isAdmin()) {
      adminToggle.style.display = 'block';
      updateAdminPanel();
    } else {
      adminToggle.style.display = 'none';
      document.getElementById('adminPanel').style.display = 'none';
    }

    if (isBanned(currentUser.id)) {
      alert('🚫 You are banned! 3+ unpaid quests.');
      signOut();
    }
  } else {
    navAuth.style.display = 'flex';
    userBar.style.display = 'none';
    questBoard.style.display = 'none';
    lockedMessage.style.display = 'block';
    sidebar.style.display = 'none';
    document.getElementById('adminToggle').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
  }
}

function toggleAdmin() {
  const panel = document.getElementById('adminPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') updateAdminPanel();
}

document.getElementById('adminToggle').addEventListener('click', toggleAdmin);

function updateAdminPanel() {
  const totalRevenue = quests
    .filter(q => q.status === 'completed' && q.reward > 0)
    .reduce((sum, q) => sum + (q.reward * (GUILD_FEE_PERCENT / 100)), 0);

  const uniqueUsers = new Set();
  quests.forEach(q => { if (q.posted_by) uniqueUsers.add(q.posted_by); if (q.accepted_by) uniqueUsers.add(q.accepted_by); });

  const pendingPayments = quests.filter(q => q.status === 'completed' && q.reward > 0 && (!q.poster_paid || !q.acceptor_received)).length;

  const totalCoins = fairyLedger.reduce((sum, t) => {
    if (t.to_user && t.amount > 0) return sum + t.amount;
    return sum;
  }, 0);

  document.getElementById('adminRevenue').textContent = '₹ ' + Math.round(totalRevenue).toLocaleString('en-IN');
  document.getElementById('adminUsers').textContent = uniqueUsers.size;
  document.getElementById('adminTotalQuests').textContent = quests.length;
  document.getElementById('adminPending').textContent = pendingPayments;
  document.getElementById('adminCoins').textContent = totalCoins;
}

async function loadQuests() {
  const [{ data: questData }, { data: ratingData }, { data: strikeData }, { data: commentData }, { data: ledgerData }] = await Promise.all([
    supabaseClient.from('quests').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('ratings').select('*'),
    supabaseClient.from('strikes').select('*'),
    supabaseClient.from('comments').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('fairy_ledger').select('*').order('created_at', { ascending: false })
  ]);

  quests = questData || [];
  ratings = ratingData || [];
  strikes = strikeData || [];
  comments = commentData || [];
  fairyLedger = ledgerData || [];
  updateUI();
  renderQuests();
}

['quests', 'ratings', 'strikes', 'comments', 'fairy_ledger'].forEach(table => {
  supabaseClient.channel(`public:${table}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => loadQuests()).subscribe();
});

questForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { alert('Login first!'); return; }
  if (isBanned(currentUser.id)) { alert('🚫 Banned!'); return; }

  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const reward = Number(document.getElementById('reward').value) || 0;
  const fairyReward = Number(document.getElementById('fairyReward').value) || 0;
  const category = document.getElementById('category').value;
  const upiId = document.getElementById('upiId').value.trim();
  const deadlineVal = document.getElementById('deadline').value;
  const imageFile = document.getElementById('questImage').files[0];

  if (!title || !description) { alert('Fill in title and description'); return; }
  if (reward > 0 && !upiId) { alert('UPI ID required for paid quests'); return; }

  if (fairyReward > 0) {
    const balance = getFairyBalance(currentUser.id);
    if (balance - fairyReward < -100) {
      alert(`🚫 Not enough Fairy Coins! Your balance: ${balance}, Minimum allowed: -100`);
      return;
    }
  }

  let deadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;
  let imageUrl = '';

  // ─── FIX 2: Image upload — show error if upload fails instead of silently ignoring ───
  if (imageFile) {
    const fileName = `${currentUser.id}_${Date.now()}.${imageFile.name.split('.').pop()}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('quest-images')
      .upload(fileName, imageFile);

    if (uploadError) {
      alert('⚠️ Image upload failed: ' + uploadError.message + '\nThe quest will be posted without the image.');
    } else {
      const { data: urlData } = supabaseClient.storage
        .from('quest-images')
        .getPublicUrl(fileName);
      imageUrl = urlData?.publicUrl || '';
    }
  }

  const { error } = await supabaseClient.from('quests').insert({
    title, description, reward, fairy_coin_reward: fairyReward, fee_percent: GUILD_FEE_PERCENT,
    status: 'pending', category, posted_by: currentUser.id, poster_email: currentUser.email,
    poster_upi: upiId, deadline, image_url: imageUrl
  });

  if (error) {
    alert('Error: ' + error.message);
    return;
  }

  if (fairyReward > 0) {
    await supabaseClient.from('fairy_ledger').insert({
      from_user: currentUser.id,
      to_user: null,
      quest_id: null,
      amount: fairyReward,
      type: 'quest_post',
      description: `Posted quest: ${title}`
    });
  }

  questForm.reset();
  document.getElementById('reward').value = 0;
  document.getElementById('fairyReward').value = 0;
  document.getElementById('category').value = 'Misc';
  await loadQuests();
});

async function acceptQuest(id) {
  if (!currentUser) return;
  if (isBanned(currentUser.id)) { alert('🚫 Banned!'); return; }
  const { error } = await supabaseClient.from('quests').update({
    status: 'accepted', accepted_by: currentUser.id, acceptor_email: currentUser.email
  }).eq('id', id);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function completeQuest(id) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === id);
  if (!quest) return;

  const { error } = await supabaseClient.from('quests').update({ status: 'completed' }).eq('id', id);
  if (error) {
    alert('Error: ' + error.message);
    return;
  }

  if (quest.fairy_coin_reward > 0 && quest.accepted_by) {
    await supabaseClient.from('fairy_ledger').insert({
      from_user: quest.posted_by,
      to_user: quest.accepted_by,
      quest_id: quest.id,
      amount: quest.fairy_coin_reward,
      type: 'quest_complete',
      description: `Completed quest: ${quest.title}`
    });
  }

  await loadQuests();
}

async function cancelQuest(id) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === id);
  if (!quest || quest.accepted_by !== currentUser.id) return;
  if (!confirm('Cancel this quest?')) return;
  const { error } = await supabaseClient.from('quests').update({
    status: 'pending', accepted_by: null, acceptor_email: null
  }).eq('id', id);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function deleteQuest(id) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === id);
  if (!quest || quest.posted_by !== currentUser.id) return;
  if (!confirm('Delete forever?')) return;
  const { error } = await supabaseClient.from('quests').delete().eq('id', id);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function confirmPayment(questId, field) {
  if (!currentUser) return;
  if (!['poster_paid', 'acceptor_received'].includes(field)) return;
  const updateObj = {}; updateObj[field] = true;
  const { error } = await supabaseClient.from('quests').update(updateObj).eq('id', questId);
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function submitRating(questId, toUser, toEmail, ratingValue) {
  if (!currentUser) return;
  const { error } = await supabaseClient.from('ratings').insert({
    quest_id: questId, from_user: currentUser.id, to_user: toUser,
    from_email: currentUser.email, to_email: toEmail, rating: ratingValue
  });
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

async function addStrike(userId, userEmail, questId, reason) {
  if (!currentUser) return;
  const quest = quests.find(q => q.id === questId);
  if (!quest || currentUser.id !== quest.accepted_by || quest.posted_by !== userId) return;
  const { error } = await supabaseClient.from('strikes').insert({
    user_id: userId, user_email: userEmail, quest_id: questId, reason: reason
  });
  if (error) alert('Error: ' + error.message);
  else { alert('Strike added!'); await loadQuests(); }
}

async function sendComment(questId, message) {
  if (!currentUser || !message.trim()) return;
  const { error } = await supabaseClient.from('comments').insert({
    quest_id: questId, user_id: currentUser.id, user_email: currentUser.email, message: message.trim()
  });
  if (error) alert('Error: ' + error.message);
  else await loadQuests();
}

function formatDeadline(deadlineStr) {
  if (!deadlineStr) return '';
  const d = new Date(deadlineStr);
  const now = new Date();
  const diff = d - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (diff < 0) return `<span class="deadline-overdue">⏰ OVERDUE by ${Math.abs(hours)}h</span>`;
  if (hours < 24) return `<span class="deadline-urgent">⏰ Due in ${hours}h</span>`;
  return `<span style="color:var(--success);">⏰ Due in ${Math.floor(hours/24)}d</span>`;
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-item').forEach(btn => {
    const text = btn.textContent.toLowerCase();
    btn.classList.toggle('active', (filter === 'all' && text.includes('all') && !text.includes('my')) || text.includes(filter.toLowerCase()));
  });
  renderQuests();
}

function setTab(tab) {
  currentTab = tab;
  renderQuests();
}

function createPaymentCheckbox(labelText, onChange) {
  const label = document.createElement('label');
  label.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin:0.25rem 0; cursor:pointer; color:var(--text-muted); font-size:0.9rem;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.addEventListener('change', onChange);
  label.append(checkbox, document.createTextNode(` ${labelText}`));
  return label;
}

function createPaymentStatus(text) {
  const status = document.createElement('div');
  status.style.cssText = 'color:var(--success); font-size:0.9rem;';
  status.textContent = text;
  return status;
}

function renderQuests() {
  const list = document.getElementById('questList');
  list.innerHTML = '';

  let display = quests;
  if (currentTab === 'posted') display = display.filter(q => q.posted_by === currentUser?.id);
  else if (currentTab === 'accepted') display = display.filter(q => q.accepted_by === currentUser?.id);
  if (currentFilter !== 'all') display = display.filter(q => q.category === currentFilter);

  if (display.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:3rem;">No quests here.</p>';
    computeStats(display);
    return;
  }

  display.forEach(quest => {
    const node = document.getElementById('questTemplate').content.cloneNode(true);
    const card = node.querySelector('.quest-card');
    card.dataset.questId = quest.id;

    const img = card.querySelector('.quest-image');
    if (quest.image_url) { img.src = quest.image_url; img.classList.add('visible'); }

    const statusBadge = card.querySelector('.status-badge');
    statusBadge.className = `status-badge status-${quest.status}`;
    statusBadge.textContent = quest.status;

    card.querySelector('.cat-badge').textContent = quest.category || 'Misc';
    card.querySelector('.quest-title').textContent = quest.title;

    const deadlineEl = card.querySelector('.deadline-display');
    if (quest.deadline) deadlineEl.innerHTML = formatDeadline(quest.deadline);
    else deadlineEl.style.display = 'none';

    card.querySelector('.quest-desc').textContent = quest.description;

    const rewardTag = card.querySelector('.reward-tag');
    const fairyTag = card.querySelector('.fairy-tag');

    if (quest.reward > 0) {
      rewardTag.textContent = `₹ ${quest.reward} • ${GUILD_FEE_PERCENT}% fee`;
      rewardTag.classList.remove('free');
    } else {
      rewardTag.textContent = 'FREE QUEST';
      rewardTag.classList.add('free');
    }

    if (quest.fairy_coin_reward > 0) {
      fairyTag.textContent = `+🧚 ${quest.fairy_coin_reward}`;
      fairyTag.style.display = 'inline';
    }

    card.querySelector('.poster-email').textContent = quest.poster_email || 'Unknown';

    const acceptBtn = card.querySelector('.btn-accept');
    const completeBtn = card.querySelector('.btn-complete');
    const cancelBtn = card.querySelector('.btn-cancel');
    const deleteBtn = card.querySelector('.btn-delete');

    if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) acceptBtn.style.display = 'none';
    if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) completeBtn.style.display = 'none';
    if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) cancelBtn.style.display = 'none';
    if (quest.posted_by !== currentUser?.id || quest.st
