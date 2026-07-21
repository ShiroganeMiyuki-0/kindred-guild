// ============================================
// KINDRED GUILD — QUEST DETAIL CONTROLLER
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Uses shared window.sb from supabase-client.js
// ============================================

let currentUser = null;
let currentQuest = null;
let currentRatingValue = 0;
let countdownInterval = null;
let stagedProofFiles = [];
let pendingCommentAttachments = [];

// Custom Modal
let customModalResolve = null;

function showCustomConfirm(title, text) {
  document.getElementById('customModalTitle').textContent = title;
  document.getElementById('customModalText').textContent = text;
  document.getElementById('customModalOverlay').style.display = 'flex';
  return new Promise(resolve => { customModalResolve = resolve; });
}

document.getElementById('customModalConfirm').onclick = function () {
  document.getElementById('customModalOverlay').style.display = 'none';
  if (customModalResolve) customModalResolve(true);
};
document.getElementById('customModalCancel').onclick = function () {
  document.getElementById('customModalOverlay').style.display = 'none';
  if (customModalResolve) customModalResolve(false);
};

function getQuestId() {
  const rawId = getUrlParam('id');
  return isValidUuid(rawId) ? rawId : null;
}

function showAlert(text, type) {
  const box = document.getElementById('alertBox');
  box.textContent = text;
  box.className = 'message ' + (type || 'error');
}

function clearAlert() { document.getElementById('alertBox').className = 'message'; }

(async function init() {
  const questId = getQuestId();
  if (!questId) {
    showAlert('Invalid link. Returning to board...', 'error');
    setTimeout(() => window.location.href = 'quest-board.html', 1500);
    return;
  }

  const user = await window.requireAuth();
  if (!user) return;
  currentUser = user;

  const profile = await window.getUserProfile(user.id);
  const name = profile?.display_name || profile?.username || 'Member';
  document.getElementById('userProfileBadge').textContent = name;

  await refreshQuestData();
  subscribeToQuestComments(questId);
  await loadQuestComments(questId);
})();

