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
let lastAuthAction = 'signin';

document.getElementById('btnSignUp').addEventListener('click', () => { lastAuthAction = 'signup'; signUp(); });
document.getElementById('btnSignIn').addEventListener('click', () => { lastAuthAction = 'signin'; signIn(); });
document.getElementById('btnSignOut').addEventListener('click', signOut);

function handleEnter(event) {
  if (event.key === 'Enter') {
    if (lastAuthAction === 'signup') signUp();
    else signIn();
  }
}

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

// ─── Helpers ───
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setAuthLoading(isLoading, buttonId) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Please wait...' : (buttonId === 'btnSignUp' ? 'Sign Up' : 'Sign In');
  }
  const otherId = buttonId === 'btnSignUp' ? 'btnSignIn' : 'btnSignUp';
  const otherBtn = document.getElementById(otherId);
  if (otherBtn) otherBtn.disabled = isLoading;
}

// ─── FIXED: Sign-up with better reliability ───
async function signUp() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!email || !password) {
    alert('Please enter both email and password.');
    return;
  }
  if (!validateEmail(email)) {
    alert('Please enter a valid email address (e.g., yourname@gmail.com).');
    return;
  }
  if (password.length < 6) {
    alert('Password must be at least 6 characters long.');
    return;
  }
  if (password.length > 72) {
    alert('Password is too long. Please use 72 characters or less.');
    return;
  }

  setAuthLoading(true, 'btnSignUp');

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
        alert('This email is already registered. Try logging in instead.');
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        alert('Too many attempts. Please wait a minute and try again.');
      } else if (msg.includes('invalid') || msg.includes('valid email')) {
        alert('Please enter a valid email address.');
      } else if (msg.includes('password')) {
        alert('Password error: ' + error.message);
      } else {
        alert('Signup error: ' + error.message);
      }
      return;
    }

    if (data.session) {
      currentUser = data.session.user;
      updateUI();
      loadQuests();
      alert('✅ Account created! You got 100 free Fairy Coins. Welcome to the Guild!');
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
      alert('This email is already registered. Try logging in instead.');
    } else {
      alert('📧 Account created! Check your email inbox for a confirmation link, then come back and log in.');
    }
  } catch (err) {
    console.error('Signup exception:', err);
    alert('Unexpected error. Please check your internet connection and try again.');
  } finally {
    setAuthLoading(false, 'btnSignUp');
  }
}

