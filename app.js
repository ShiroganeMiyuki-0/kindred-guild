const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUILD_FEE_PERCENT = 10;
const ADMIN_EMAIL = 'yashwanthrangaswamy72@gmail.com'; // Using your email as admin identifier

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
    if (questId) { sendComment(questId, input.value); input.value = ''; }
  }
}

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
  quests = []; ratings = []; strikes = []; comments = []; fairyLedger = [];
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
  // Check if current user email matches admin or if user ID matches
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

    // DEBUG: Always show admin button for now to test
    const adminToggle = document.getElementById('adminToggle');
    console.log('Is admin?', isAdmin(), 'Email:', currentUser?.email);
    
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

  // Check fairy coin balance if posting a fairy coin quest
  if (fairyReward > 0) {
    const balance = getFairyBalance(currentUser.id);
    if (balance - fairyReward < -100) {
      alert(`🚫 Not enough Fairy Coins! Your balance: ${balance}, Minimum allowed: -100`);
      return;
    }
  }

  let deadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;
  let imageUrl = '';

  if (imageFile) {
    const fileName = `${currentUser.id}_${Date.now()}.${imageFile.name.split('.').pop()}`;
    const { error: uploadError } = await supabaseClient.storage.from('quest-images').upload(fileName, imageFile);
    if (!uploadError) {
      const { data: urlData } = supabaseClient.storage.from('quest-images').getPublicUrl(fileName);
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

  // Deduct fairy coins if quest has fairy coin reward
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

  // Award fairy coins to acceptor
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
    if (quest.posted_by !== currentUser?.id || quest.status !== 'pending') deleteBtn.style.display = 'none';

    acceptBtn.addEventListener('click', () => acceptQuest(quest.id));
    completeBtn.addEventListener('click', () => completeQuest(quest.id));
    cancelBtn.addEventListener('click', () => cancelQuest(quest.id));
    deleteBtn.addEventListener('click', () => deleteQuest(quest.id));

    const extras = card.querySelector('.extras');
    const paymentSection = extras.querySelector('.payment-section');

    if (quest.status === 'completed') {
      const box = document.createElement('div');
      box.className = 'payment-box';

      if (quest.poster_paid && quest.acceptor_received) {
        box.innerHTML = '<div class="payment-settled">✅ Payment Settled</div>';
      } else {
        let html = '<div style="color:var(--accent); font-weight:600; margin-bottom:0.5rem;">Payment Confirmation</div>';
        
        if (currentUser?.id === quest.posted_by && !quest.poster_paid) {
          html += `<label style="display:flex; align-items:center; gap:0.5rem; margin:0.25rem 0; cursor:pointer; color:var(--text-muted); font-size:0.9rem;">
            <input type="checkbox" onchange="confirmPayment('${quest.id}', 'poster_paid')"> I have paid ₹${quest.reward}
          </label>`;
        } else if (quest.poster_paid) {
          html += '<div style="color:var(--success); font-size:0.9rem;">✅ Poster confirmed payment sent</div>';
        }

        if (currentUser?.id === quest.accepted_by && !quest.acceptor_received) {
          html += `<label style="display:flex; align-items:center; gap:0.5rem; margin:0.25rem 0; cursor:pointer; color:var(--text-muted); font-size:0.9rem;">
            <input type="checkbox" onchange="confirmPayment('${quest.id}', 'acceptor_received')"> I have received ₹${quest.reward}
          </label>`;
        } else if (quest.acceptor_received) {
          html += '<div style="color:var(--success); font-size:0.9rem;">✅ Acceptor confirmed payment received</div>';
        }

        if ((!quest.poster_paid || !quest.acceptor_received) && currentUser && (currentUser.id === quest.posted_by || currentUser.id === quest.accepted_by)) {
          html += '<div style="color:var(--warning); font-size:0.85rem; margin-top:0.5rem;">Waiting for both confirmations...</div>';
        }

        if (currentUser?.id === quest.accepted_by && !quest.poster_paid && quest.reward > 0) {
          html += `<button onclick="if(confirm('Report non-payment?')) addStrike('${quest.posted_by}', '${quest.poster_email}', '${quest.id}', 'Non-payment')" 
            style="background:var(--danger); color:#fff; border:none; border-radius:6px; padding:0.4rem 0.8rem; font-size:0.8rem; cursor:pointer; margin-top:0.5rem;">⚠️ Report Non-Payment</button>`;
        }

        box.innerHTML = html;

        if (quest.reward > 0 && quest.poster_upi && currentUser?.id === quest.accepted_by && !quest.poster_paid) {
          box.innerHTML += `
            <div class="upi-display">
              <div class="label">📱 Scan or Pay UPI</div>
              <div class="id">${quest.poster_upi}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">Google Pay · PhonePe · Paytm</div>
            </div>`;
        }
      }
      paymentSection.appendChild(box);

      // Show fairy coin reward notice
      if (quest.fairy_coin_reward > 0) {
        const fairyBox = document.createElement('div');
        fairyBox.className = 'payment-box';
        fairyBox.style.marginTop = '0.75rem';
        fairyBox.style.borderColor = 'var(--fairy)';
        fairyBox.innerHTML = `<div style="color:var(--fairy); font-size:0.9rem;">🧚 Fairy Coins Earned: +${quest.fairy_coin_reward}</div>`;
        paymentSection.appendChild(fairyBox);
      }

      const questRatings = ratings.filter(r => r.quest_id === quest.id);
      if (questRatings.length > 0) {
        const ratingBox = document.createElement('div');
        ratingBox.className = 'payment-box';
        ratingBox.style.marginTop = '0.75rem';
        let html = '<div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Ratings</div>';
        questRatings.forEach(r => {
          html += `<div style="font-size:0.9rem; color:var(--text); margin:0.25rem 0;">${r.from_email}: ${'⭐'.repeat(r.rating)}</div>`;
        });
        ratingBox.innerHTML = html;
        paymentSection.appendChild(ratingBox);
      }

      if (currentUser?.id === quest.posted_by && quest.accepted_by && !hasRated(quest.id, quest.accepted_by)) {
        const rateBox = document.createElement('div');
        rateBox.className = 'payment-box';
        rateBox.style.marginTop = '0.75rem';
        rateBox.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Rate your partner</div>';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:0.3rem;';
        [1,2,3,4,5].forEach(n => {
          const btn = document.createElement('button');
          btn.textContent = '⭐';
          btn.style.cssText = 'background:var(--surface-hover); border:1px solid var(--border); color:var(--warning); border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer;';
          btn.addEventListener('click', () => submitRating(quest.id, quest.accepted_by, quest.acceptor_email, n));
          row.appendChild(btn);
        });
        rateBox.appendChild(row);
        paymentSection.appendChild(rateBox);
      }

      if (currentUser?.id === quest.accepted_by && !hasRated(quest.id, quest.posted_by)) {
        const rateBox = document.createElement('div');
        rateBox.className = 'payment-box';
        rateBox.style.marginTop = '0.75rem';
        rateBox.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Rate your partner</div>';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:0.3rem;';
        [1,2,3,4,5].forEach(n => {
          const btn = document.createElement('button');
          btn.textContent = '⭐';
          btn.style.cssText = 'background:var(--surface-hover); border:1px solid var(--border); color:var(--warning); border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer;';
          btn.addEventListener('click', () => submitRating(quest.id, quest.posted_by, quest.poster_email, n));
          row.appendChild(btn);
        });
        rateBox.appendChild(row);
        paymentSection.appendChild(rateBox);
      }
    }

    const commentSection = extras.querySelector('.comment-section');
    if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) {
      commentSection.style.display = 'block';
      const commentList = commentSection.querySelector('.comment-list');
      const questComments = comments.filter(c => c.quest_id === quest.id);
      
      commentList.innerHTML = '';
      if (questComments.length === 0) {
        commentList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No comments yet</div>';
      } else {
        questComments.forEach(c => {
          const item = document.createElement('div');
          item.className = 'comment-item';
          item.innerHTML = `<strong style="color:var(--text);">${c.user_email}:</strong> ${c.message}`;
          commentList.appendChild(item);
        });
      }
    }

    list.appendChild(card);
  });

  computeStats(display);
}

function computeStats(displayList) {
  document.getElementById('totalQuests').textContent = displayList.length;
  document.getElementById('paidQuests').textContent = displayList.filter(q => q.reward > 0).length;
  document.getElementById('completedQuests').textContent = quests.filter(q => q.status === 'completed').length;
}

updateUI();
renderQuests();