async function refreshQuestData() {
  const questId = getQuestId();
  if (!questId) return;

  const { data: quest, error } = await window.sb
    .from('quests')
    .select(`*, poster:user_profiles!quests_poster_id_fkey(user_id,username,display_name,reputation_score,upi_id,upi_qr_url), worker:user_profiles!quests_worker_id_fkey(user_id,username,display_name,reputation_score,upi_id,upi_qr_url)`)
    .eq('id', questId)
    .single();

  if (error || !quest) { showAlert('Could not load quest details.', 'error'); return; }

  currentQuest = quest;
  window.currentQuest = quest;
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
  const pRep = q.poster?.reputation_score ? (q.poster.reputation_score / 10).toFixed(1) : '—';
  document.getElementById('posterName').innerHTML = `<a href="profile.html?username=${q.poster?.username}">${escapeHtml(pName)}</a>`;
  document.getElementById('posterRep').textContent = `⭐ ${pRep}`;

  if (q.worker) {
    const wName = q.worker?.display_name || q.worker?.username;
    const wRep = q.worker?.reputation_score ? (q.worker.reputation_score / 10).toFixed(1) : '—';
    document.getElementById('workerName').innerHTML = `<a href="profile.html?username=${q.worker?.username}">${escapeHtml(wName)}</a>`;
    document.getElementById('workerRep').textContent = `⭐ ${wRep}`;
  } else {
    document.getElementById('workerName').textContent = 'No one yet';
    document.getElementById('workerRep').textContent = '';
  }

  const rewardVal = document.getElementById('rewardVal');
  if (q.payment_type === 'coins') rewardVal.textContent = q.coin_amount + ' FC';
  else if (q.payment_type === 'upi') rewardVal.textContent = '₹' + q.upi_amount;
  else document.getElementById('rewardContainer').style.display = 'none';

  const d = new Date(q.deadline);
  document.getElementById('deadlineStr').innerHTML = `<strong>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  // Reset panels
  ['workerProofPanel', 'posterAppraisalPanel', 'disputePanel', 'ratingPanel', 'abandonContainer', 'cancelContainer'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  if (countdownInterval) clearInterval(countdownInterval);

  // State routing
  if (q.status === 'pending_acceptance') {
    if (isPoster) {
      // Show approve/reject buttons for poster
      const actionPanel = document.getElementById('cancelContainer');
      actionPanel.style.display = 'block';
      actionPanel.innerHTML = `
        <h3 style="color:var(--accent);margin-bottom:12px;">👤 Worker Application</h3>
        <p style="color:var(--text-dim);margin-bottom:16px;">A worker wants to accept your quest. Review their profile and approve or reject.</p>
        <div class="approve-reject-actions">
          <button class="btn-approve" onclick="approveWorkerDetail(true)">✅ Approve Worker</button>
          <button class="btn-reject" onclick="approveWorkerDetail(false)">❌ Reject Worker</button>
        </div>`;
    } else if (isWorker) {
      showAlert('Your application is pending. The poster will review it soon.', 'info');
    } else {
      showAlert('This quest has a pending worker application.', 'info');
    }
  } else if (q.status === 'accepted') {
    if (isWorker) {
      document.getElementById('workerProofPanel').style.display = 'block';
      document.getElementById('abandonContainer').style.display = 'block';
    } else if (isPoster) {
      document.getElementById('cancelContainer').style.display = 'block';
      showAlert('Task accepted. Waiting for worker to submit proof.', 'success');
    }
  } else if (q.status === 'open') {
    if (isPoster) {
      document.getElementById('cancelContainer').style.display = 'block';
    }
  } else if (q.status === 'submitted') {
    if (isPoster) {
      document.getElementById('posterAppraisalPanel').style.display = 'block';
      renderProofFileGrid();
      startAppraisalCountdown();
      document.getElementById('disputeLauncher').style.display = q.payment_type === 'free' ? 'none' : 'inline-block';

      if (q.payment_type === 'upi' && q.worker) {
        const box = document.getElementById('workerUpiShowcase');
        box.style.display = 'block';
        document.getElementById('workerUpiText').textContent = q.worker.upi_id ? `UPI: ${q.worker.upi_id}` : 'Worker has not set up UPI yet.';
        document.getElementById('workerUpiQrContainer').innerHTML = q.worker.upi_qr_url
          ? `<div style="font-size:0.8rem;color:var(--text-dim);margin-top:6px">Scan to pay:</div><img src="${q.worker.upi_qr_url}" class="upi-qr-image" alt="QR">`
          : '<div style="font-size:0.8rem;color:var(--error);margin-top:6px">No QR uploaded.</div>';
      } else {
        document.getElementById('workerUpiShowcase').style.display = 'none';
      }
    } else {
      showAlert('Proof submitted! Poster has 48 hours to review.', 'success');
    }
  } else if (q.status === 'disputed') {
    document.getElementById('disputePanel').style.display = 'block';
    if (isPoster) document.getElementById('disputeReleaseBtn').style.display = 'inline-block';
    if (isWorker) document.getElementById('disputeRefundBtn').style.display = 'inline-block';
  } else if (q.status === 'approved' && q.payment_type !== 'free') {
    document.getElementById('ratingPanel').style.display = 'block';
    loadRatingWidgetDetails();
  }
}

// Proof file staging
window.handleQueueFiles = function (input) {
  if (input.files) {
    for (let i = 0; i < input.files.length; i++) stagedProofFiles.push(input.files[i]);
    input.value = '';
    renderStagedFilesList();
  }
};

function renderStagedFilesList() {
  const container = document.getElementById('stagedFilesContainer');
  const list = document.getElementById('stagedFilesList');
  if (stagedProofFiles.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  list.innerHTML = stagedProofFiles.map((f, i) => `
    <div class="staged-file-item">
      <div><span class="staged-file-name">${escapeHtml(f.name)}</span> <span class="staged-file-size">(${(f.size / 1024).toFixed(1)} KB)</span></div>
      <button class="remove-file-btn" onclick="removeStagedFile(${i})">Remove</button>
    </div>`).join('');
}

window.removeStagedFile = function (i) { stagedProofFiles.splice(i, 1); renderStagedFilesList(); };

window.uploadProofFiles = async function () {
  if (stagedProofFiles.length === 0) return;
  const btn = document.getElementById('submitProofBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  try {
    const urls = await Promise.all(stagedProofFiles.map(async file => {
      const ext = file.name.split('.').pop();
      const path = `proofs/${currentQuest.id}-${Date.now()}-${Math.random().toString(36).slice(7)}.${ext}`;
      const { error } = await window.sb.storage.from('quest-images').upload(path, file);
      if (error) throw error;
      return window.sb.storage.from('quest-images').getPublicUrl(path).data.publicUrl;
    }));

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 48);

    const { error } = await window.sb.from('quests').update({
      proof_urls: urls, proof_url: urls[0] || null,
      status: 'submitted', appraisal_deadline: deadline.toISOString()
    }).eq('id', currentQuest.id);

    if (error) throw error;

    stagedProofFiles = [];
    renderStagedFilesList();
    showAlert('Proof submitted!', 'success');
    // Notify poster
    if (currentQuest?.poster_id) window.sendNotification('proof_submitted', currentQuest.poster_id, currentQuest.id);
    setTimeout(() => refreshQuestData(), 1200);
  } catch (err) {
    showAlert('Upload failed: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Proof';
  }
};

function renderProofFileGrid() {
  const container = document.getElementById('multiProofViewer');
  const urls = currentQuest.proof_urls || [];
  if (urls.length === 0 && currentQuest.proof_url) urls.push(currentQuest.proof_url);
  if (urls.length === 0) { container.innerHTML = '<p style="color:var(--error)">No files uploaded.</p>'; return; }

  container.innerHTML = urls.map((url, i) => {
    const isImg = /\.(jpeg|jpg|gif|png|webp)/i.test(url);
    const isVid = /\.(mp4|webm|ogg|mov)/i.test(url);
    const preview = isImg ? `<img src="${url}">` : isVid ? `<video src="${url}" controls muted></video>` : `<div class="proof-tile-doc">📄</div>`;
    return `<div class="proof-tile">${preview}<div class="proof-tile-info"><a href="${url}" target="_blank">🔗 File ${i + 1}</a></div></div>`;
  }).join('');
}

function startAppraisalCountdown() {
  const el = document.getElementById('countdownTimer');
  if (!currentQuest.appraisal_deadline) return;
  const target = new Date(currentQuest.appraisal_deadline).getTime();

  countdownInterval = setInterval(() => {
    const dist = target - Date.now();
    if (dist < 0) { clearInterval(countdownInterval); el.textContent = 'AUTO-APPROVING...'; refreshQuestData(); return; }
    const h = Math.floor(dist / 3600000);
    const m = Math.floor((dist % 3600000) / 60000);
    const s = Math.floor((dist % 60000) / 1000);
    el.textContent = `${h}h ${m}m ${s}s`;
  }, 1000);
}

// Actions
window.triggerAbandonQuest = async function () {
  if (!await showCustomConfirm('Abandon Quest', 'Release this task back to the board?')) return;
  const { error } = await window.sb.rpc('abandon_quest', { p_quest_id: currentQuest.id });
  if (error) { showAlert('Failed: ' + error.message, 'error'); return; }
  showAlert('Quest abandoned.', 'success');
  setTimeout(() => window.location.href = 'quest-board.html', 1500);
};

window.triggerCancelQuest = async function () {
  if (!await showCustomConfirm('Cancel Quest', 'Cancel this quest and get your coins refunded?')) return;
  const { error } = await window.sb.rpc('cancel_quest', { p_quest_id: currentQuest.id });
  if (error) { showAlert('Failed: ' + error.message, 'error'); return; }
  showAlert('Quest cancelled. Coins refunded.', 'success');
  setTimeout(() => window.location.href = 'quest-board.html', 1500);
};

window.triggerRevisionRequest = async function () {
  if (!await showCustomConfirm('Request Revision', 'Reject proof and request changes?')) return;
  const { error } = await window.sb.rpc('request_revision', { p_quest_id: currentQuest.id });
  if (error) { showAlert('Failed: ' + error.message, 'error'); return; }
  await window.sb.from('quest_comments').insert({ quest_id: currentQuest.id, user_id: currentUser.id, content: '🚨 Revision requested by poster.' });
  showAlert('Revision requested.', 'success');
  setTimeout(() => refreshQuestData(), 1200);
};

window.triggerApproval = async function () {
  const msg = currentQuest.payment_type === 'free' ? 'Confirm task is complete?' : 'Approve and release payment?';
  if (!await showCustomConfirm('Approve', msg)) return;
  const { error } = await window.sb.rpc('approve_quest', { p_quest_id: currentQuest.id });
  if (error) { showAlert('Failed: ' + error.message, 'error'); return; }
  showAlert('Approved!', 'success');
  // Notify worker
  if (currentQuest?.worker_id) window.sendNotification('quest_approved', currentQuest.worker_id, currentQuest.id);
  setTimeout(() => refreshQuestData(), 1500);
};

window.triggerDisputeLaunch = async function () {
  if (!await showCustomConfirm('File Dispute', 'Lock funds and open arbitration?')) return;
  const { error } = await window.sb.rpc('file_dispute', { p_quest_id: currentQuest.id, p_reason: 'Dispute filed via quest detail' });
  if (error) { showAlert('Failed: ' + error.message, 'error'); return; }
  showAlert('Dispute opened.', 'error');
  setTimeout(() => refreshQuestData(), 1200);
};

window.triggerDisputeResolution = async function (action) {
  const text = action === 'refund' ? 'Cancel quest and refund poster?' : 'Release payout to worker?';
  if (!await showCustomConfirm('Resolve Dispute', text)) return;
  const { error } = await window.sb.rpc('resolve_dispute_jointly', { p_quest_id: currentQuest.id, p_action: action });
  if (error) { showAlert('Failed: ' + error.message, 'error'); return; }
  await window.sb.from('quest_comments').insert({ quest_id: currentQuest.id, user_id: currentUser.id, content: `🤝 Dispute resolved: ${action}` });
  showAlert('Dispute resolved!', 'success');
  setTimeout(() => refreshQuestData(), 1500);
};

window.approveWorkerDetail = async function (approved) {
  if (!confirm(approved ? 'Approve this worker?' : 'Reject this worker?')) return;

  const { data: result, error } = await window.sb.rpc('poster_approve_worker', {
    p_quest_id: currentQuest.id,
    p_poster_id: currentUser.id,
    p_approved: approved
  });

  if (error) { showAlert('Failed: ' + error.message, 'error'); return; }
  if (result && !result.success) { showAlert(result.error, 'error'); return; }

  showAlert(approved ? 'Worker approved!' : 'Worker rejected.', 'success');
  setTimeout(() => refreshQuestData(), 1500);
};

// Comments
async function loadQuestComments(questId) {
  const { data } = await window.sb.from('quest_comments').select('*, sender:user_profiles!quest_comments_user_id_fkey(username, display_name)').eq('quest_id', questId).order('created_at', { ascending: true });
  renderComments(data || []);
}

function renderComments(comments) {
  const box = document.getElementById('commentsBox');
  if (comments.length === 0) {
    box.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px">No messages yet. Use this board to coordinate.</div>';
    return;
  }

  box.innerHTML = comments.map(c => {
    const sender = c.sender?.display_name || c.sender?.username || 'Member';
    const time = new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isSelf = c.user_id === currentUser.id;

    let embeds = '';
    const allUrls = [...(c.attachment_urls || [])];
    if (c.content?.includes('[ATTACHMENT:')) {
      const matches = c.content.match(/\[ATTACHMENT:\s*([^\]\s]+)\]/g);
      if (matches) matches.forEach(m => { const u = m.match(/\[ATTACHMENT:\s*([^\]\s]+)\]/); if (u?.[1]) allUrls.push(u[1]); });
    }

    if (allUrls.length > 0) {
      embeds = '<div>' + allUrls.map((url, i) => {
        if (/\.(jpeg|jpg|gif|png|webp)/i.test(url)) return `<div class="comment-embed"><img src="${url}"><a href="${url}" target="_blank">🔗 Image ${i + 1}</a></div>`;
        if (/\.(mp4|webm|ogg|mov)/i.test(url)) return `<div class="comment-embed"><video src="${url}" controls muted></video><a href="${url}" target="_blank">🎬 Video ${i + 1}</a></div>`;
        return `<div class="comment-embed"><a href="${url}" target="_blank">📄 File ${i + 1}</a></div>`;
      }).join('') + '</div>';
    }

    const cleanContent = c.content ? c.content.replace(/\[ATTACHMENT:\s*[^\]\s]+\]/g, '').trim() : '';

    return `
      <div class="comment-card" style="${isSelf ? 'border-color:var(--accent)' : ''}">
        <div class="comment-meta"><strong>${sender} ${isSelf ? '(You)' : ''}</strong><span>${time}</span></div>
        <div class="comment-content">${escapeHtml(cleanContent)}</div>
        ${embeds}
      </div>`;
  }).join('');

  box.scrollTop = box.scrollHeight;
}

window.handleCommentAttachment = function (input) {
  if (input.files) {
    for (let i = 0; i < input.files.length; i++) pendingCommentAttachments.push(input.files[i]);
    input.value = '';
    const indicator = document.getElementById('commentAttachmentName');
    if (pendingCommentAttachments.length > 0) {
      indicator.style.display = 'block';
      indicator.textContent = `📎 ${pendingCommentAttachments.length} file(s): ${pendingCommentAttachments.map(f => f.name).join(', ')}`;
    }
  }
};

window.postCommentText = async function () {
  const input = document.getElementById('commentText');
  const text = input.value.trim();
  if (!text && pendingCommentAttachments.length === 0) return;

  const btn = document.getElementById('sendCommentBtn');
  btn.disabled = true;

  try {
    let finalContent = text;
    let attachmentUrls = [];

    if (pendingCommentAttachments.length > 0) {
      attachmentUrls = await Promise.all(pendingCommentAttachments.map(async file => {
        const ext = file.name.split('.').pop();
        const path = `comments/${currentQuest.id}-${Date.now()}-${Math.random().toString(36).slice(7)}.${ext}`;
        const { error } = await window.sb.storage.from('quest-images').upload(path, file);
        if (error) throw error;
        return window.sb.storage.from('quest-images').getPublicUrl(path).data.publicUrl;
      }));
      attachmentUrls.forEach(url => { finalContent = `${finalContent} [ATTACHMENT:${url}]`.trim(); });
    }

    input.value = '';
    pendingCommentAttachments = [];
    document.getElementById('commentAttachmentName').style.display = 'none';

    await window.sb.from('quest_comments').insert({
      quest_id: currentQuest.id, user_id: currentUser.id,
      content: finalContent, attachment_urls: attachmentUrls
    });
  } catch (err) {
    showAlert('Failed to send: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
};

function subscribeToQuestComments(questId) {
  window.sb.channel(`comments-${questId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quest_comments', filter: `quest_id=eq.${questId}` }, () => loadQuestComments(questId))
    .subscribe();
}

// Ratings
window.setRatingValue = function (score) {
  currentRatingValue = score;
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('selected', parseInt(s.getAttribute('data-score')) <= score);
  });
};

