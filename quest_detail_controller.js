// ============================================
// KINDRED GUILD — QUEST DETAIL CONTROLLER
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentQuest = null;
let currentRatingValue = 0;
let countdownInterval = null;

// Extractor helper
function getQuestId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function showAlert(text, type) {
  const box = document.getElementById('alertBox');
  box.textContent = text;
  box.className = 'message ' + (type || 'error');
}

function clearAlert() {
  document.getElementById('alertBox').className = 'message';
}

// Initializer
(async function init() {
  const questId = getQuestId();
  if (!questId) {
    window.location.href = 'quest-board.html';
    return;
  }

  // Get User details
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  // Retrieve user credentials
  const { data: userProfile } = await sb
    .from('user_profiles')
    .select('username, display_name')
    .eq('user_id', user.id)
    .single();

  const name = userProfile?.display_name || userProfile?.username || 'Guild Member';
  document.getElementById('userProfileBadge').textContent = `Member: ${name}`;

  // Read Quest specifics
  await refreshQuestData();
  
  // Connect listeners
  subscribeToQuestComments(questId);
  await loadQuestComments(questId);
})();

async function refreshQuestData() {
  const questId = getQuestId();
  
  const { data: quest, error } = await sb
    .from('quests')
    .select(`
      *,
      poster:user_profiles!quests_poster_id_fkey(user_id, username, display_name, reputation_score),
      worker:user_profiles!quests_worker_id_fkey(user_id, username, display_name, reputation_score)
    `)
    .eq('id', questId)
    .single();

  if (error || !quest) {
    console.error('Error fetching details:', error);
    showAlert('Quest detail information could not be retrieved.', 'error');
    return;
  }

  currentQuest = quest;
  renderQuestUI();
}

function renderQuestUI() {
  const q = currentQuest;
  const isPoster = q.poster_id === currentUser.id;
  const isWorker = q.worker_id === currentUser.id;

  // Render text contents
  document.getElementById('questTitle').textContent = q.title;
  document.getElementById('questDesc').textContent = q.description;

  // Badges styling
  const pb = document.getElementById('paymentTypeBadge');
  pb.className = 'badge badge-' + q.payment_type;
  pb.textContent = q.payment_type === 'coins' ? '🪙 Fairy Coins' : q.payment_type === 'upi' ? '₹ UPI Direct' : '🎁 Free';

  const sbBadge = document.getElementById('statusBadge');
  sbBadge.className = 'status-badge status-' + q.status;
  sbBadge.textContent = q.status;

  // Poster & Worker identities
  const pName = q.poster?.display_name || q.poster?.username || 'Unknown';
  const pRep = q.poster?.reputation_score ? (q.poster.reputation_score / 10).toFixed(1) : '0.0';
  document.getElementById('posterName').textContent = pName;
  document.getElementById('posterRep').textContent = `⭐ ${pRep}/5`;

  if (q.worker) {
    const wName = q.worker?.display_name || q.worker?.username;
    const wRep = q.worker?.reputation_score ? (q.worker.reputation_score / 10).toFixed(1) : '0.0';
    document.getElementById('workerName').textContent = wName;
    document.getElementById('workerRep').textContent = `⭐ ${wRep}/5`;
  } else {
    document.getElementById('workerName').textContent = 'No one yet';
    document.getElementById('workerRep').textContent = '';
  }

  // Reward parameters
  const rewardVal = document.getElementById('rewardVal');
  if (q.payment_type === 'coins') {
    rewardVal.textContent = q.coin_amount + ' FC';
  } else if (q.payment_type === 'upi') {
    rewardVal.textContent = '₹' + q.upi_amount;
  } else {
    document.getElementById('rewardContainer').style.display = 'none';
  }

  const deadlineDate = new Date(q.deadline);
  const formattedDate = deadlineDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = deadlineDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit'
  });
  document.getElementById('deadlineStr').innerHTML = `
    <span style="color: var(--text); font-weight: 600;">${formattedDate}</span>
    <span style="color: var(--text-dim); margin-left: 8px;">${formattedTime}</span>
  `;

  // Panels visibility controls
  document.getElementById('workerProofPanel').style.display = 'none';
  document.getElementById('posterAppraisalPanel').style.display = 'none';
  document.getElementById('disputePanel').style.display = 'none';
  document.getElementById('ratingPanel').style.display = 'none';

  if (countdownInterval) clearInterval(countdownInterval);

  // Status-specific panels toggle
  if (q.status === 'accepted' && isWorker) {
    document.getElementById('workerProofPanel').style.display = 'block';
  } else if (q.status === 'submitted') {
    if (isPoster) {
      document.getElementById('posterAppraisalPanel').style.display = 'block';
      renderProofFileViewer();
      startAppraisalCountdown();
    } else {
      // Worker or guest sees waiting info
      showAlert('Quest proof submitted. Poster has 48 hours to approve or dispute.', 'success');
    }
  } else if (q.status === 'disputed') {
    document.getElementById('disputePanel').style.display = 'block';
  } else if (q.status === 'approved' && q.payment_type !== 'free') {
    document.getElementById('ratingPanel').style.display = 'block';
    loadRatingWidgetDetails();
  }
}

