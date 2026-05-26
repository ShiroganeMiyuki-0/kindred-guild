const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUILD_FEE_PERCENT = 10;
const ADMIN_EMAIL = 'yashwanthrangaswamy72@gmail.com'; // Change this to your actual admin email

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
const completedQuestsEl = document.getElementById('completedQuests');

document.getElementById('btnSignUp').addEventListener('click', signUp);
document.getElementById('btnSignIn').addEventListener('click', signIn);
document.getElementById('btnSignOut').addEventListener('click', signOut);

// Keyboard support for login
function handleEnter(event) {
  if (event.key === 'Enter') {
    signIn();
  }
}

// Keyboard support for comments
function handleCommentEnter(event, input) {
  if (event.key === 'Enter') {
    const questCard = input.closest('.quest');
    const questId = questCard?.dataset?.questId;
    if (questId) {
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

function isAdmin() {
  return currentUser?.email === ADMIN_EMAIL;
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

    // Show admin panel toggle only for admin
    const adminToggle = document.getElementById('adminToggle');
    if (isAdmin()) {
      adminToggle.style.display = 'block';
      updateAdminPanel();
    } else {
      adminToggle.style.display = 'none';
      document.getElementById('adminPanel').style.display = 'none';
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
  quests.forEach(q => {
    if (q.posted_by) uniqueUsers.add(q.posted_by);
    if (q.accepted_by) uniqueUsers.add(q.accepted_by);
  });

  const pendingPayments = quests.filter(q => 
    q.status === 'completed' && q.reward > 0 && (!q.poster_paid || !q.acceptor_received)
  ).length;

  document.getElementById('adminRevenue').textContent = '₹ ' + Math.round(totalRevenue).toLocaleString('en-IN');
  document.getElementById('adminUsers').textContent = uniqueUsers.size;
  document.getElementById('adminTotalQuests').textContent = quests.length;
  document.getElementById('adminPending').textContent = pendingPayments;
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
    node.dataset.questId = quest.id;
    
    const badge = node.querySelector('.badge');
    badge.className = 'badge ' + quest.status;
    badge.textContent = quest.status;

    node.querySelector('.cat-badge').textContent = quest.category || 'Misc';
    node.querySelector('.quest-title').textContent = quest.title;
    node.querySelector('.quest-description').textContent = quest.description;

    const deadlineEl = node.querySelector('.deadline-text');
    if (quest.deadline) {
      deadlineEl.innerHTML = formatDeadline(quest.deadline);
    } else {
      deadlineEl.style.display = 'none';
    }

    const feeLabel = quest.reward > 0 ? ` • Guild fee ${GUILD_FEE_PERCENT}%` : ' • Free mission';
    node.querySelector('.reward').textContent = '₹ ' + quest.reward + feeLabel;

    let peopleText = `Posted by: ${quest.poster_email || 'Unknown'}`;
    if (quest.acceptor_email) peopleText += ` | Accepted by: ${quest.acceptor_email}`;
    node.querySelector('.quest-people').textContent = peopleText;

    const acceptBtn = node.querySelector('.accept');
    const completeBtn = node.querySelector('.complete');
    const cancelBtn = node.querySelector('.cancel');
    const deleteBtn = node.querySelector('.delete');

    if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) {
      acceptBtn.style.display = 'none';
    }
    if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) {
      completeBtn.style.display = 'none';
    }
    if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) {
      cancelBtn.style.display = 'none';
    }
    if (quest.posted_by !== currentUser?.id || quest.status !== 'pending') {
      deleteBtn.style.display = 'none';
    }

    acceptBtn.addEventListener('click', () => acceptQuest(quest.id));
    completeBtn.addEventListener('click', () => completeQuest(quest.id));
    cancelBtn.addEventListener('click', () => cancelQuest(quest.id));
    deleteBtn.addEventListener('click', () => deleteQuest(quest.id));

    const extras = node.querySelector('.quest-extras');

    // PAYMENT, UPI, RATING UI FOR COMPLETED QUESTS
    if (quest.status === 'completed') {
      const paymentBox = document.createElement('div');
      paymentBox.className = 'payment-box';

      if (quest.poster_paid && quest.acceptor_received) {
        paymentBox.innerHTML = '<div style="color:#27c26f; font-weight:700;">✓ Payment Settled</div>';
      } else {
        const title = document.createElement('div');
        title.textContent = 'Payment Confirmation:';
        title.style.cssText = 'color:#ffd700; font-size:.85rem; font-weight:600; margin-bottom:.3rem;';
        paymentBox.appendChild(title);

        if (currentUser?.id === quest.posted_by && !quest.poster_paid) {
          createPaymentCheckbox(quest, 'I have paid the reward', 'poster_paid', paymentBox);
        } else if (quest.poster_paid) {
          const msg = document.createElement('div');
          msg.textContent = '✓ Poster confirmed payment sent';
          msg.style.cssText = 'font-size:.85rem; color:#89f0b8;';
          paymentBox.appendChild(msg);
        }

        if (currentUser?.id === quest.accepted_by && !quest.acceptor_received) {
          createPaymentCheckbox(quest, 'I have received the reward', 'acceptor_received', paymentBox);
        } else if (quest.acceptor_received) {
          const msg = document.createElement('div');
          msg.textContent = '✓ Acceptor confirmed payment received';
          msg.style.cssText = 'font-size:.85rem; color:#89f0b8;';
          paymentBox.appendChild(msg);
        }

        if ((!quest.poster_paid || !quest.acceptor_received) && currentUser && (currentUser.id === quest.posted_by || currentUser.id === quest.accepted_by)) {
          const warn = document.createElement('div');
          warn.textContent = 'Waiting for both confirmations...';
          warn.style.cssText = 'font-size:.8rem; color:#ff7a18; margin-top:.3rem;';
          paymentBox.appendChild(warn);
        }

        if (currentUser?.id === quest.accepted_by && quest.poster_paid === false) {
          const strikeBtn = document.createElement('button');
          strikeBtn.textContent = '⚠ Report Non-Payment';
          strikeBtn.style.cssText = 'background:#ff4757; color:#fff; border:none; border-radius:.3rem; padding:.3rem .6rem; font-size:.8rem; cursor:pointer; margin-top:.5rem;';
          strikeBtn.addEventListener('click', () => {
            if (confirm('Report poster for non-payment? This adds a strike to their account.')) {
              addStrike(quest.posted_by, quest.poster_email, quest.id, 'Non-payment after quest completion');
            }
          });
          paymentBox.appendChild(strikeBtn);
        }
      }

      if (quest.reward > 0 && quest.poster_upi && currentUser?.id === quest.accepted_by && !quest.poster_paid) {
        const upiBox = document.createElement('div');
        upiBox.className = 'upi-box';
        upiBox.innerHTML = `
          <div style="color:#89f0b8; font-size:.85rem; margin-bottom:.3rem;">📱 Pay via UPI</div>
          <div style="font-size:.9rem; color:#fff; margin-bottom:.3rem;">Scan or pay to: <span class="upi-id">${quest.poster_upi}</span></div>
          <div style="font-size:.8rem; color:#c3bdd4;">Open Google Pay, PhonePe, or Paytm and send ₹${quest.reward}</div>
        `;
        paymentBox.appendChild(upiBox);
      }

      extras.appendChild(paymentBox);

      const questRatings = ratings.filter(r => r.quest_id === quest.id);
      if (questRatings.length > 0) {
        const ratingBox = document.createElement('div');
        ratingBox.className = 'payment-box';
        const rt = document.createElement('div');
        rt.textContent = 'Ratings:';
        rt.style.cssText = 'font-size:.85rem; color:#c3bdd4; margin-bottom:.3rem;';
        ratingBox.appendChild(rt);

        questRatings.forEach(r => {
          const line = document.createElement('div');
          line.textContent = `${r.from_email}: ${'⭐'.repeat(r.rating)}`;
          line.style.cssText = 'font-size:.8rem; color:#d5c9f3; margin-bottom:.2rem;';
          ratingBox.appendChild(line);
        });
        extras.appendChild(ratingBox);
      }

      if (currentUser?.id === quest.posted_by && quest.accepted_by && !hasRated(quest.id, quest.accepted_by)) {
        const rateBox = document.createElement('div');
        rateBox.className = 'payment-box';
        createStarRating(quest.id, quest.accepted_by, quest.acceptor_email, rateBox);
        extras.appendChild(rateBox);
      }

      if (currentUser?.id === quest.accepted_by && !hasRated(quest.id, quest.posted_by)) {
        const rateBox = document.createElement('div');
        rateBox.className = 'payment-box';
        createStarRating(quest.id, quest.posted_by, quest.poster_email, rateBox);
        extras.appendChild(rateBox);
      }
    }

    const commentBox = node.querySelector('.comment-box');
    if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) {
      commentBox.style.display = 'block';
      const commentList = commentBox.querySelector('.comment-list');
      const questComments = comments.filter(c => c.quest_id === quest.id);
      
      if (questComments.length === 0) {
        commentList.innerHTML = '<div style="font-size:.8rem; color:#666;">No comments yet</div>';
      } else {
        commentList.innerHTML = '';
        questComments.forEach(c => {
          const item = document.createElement('div');
          item.className = 'comment-item';
          item.textContent = `${c.user_email}: ${c.message}`;
          commentList.appendChild(item);
        });
      }

      const sendBtn = commentBox.querySelector('.send-comment');
      const commentField = commentBox.querySelector('.comment-field');
      
      const newSendBtn = sendBtn.cloneNode(true);
      sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
      
      newSendBtn.addEventListener('click', () => {
        sendComment(quest.id, commentField.value);
        commentField.value = '';
      });
    }

    questList.appendChild(node);
  });

  computeStats(displayQuests);
}

function computeStats(displayList) {
  const total = displayList.length;
  const paid = displayList.filter(q => q.reward > 0).length;
  const completed = quests.filter(q => q.status === 'completed').length;
  
  totalQuestsEl.textContent = total;
  paidQuestsEl.textContent = paid;
  completedQuestsEl.textContent = completed;
}

updateUI();
renderQuests();