// ─── FIXED: Sign-in with better reliability ───
async function signIn() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!email || !password) {
    alert('Enter email and password.');
    return;
  }
  if (!validateEmail(email)) {
    alert('Please enter a valid email address.');
    return;
  }

  setAuthLoading(true, 'btnSignIn');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('wrong')) {
        alert('Invalid email or password. Please check your credentials.');
      } else if (msg.includes('email not confirmed') || msg.includes('confirmed')) {
        alert('Please confirm your email first. Check your inbox for the confirmation link.');
      } else if (msg.includes('rate limit')) {
        alert('Too many attempts. Please wait a minute.');
      } else {
        alert('Login error: ' + error.message);
      }
      return;
    }
  } catch (err) {
    console.error('Login exception:', err);
    alert('Unexpected error. Please check your internet connection.');
  } finally {
    setAuthLoading(false, 'btnSignIn');
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
  if (count >= 5) return { rank: 'C-Rank', color: '#cd7f32', bg: '#cd7f3222' };
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
  return currentUser?.email === ADMIN_EMAIL;
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

  // FIXED: Minimum balance is 0, not -100
  if (fairyReward > 0) {
    const balance = getFairyBalance(currentUser.id);
    if (balance - fairyReward < 0) {
      alert(`🚫 Not enough Fairy Coins! Your balance: ${balance}. You need at least ${fairyReward} coins.`);
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

    // NOTE: Fairy Coin transfer is now handled by database trigger (more reliable)
    // The trigger fires automatically when status changes from 'accepted' to 'completed'

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

  if (diff < 0) return `⏰ OVERDUE by ${Math.abs(hours)}h`;
  if (hours < 24) return `⏰ Due in ${hours}h`;
  return `⏰ Due in ${Math.floor(hours/24)}d`;
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
  else if (currentTab === 'accepted') display = display.filter(q => q.accepted_by === currentUser?.id);
  if (currentFilter !== 'all') display = display.filter(q => q.category === currentFilter);

  if (display.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:var(--muted);">No quests here.</p>';
    computeStats(display);
    return;
  }

  display.forEach(quest => {
    const node = document.getElementById('questTemplate')?.content?.cloneNode(true);
    if (!node) return;

    const card = node.querySelector('.quest-card');
    if (!card) return;
    card.dataset.questId = quest.id;

    // ─── Image handling ───
    const img = card.querySelector('.quest-image');
    if (img && quest.image_url) {
      img.src = quest.image_url;
      img.classList.add('visible');
      img.onerror = () => {
        console.error('Failed to load image:', quest.image_url);
        img.classList.remove('visible');
        img.style.display = 'none';
      };
    }

    const statusBadge = card.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.className = `status-badge status-${quest.status}`;
      statusBadge.textContent = quest.status;
    }

    const catBadge = card.querySelector('.cat-badge');
    if (catBadge) catBadge.textContent = quest.category || 'Misc';

    const titleEl = card.querySelector('.quest-title');
    if (titleEl) titleEl.textContent = quest.title;

    const deadlineEl = card.querySelector('.deadline-display');
    if (deadlineEl) {
      if (quest.deadline) deadlineEl.innerHTML = formatDeadline(quest.deadline);
      else deadlineEl.style.display = 'none';
    }

    const descEl = card.querySelector('.quest-desc');
    if (descEl) descEl.textContent = quest.description;

    const rewardTag = card.querySelector('.reward-tag');
    const fairyTag = card.querySelector('.fairy-tag');

    if (rewardTag) {
      if (quest.reward > 0) {
        rewardTag.textContent = `₹ ${quest.reward} • ${GUILD_FEE_PERCENT}% fee`;
        rewardTag.classList.remove('free');
      } else {
        rewardTag.textContent = 'FREE QUEST';
        rewardTag.classList.add('free');
      }
    }

    if (fairyTag) {
      if (quest.fairy_coin_reward > 0) {
        fairyTag.textContent = `+🧚 ${quest.fairy_coin_reward}`;
        fairyTag.style.display = 'inline';
      }
    }

    const posterEl = card.querySelector('.poster-email');
    if (posterEl) posterEl.textContent = quest.poster_email || 'Unknown';

    // ─── Buttons ───
    const acceptBtn = card.querySelector('.btn-accept');
    const completeBtn = card.querySelector('.btn-complete');
    const cancelBtn = card.querySelector('.btn-cancel');
    const deleteBtn = card.querySelector('.btn-delete');

    if (acceptBtn) {
      if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) {
        acceptBtn.style.display = 'none';
      } else {
        acceptBtn.addEventListener('click', () => acceptQuest(quest.id));
      }
    }

    if (completeBtn) {
      if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) {
        completeBtn.style.display = 'none';
      } else {
        completeBtn.addEventListener('click', () => completeQuest(quest.id));
      }
    }

    if (cancelBtn) {
      if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) {
        cancelBtn.style.display = 'none';
      } else {
        cancelBtn.addEventListener('click', () => cancelQuest(quest.id));
      }
    }

    if (deleteBtn) {
      if (quest.posted_by !== currentUser?.id || quest.status === 'accepted') {
        deleteBtn.style.display = 'none';
      } else {
        deleteBtn.addEventListener('click', () => deleteQuest(quest.id));
      }
    }

    // ─── Payment section for paid quests ───
    const paymentSection = card.querySelector('.payment-section');
    if (paymentSection && quest.reward > 0) {
      const fee = Math.round(quest.reward * (GUILD_FEE_PERCENT / 100));
      const net = quest.reward - fee;

      const paymentInfo = document.createElement('div');
      paymentInfo.style.cssText = 'background:var(--accent-glow); border:1px solid var(--accent); border-radius:8px; padding:0.75rem; margin:0.5rem 0; font-size:0.85rem;';
      paymentInfo.innerHTML = `
        <strong>💰 Payment Info</strong><br>
        Total: ₹${quest.reward} | Guild Fee (${GUILD_FEE_PERCENT}%): ₹${fee} | Net: ₹${net}
        ${quest.poster_upi ? `<br>Poster UPI: ${quest.poster_upi}` : ''}
      `;
      paymentSection.appendChild(paymentInfo);

      // Show payment checkboxes for involved parties
      if (currentUser && (currentUser.id === quest.posted_by || currentUser.id === quest.accepted_by) && quest.status === 'completed') {
        if (!quest.poster_paid && currentUser.id === quest.posted_by) {
          paymentSection.appendChild(createPaymentCheckbox('I have paid ₹' + quest.reward + ' to the acceptor', () => confirmPayment(quest.id, 'poster_paid')));
        }
        if (quest.poster_paid) {
          paymentSection.appendChild(createPaymentStatus('✅ Poster has paid'));
        }
        if (!quest.acceptor_received && currentUser.id === quest.accepted_by) {
          paymentSection.appendChild(createPaymentCheckbox('I have received ₹' + net + ' (after guild fee)', () => confirmPayment(quest.id, 'acceptor_received')));
        }
        if (quest.acceptor_received) {
          paymentSection.appendChild(createPaymentStatus('✅ Acceptor has received payment'));
        }
      }
    }

    // ─── FIXED: Comments section ───
    const commentSection = card.querySelector('.comment-section');
    const commentList = card.querySelector('.comment-list');
    const sendCommentBtn = card.querySelector('.send-comment');
    const commentInput = card.querySelector('.comment-field');

    if (commentSection && commentList) {
      if (currentUser) {
        commentSection.style.display = 'block';
      }

      const questComments = comments.filter(c => c.quest_id === quest.id);

      if (questComments.length === 0) {
        commentList.innerHTML = '<p style="color:var(--muted); font-size:0.85rem;">No comments yet. Be the first to comment!</p>';
      } else {
        commentList.innerHTML = '';
        questComments.forEach(comment => {
          const commentEl = document.createElement('div');
          commentEl.style.cssText = 'padding:0.5rem; margin:0.25rem 0; background:var(--surface-hover); border-radius:8px; font-size:0.85rem;';
          const timeAgo = comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Just now';
          commentEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
              <strong style="font-size:0.8rem;">${comment.user_email || 'Anonymous'}</strong>
              <span style="font-size:0.75rem; color:var(--muted);">${timeAgo}</span>
            </div>
            <div>${escapeHtml(comment.message)}</div>
          `;
          commentList.appendChild(commentEl);
        });
      }

      if (sendCommentBtn && commentInput) {
        sendCommentBtn.addEventListener('click', () => {
          const msg = commentInput.value.trim();
          if (msg) {
            sendComment(quest.id, msg);
            commentInput.value = '';
          }
        });
      }
    }

    // ─── Rating section for completed quests ───
    if (quest.status === 'completed' && currentUser) {
      const extras = card.querySelector('.extras');
      if (extras) {
        const canRatePoster = currentUser.id === quest.accepted_by && quest.posted_by && !hasRated(quest.id, quest.posted_by);
        const canRateAcceptor = currentUser.id === quest.posted_by && quest.accepted_by && !hasRated(quest.id, quest.accepted_by);

        if (canRatePoster || canRateAcceptor) {
          const ratingDiv = document.createElement('div');
          ratingDiv.style.cssText = 'margin-top:0.75rem; padding:0.75rem; background:var(--surface-hover); border-radius:8px;';
          ratingDiv.innerHTML = '<strong>⭐ Rate this quest</strong><br>';

          if (canRatePoster) {
            const ratePosterRow = createRatingRow(quest.id, quest.posted_by, quest.poster_email, 'Rate Poster');
            ratingDiv.appendChild(ratePosterRow);
          }
          if (canRateAcceptor) {
            const rateAcceptorRow = createRatingRow(quest.id, quest.accepted_by, quest.acceptor_email, 'Rate Acceptor');
            ratingDiv.appendChild(rateAcceptorRow);
          }
          extras.appendChild(ratingDiv);
        }
      }
    }

    // ─── Strike button (for acceptor on completed quests) ───
    if (quest.status === 'completed' && currentUser && currentUser.id === quest.accepted_by && quest.posted_by) {
      const extras = card.querySelector('.extras');
      if (extras && !document.getElementById(`strike-${quest.id}`)) {
        const strikeDiv = document.createElement('div');
        strikeDiv.id = `strike-${quest.id}`;
        strikeDiv.style.cssText = 'margin-top:0.5rem;';
        const strikeBtn = document.createElement('button');
        strikeBtn.className = 'btn btn-ghost btn-sm';
        strikeBtn.textContent = '🚨 Report Issue (Strike)';
        strikeBtn.style.cssText = 'color:var(--danger); border-color:var(--danger); font-size:0.8rem;';
        strikeBtn.addEventListener('click', () => {
          const reason = prompt('Why are you giving a strike? (e.g., "Did not pay", "Rude behavior")');
          if (reason && reason.trim()) {
            addStrike(quest.posted_by, quest.poster_email, quest.id, reason.trim());
          }
        });
        strikeDiv.appendChild(strikeBtn);
        extras.appendChild(strikeDiv);
      }
    }

    list.appendChild(card);
  });

  computeStats(display);
}

function createRatingRow(questId, toUserId, toEmail, label) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin:0.25rem 0; flex-wrap:wrap;';
  row.innerHTML = `${label}:`;

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('button');
    star.textContent = '⭐';
    star.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; padding:0.1rem; opacity:0.5; transition:opacity 0.2s;';
    star.addEventListener('mouseenter', () => {
      Array.from(row.querySelectorAll('button')).forEach((s, idx) => {
        s.style.opacity = idx < i ? '1' : '0.5';
      });
    });
    star.addEventListener('mouseleave', () => {
      Array.from(row.querySelectorAll('button')).forEach(s => s.style.opacity = '0.5');
    });
    star.addEventListener('click', () => submitRating(questId, toUserId, toEmail, i));
    row.appendChild(star);
  }
  return row;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function computeStats(displayQuests) {
  const total = quests.length;
  const paid = quests.filter(q => q.reward > 0).length;
  const completed = quests.filter(q => q.status === 'completed').length;

  const totalEl = document.getElementById('totalQuests');
  const paidEl = document.getElementById('paidQuests');
  const completedEl = document.getElementById('completedQuests');

  if (totalEl) totalEl.textContent = total;
  if (paidEl) paidEl.textContent = paid;
  if (completedEl) completedEl.textContent = completed;
}
