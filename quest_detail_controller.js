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

// Route param validation to prevent Supabase 400 UUID conversion failures
function getQuestId() {
  const params = new URLSearchParams(window.location.search);
  const rawId = params.get('id');

  if (!rawId || rawId === 'null' || rawId === 'undefined') return null;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(rawId) ? rawId : null;
}

function showAlert(text, type) {
  const box = document.getElementById('alertBox');
  box.textContent = text;
  box.className = 'message ' + (type || 'error');
}

function clearAlert() {
  document.getElementById('alertBox').className = 'message';
}

// Start
(async function init() {
  const questId = getQuestId();
  if (!questId) {
    showAlert('Invalid link. Returning to quest board...', 'error');
    setTimeout(() => {
      window.location.href = 'quest-board.html';
    }, 1200);
    return;
  }

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  const { data: userProfile } = await sb
    .from('user_profiles')
    .select('username, display_name')
    .eq('user_id', user.id)
    .single();

  const name = userProfile?.display_name || userProfile?.username || 'Guild Member';
  document.getElementById('userProfileBadge').textContent = `Member: ${name}`;

  await refreshQuestData();
  
  // Real-time channel integration
  subscribeToQuestComments(questId);
  await loadQuestComments(questId);
})();

async function refreshQuestData() {
  const questId = getQuestId();
  if (!questId) return;
  
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

  document.getElementById('questTitle').textContent = q.title;
  document.getElementById('questDesc').textContent = q.description;

  const pb = document.getElementById('paymentTypeBadge');
  pb.className = 'badge badge-' + q.payment_type;
  pb.textContent = q.payment_type === 'coins' ? '🪙 Fairy Coins' : q.payment_type === 'upi' ? '₹ UPI Direct' : '🎁 Free';

  const sbBadge = document.getElementById('statusBadge');
  sbBadge.className = 'status-badge status-' + q.status;
  sbBadge.textContent = q.status;

  const pName = q.poster?.display_name || q.poster?.username || 'Unknown';
  const pRep = q.poster?.reputation_score ? (q.poster.reputation_score / 10).toFixed(1) : '0.0';
  document.getElementById('posterName').innerHTML = `<a href="profile.html?username=${q.poster?.username}">${escapeHtml(pName)}</a>`;
  document.getElementById('posterRep').textContent = `⭐ ${pRep}/5`;

  if (q.worker) {
    const wName = q.worker?.display_name || q.worker?.username;
    const wRep = q.worker?.reputation_score ? (q.worker.reputation_score / 10).toFixed(1) : '0.0';
    document.getElementById('workerName').innerHTML = `<a href="profile.html?username=${q.worker?.username}">${escapeHtml(wName)}</a>`;
    document.getElementById('workerRep').textContent = `⭐ ${wRep}/5`;
  } else {
    document.getElementById('workerName').textContent = 'No one yet';
    document.getElementById('workerRep').textContent = '';
  }

  const rewardVal = document.getElementById('rewardVal');
  if (q.payment_type === 'coins') {
    rewardVal.textContent = q.coin_amount + ' FC';
  } else if (q.payment_type === 'upi') {
    rewardVal.textContent = '₹' + q.upi_amount;
  } else {
    document.getElementById('rewardContainer').style.display = 'none';
  }

  const deadlineDate = new Date(q.deadline);
  const formattedDate = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = deadlineDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('deadlineStr').innerHTML = `
    <span style="color: var(--text); font-weight: 600;">${formattedDate}</span>
    <span style="color: var(--text-dim); margin-left: 8px;">${formattedTime}</span>
  `;

  // Reset UI Panels
  document.getElementById('workerProofPanel').style.display = 'none';
  document.getElementById('posterAppraisalPanel').style.display = 'none';
  document.getElementById('disputePanel').style.display = 'none';
  document.getElementById('ratingPanel').style.display = 'none';

  if (countdownInterval) clearInterval(countdownInterval);

  // Status mapping
  if (q.status === 'accepted' && isWorker) {
    document.getElementById('workerProofPanel').style.display = 'block';
  } else if (q.status === 'submitted') {
    if (isPoster) {
      document.getElementById('posterAppraisalPanel').style.display = 'block';
      renderProofFileViewer();
      startAppraisalCountdown();
    } else {
      showAlert('Quest proof submitted. Poster has 48 hours to approve or initiate dispute.', 'success');
    }
  } else if (q.status === 'disputed') {
    document.getElementById('disputePanel').style.display = 'block';
  } else if (q.status === 'approved' && q.payment_type !== 'free') {
    document.getElementById('ratingPanel').style.display = 'block';
    loadRatingWidgetDetails();
  }
}

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
      <div style="margin-bottom: 10px;">Submitted Asset Proof:</div>
      <img src="${url}" alt="Task Proof">
      <div><a href="${url}" target="_blank">🔗 Open Asset URL</a></div>
    `;
  } else {
    container.innerHTML = `
      <div style="margin-bottom: 15px;">📄 Submitted Proof File.</div>
      <a href="${url}" target="_blank" class="btn btn-accent">🔗 Download Document Asset</a>
    `;
  }
}

let selectedProofFile = null;

window.handleFileSelected = function(input) {
  if (input.files && input.files[0]) {
    selectedProofFile = input.files[0];
    document.getElementById('selectedFileName').textContent = `File selected: ${selectedProofFile.name}`;
    document.getElementById('submitProofBtn').style.display = 'inline-block';
  }
};

window.uploadProofFile = async function() {
  if (!selectedProofFile) return;

  const btn = document.getElementById('submitProofBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading Proof...';

  try {
    const fileExt = selectedProofFile.name.split('.').pop();
    const fileName = `${currentQuest.id}-${Date.now()}.${fileExt}`;
    const filePath = `proofs/${fileName}`;

    const { data, error } = await sb.storage
      .from('quest-images')
      .upload(filePath, selectedProofFile);

    if (error) {
      showAlert(`Upload failed: ${error.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Proof';
      return;
    }

    const { data: publicData } = sb.storage
      .from('quest-images')
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

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
      showAlert('Database failed to map proof details.', 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Proof';
      return;
    }

    showAlert('Proof uploaded successfully!', 'success');
    setTimeout(() => refreshQuestData(), 1200);

  } catch (err) {
    showAlert('System failed during proof upload.', 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Proof';
  }
};