// -----------------------------
// APPRAISAL COUNTDOWN (48 HOURS)
// -----------------------------
function startAppraisalCountdown() {
  const countdownEl = document.getElementById('countdownTimer');
  if (!currentQuest.appraisal_deadline) return;

  const target = new Date(currentQuest.appraisal_deadline).getTime();

  countdownInterval = setInterval(() => {
    const now = new Date().getTime();
    const distance = target - now;

    if (distance < 0) {
      clearInterval(countdownInterval);
      countdownEl.textContent = 'AUTO-APPROVING NOW...';
      refreshQuestData();
      return;
    }

    const hours = Math.floor(distance / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
  }, 1000);
}

// Render proof file or image correctly
function renderProofFileViewer() {
  const container = document.getElementById('proofViewerContainer');
  const url = currentQuest.proof_url;
  if (!url) {
    container.innerHTML = '<p style="color: var(--error)">No proof attachments found.</p>';
    return;
  }

  const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)/i);
  if (isImage) {
    container.innerHTML = `
      <div style="margin-bottom: 10px;">Submitted Asset:</div>
      <img src="${url}" alt="Worker Task Proof">
      <div><a href="${url}" target="_blank">🔗 View Full Resolution Asset</a></div>
    `;
  } else {
    container.innerHTML = `
      <div style="margin-bottom: 15px;">
        📄 Submitted File: <strong>Document File</strong>
      </div>
      <a href="${url}" target="_blank" class="btn btn-accent">🔗 Download & Open Proof File</a>
      <div style="height: 15px;"></div>
    `;
  }
}

// -----------------------------
// PROOF FILE UPLOAD FUNCTIONALITY
// -----------------------------
let selectedProofFile = null;

function handleFileSelected(input) {
  if (input.files && input.files[0]) {
    selectedProofFile = input.files[0];
    document.getElementById('selectedFileName').textContent = `Selected: ${selectedProofFile.name}`;
    document.getElementById('submitProofBtn').style.display = 'inline-block';
  }
}