window.submitUserRating = async function () {
  if (currentRatingValue === 0) { showAlert('Select a star rating first.', 'error'); return; }
  const { error } = await window.sb.rpc('submit_rating', { p_quest_id: currentQuest.id, p_score: currentRatingValue });
  if (error) { showAlert('Failed: ' + error.message, 'error'); return; }
  showAlert('Rating submitted!', 'success');
  loadRatingWidgetDetails();
};

async function loadRatingWidgetDetails() {
  const { data: ratings } = await window.sb.from('ratings').select('*').eq('quest_id', currentQuest.id);
  if (!ratings) return;

  const myRating = ratings.find(r => r.rater_id === currentUser.id);
  const revealed = ratings.length > 0 && ratings.every(r => r.revealed);

  if (myRating) {
    document.getElementById('activeRatingForm').style.display = 'none';
    document.getElementById('waitingRatingMessage').style.display = 'block';
  }

  if (revealed) {
    document.getElementById('waitingRatingMessage').style.display = 'none';
    const container = document.getElementById('ratingResultDisplay');
    container.style.display = 'block';
    document.getElementById('ratingScoreList').innerHTML = ratings.map(r =>
      `<div>${r.rater_id === currentUser.id ? 'Your rating' : 'Partner rating'}: <strong>${r.score} Stars</strong></div>`
    ).join('');
  }
}

// Social sharing
window.shareQuest = function(platform) {
  const title = currentQuest?.title || 'Kindred Guild Quest';
  const url = window.location.href;
  const text = `Check out this task on Kindred Guild: "${title}" — `;
  
  switch(platform) {
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(text + url)}`, '_blank');
      break;
    case 'twitter':
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
      break;
    case 'telegram':
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
      break;
    case 'copy':
      navigator.clipboard.writeText(url).then(() => {
        window.showToast('Link copied to clipboard!', 'success');
      }).catch(() => {
        window.showToast('Could not copy link', 'error');
      });
      break;
  }
};