window.approveSubmittedQuest = async function() {
  clearAlert();
  if (!confirm('Approve submission and release locked rewards?')) return;

  try {
    const { error } = await sb.rpc('approve_quest', { p_quest_id: currentQuest.id });

    if (error) {
      showAlert(`Approve failed: ${error.message}`, 'error');
      return;
    }

    showAlert('Quest successfully approved! Payout sent.', 'success');
    
    if (currentQuest.payment_type === 'upi') {
      alert(`Remember to pay the worker ₹${currentQuest.upi_amount} directly via external UPI now!`);
    }

    setTimeout(() => refreshQuestData(), 1500);
  } catch (err) {
    console.error(err);
  }
};

window.disputeQuest = async function() {
  clearAlert();
  if (!confirm('Holding payout initiates review dispute. Proceed?')) return;

  try {
    const { error } = await sb
      .from('quests')
      .update({ status: 'disputed', appraisal_deadline: null })
      .eq('id', currentQuest.id);

    if (error) {
      showAlert(`Action failed: ${error.message}`, 'error');
      return;
    }

    showAlert('Review dispute logged. Investigators notified.', 'error');
    setTimeout(() => refreshQuestData(), 1200);
  } catch (err) {
    console.error(err);
  }
};

async function loadQuestComments(questId) {
  if (!questId) return;

  const { data, error } = await sb
    .from('quest_comments')
    .select(`
      *,
      sender:user_profiles!quest_comments_user_id_fkey(username, display_name)
    `)
    .eq('quest_id', questId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Comments fetching failed:', error);
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

window.postCommentText = async function() {
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
    showAlert('Message posting failed.', 'error');
  }
};

function subscribeToQuestComments(questId) {
  if (!questId) return;

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

// Double blind reviews logic
window.setRatingValue = function(score) {
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
};

window.submitUserRating = async function() {
  if (currentRatingValue === 0) {
    alert('Select score rating stars first.');
    return;
  }

  try {
    const { error } = await sb.rpc('submit_rating', {
      p_quest_id: currentQuest.id,
      p_score: currentRatingValue
    });

    if (error) {
      alert('Failed to register review score: ' + error.message);
      return;
    }

    alert('Your review evaluation feedback is registered!');
    loadRatingWidgetDetails();

  } catch (err) {
    console.error(err);
  }
};

async function loadRatingWidgetDetails() {
  const { data: ratings, error } = await sb
    .from('ratings')
    .select('*')
    .eq('quest_id', currentQuest.id);

  if (error) return;

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
      scoresHtml += `<div>${isMine ? '🏆 You left review score' : '👥 Co-participant rating score'}: <strong>${r.score} Stars</strong></div>`;
    });

    scoreList.innerHTML = scoresHtml;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