async function uploadProofFile() {
  if (!selectedProofFile) return;

  const btn = document.getElementById('submitProofBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  try {
    const fileExt = selectedProofFile.name.split('.').pop();
    const fileName = `${currentQuest.id}-${Date.now()}.${fileExt}`;
    const filePath = `proofs/${fileName}`;

    // Upload asset to quest-images Supabase Storage Bucket
    const { data, error } = await sb.storage
      .from('quest-images')
      .upload(filePath, selectedProofFile);

    if (error) {
      console.error('Upload failed:', error);
      showAlert(`Upload failed: ${error.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Proof';
      return;
    }

    // Get Public URL
    const { data: publicData } = sb.storage
      .from('quest-images')
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // Trigger state change in Quest Database
    const appraisalDeadline = new Date();
    appraisalDeadline.setHours(appraisalDeadline.getHours() + 48);

    const { error: dbError } = await sb
      .from('quests')
      .update({
        proof_url: publicUrl,
        status: 'submitted',
        appraisal_deadline: appraisalDeadline.toISOString()
      })
      .eq('id', currentQuest.id);

    if (dbError) {
      console.error('Update database failed:', dbError);
      showAlert('Failed to update quest with proof record.', 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Proof';
      return;
    }

    showAlert('Proof submitted successfully!', 'success');
    setTimeout(() => refreshQuestData(), 1200);

  } catch (err) {
    console.error('Unexpected error:', err);
    showAlert('Something went wrong during submission.', 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Proof';
  }
}

// -----------------------------
// APPROVAL & DISPUTE HANDLERS
// -----------------------------
async function approveSubmittedQuest() {
  clearAlert();
  if (!confirm('Are you sure you want to approve this quest completion? Reward balances will be released immediately.')) return;

  try {
    const { data, error } = await sb.rpc('approve_quest', { p_quest_id: currentQuest.id });

    if (error) {
      console.error('Approve failed:', error);
      showAlert(`Approve failed: ${error.message}`, 'error');
      return;
    }

    showAlert('Quest approved! Coins released or transaction noted.', 'success');
    
    if (currentQuest.payment_type === 'upi') {
      alert(`Please pay the worker immediately ₹${currentQuest.upi_amount} via external UPI now!`);
    }

    setTimeout(() => refreshQuestData(), 1500);

  } catch (err) {
    console.error('Approve transaction error:', err);
  }
}

async function disputeQuest() {
  clearAlert();
  if (!confirm('Disputing holds payout and requests manual arbitration. Your 10% guild fee is active as safety protection. Proceed?')) return;

  try {
    const { error } = await sb
      .from('quests')
      .update({ status: 'disputed', appraisal_deadline: null })
      .eq('id', currentQuest.id);

    if (error) {
      showAlert(`Dispute failed: ${error.message}`, 'error');
      return;
    }

    showAlert('Dispute initiated. Admin investigators notified.', 'error');
    setTimeout(() => refreshQuestData(), 1200);
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------
// COMMENTS / COORDINATION CHANNEL
// -----------------------------
async function loadQuestComments(questId) {
  const { data, error } = await sb
    .from('quest_comments')
    .select(`
      *,
      sender:user_profiles!quest_comments_user_id_fkey(username, display_name)
    `)
    .eq('quest_id', questId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Load comments failed:', error);
    return;
  }

  renderComments(data);
}

function renderComments(comments) {
  const box = document.getElementById('commentsBox');
  if (comments.length === 0) {
    box.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">No messages sent yet. Use this board to coordinate safely.</div>';
    return;
  }

  box.innerHTML = comments.map(c => {
    const sender = c.sender?.display_name || c.sender?.username || 'Member';
    const timestamp = new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isSelf = c.user_id === currentUser.id;

    return `
      <div class="comment-card" style="${isSelf ? 'border-color: var(--accent);' : ''}">
        <div class="comment-meta">
          <strong>${sender} ${isSelf ? '(You)' : ''}</strong>
          <span>${timestamp}</span>
        </div>
        <div class="comment-content">${escapeHtml(c.content)}</div>
      </div>
    `;
  }).join('');
  
  box.scrollTop = box.scrollHeight;
}

async function postCommentText() {
  const input = document.getElementById('commentText');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  const { error } = await sb
    .from('quest_comments')
    .insert({
      quest_id: currentQuest.id,
      user_id: currentUser.id,
      content: text
    });

  if (error) {
    console.error('Insert comment failed:', error);
    showAlert('Failed to post message.', 'error');
  }
}

function subscribeToQuestComments(questId) {
  sb.channel(`comments-${questId}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'quest_comments', 
      filter: `quest_id=eq.${questId}` 
    }, () => {
      loadQuestComments(questId);
    })
    .subscribe();
}

// -----------------------------
// RATING SYSTEM (DOUBLE BLIND)
// -----------------------------
function setRatingValue(score) {
  currentRatingValue = score;
  const stars = document.querySelectorAll('.star');
  stars.forEach(s => {
    const sScore = parseInt(s.getAttribute('data-score'));
    if (sScore <= score) {
      s.classList.add('selected');
    } else {
      s.classList.remove('selected');
    }
  });
}

async function submitUserRating() {
  if (currentRatingValue === 0) {
    alert('Please select a star rating first.');
    return;
  }

  try {
    const { data, error } = await sb.rpc('submit_rating', {
      p_quest_id: currentQuest.id,
      p_score: currentRatingValue
    });

    if (error) {
      console.error(error);
      alert('Failed to register score: ' + error.message);
      return;
    }

    alert('Your review feedback has been logged!');
    loadRatingWidgetDetails();

  } catch (err) {
    console.error(err);
  }
}

async function loadRatingWidgetDetails() {
  const { data: ratings, error } = await sb
    .from('ratings')
    .select('*')
    .eq('quest_id', currentQuest.id);

  if (error) {
    console.error('Error loading ratings details:', error);
    return;
  }

  const myRating = ratings.find(r => r.rater_id === currentUser.id);
  const revealed = ratings.length > 0 && ratings.every(r => r.revealed);

  if (myRating) {
    document.getElementById('activeRatingForm').style.display = 'none';
    document.getElementById('waitingRatingMessage').style.display = 'block';
  }

  if (revealed) {
    document.getElementById('waitingRatingMessage').style.display = 'none';
    const container = document.getElementById('ratingResultDisplay');
    const scoreList = document.getElementById('ratingScoreList');
    container.style.display = 'block';

    let scoresHtml = '';
    ratings.forEach(r => {
      const isMine = r.rater_id === currentUser.id;
      scoresHtml += `<div>${isMine ? '🏆 You left rating' : '👥 Other participant rating'}: <strong>${r.score} / 5 Stars</strong></div>`;
    });

    scoreList.innerHTML = scoresHtml;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}