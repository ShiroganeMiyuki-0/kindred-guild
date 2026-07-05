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
let stagedProofFiles = [];
let pendingCommentAttachments = []; // Changed to array for multiple files

// Custom Modal Promise configuration replacing alert/confirm
let customModalResolve = null;

function showCustomConfirm(title, text) {
  document.getElementById('customModalTitle').textContent = title;
  document.getElementById('customModalText').textContent = text;
  document.getElementById('customModalOverlay').style.display = 'flex';
  return new Promise((resolve) => {
    customModalResolve = resolve;
  });
}

document.getElementById('customModalConfirm').onclick = function() {
  document.getElementById('customModalOverlay').style.display = 'none';
  if (customModalResolve) customModalResolve(true);
};

document.getElementById('customModalCancel').onclick = function() {
  document.getElementById('customModalOverlay').style.display = 'none';
  if (customModalResolve) customModalResolve(false);
};

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

(async function init() {
  const questId = getQuestId();
  if (!questId) {
    showAlert('Invalid workspace link. Returning to board...', 'error');
    setTimeout(() => {
      window.location.href = 'quest-board.html';
    }, 1500);
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
      poster:user_profiles!quests_poster_id_fkey(user_id, username, display_name, reputation_score, upi_id, upi_qr_url),
      worker:user_profiles!quests_worker_id_fkey(user_id, username, display_name, reputation_score, upi_id, upi_qr_url)
    `)
    .eq('id', questId)
    .single();

  if (error || !quest) {
    showAlert('Workspace details could not be retrieved.', 'error');
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

  // Reset Sub-Panels
  document.getElementById('workerProofPanel').style.display = 'none';
  document.getElementById('posterAppraisalPanel').style.display = 'none';
  document.getElementById('disputePanel').style.display = 'none';
  document.getElementById('ratingPanel').style.display = 'none';
  document.getElementById('abandonContainer').style.display = 'none';

  if (countdownInterval) clearInterval(countdownInterval);

  // Workflow State Router
  if (q.status === 'accepted') {
    if (isWorker) {
      document.getElementById('workerProofPanel').style.display = 'block';
      document.getElementById('abandonContainer').style.display = 'block';
    } else if (isPoster) {
      showAlert('Quest accepted. Awaiting worker deliverable uploads.', 'success');
    }
  } else if (q.status === 'submitted') {
    if (isPoster) {
      document.getElementById('posterAppraisalPanel').style.display = 'block';
      renderProofFileGrid();
      startAppraisalCountdown();
      
      // Free quest layout customization
      if (q.payment_type === 'free') {
        document.getElementById('disputeLauncher').style.display = 'none';
      } else {
        document.getElementById('disputeLauncher').style.display = 'inline-block';
      }

      // Display worker UPI details on appraisal board if payment is UPI direct
      if (q.payment_type === 'upi' && q.worker) {
        const upiShowcase = document.getElementById('workerUpiShowcase');
        const upiText = document.getElementById('workerUpiText');
        const qrContainer = document.getElementById('workerUpiQrContainer');
        
        upiShowcase.style.display = 'block';
        upiText.textContent = q.worker.upi_id ? `Direct Payout Address: ${q.worker.upi_id}` : 'Worker has not setup a UPI ID yet.';
        
        if (q.worker.upi_qr_url) {
          qrContainer.innerHTML = `
            <div style="font-size:0.8rem; color: var(--text-dim); margin-top:8px;">Scan to Pay:</div>
            <img src="${q.worker.upi_qr_url}" class="upi-qr-image" alt="UPI QR">
          `;
        } else {
          qrContainer.innerHTML = '<div style="font-size:0.8rem; color: var(--error); margin-top:8px;">No payment QR uploaded. Coordinate in secure comments panel.</div>';
        }
      } else {
        document.getElementById('workerUpiShowcase').style.display = 'none';
      }
    } else {
      showAlert('Staged completion files uploaded! Poster has 48 hours to approve or request revision.', 'success');
    }
  } else if (q.status === 'disputed') {
    document.getElementById('disputePanel').style.display = 'block';
    
    // Settle Dispute joint commands
    if (isPoster) {
      document.getElementById('disputeReleaseBtn').style.display = 'inline-block';
    } else if (isWorker) {
      document.getElementById('disputeRefundBtn').style.display = 'inline-block';
    }
  } else if (q.status === 'approved' && q.payment_type !== 'free') {
    document.getElementById('ratingPanel').style.display = 'block';
    loadRatingWidgetDetails();
  }
}

// Staged proof cache actions
window.handleQueueFiles = function(input) {
  if (input.files) {
    for (let i = 0; i < input.files.length; i++) {
      stagedProofFiles.push(input.files[i]);
    }
    input.value = ''; // Reset input to allow re-selecting same files
    renderStagedFilesList();
  }
};

function renderStagedFilesList() {
  const container = document.getElementById('stagedFilesContainer');
  const list = document.getElementById('stagedFilesList');
  
  if (stagedProofFiles.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  list.innerHTML = stagedProofFiles.map((f, index) => {
    const sizeKB = (f.size / 1024).toFixed(1);
    return `
      <div class="staged-file-item">
        <div>
          <span class="staged-file-name">${escapeHtml(f.name)}</span>
          <span class="staged-file-size">(${sizeKB} KB)</span>
        </div>
        <button class="remove-file-btn" onclick="removeStagedFile(${index})">Remove</button>
      </div>
    `;
  }).join('');
}

window.removeStagedFile = function(index) {
  stagedProofFiles.splice(index, 1);
  renderStagedFilesList();
};

window.uploadProofFiles = async function() {
  if (stagedProofFiles.length === 0) return;

  const btn = document.getElementById('submitProofBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading files...';

  try {
    const uploadPromises = stagedProofFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentQuest.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `proofs/${fileName}`;

      const { data, error } = await sb.storage
        .from('quest-images')
        .upload(filePath, file);

      if (error) throw error;

      const { data: publicData } = sb.storage
        .from('quest-images')
        .getPublicUrl(filePath);

      return publicData.publicUrl;
    });

    const uploadedUrls = await Promise.all(uploadPromises);

    const appraisalDeadline = new Date();
    appraisalDeadline.setHours(appraisalDeadline.getHours() + 48);

    const { error: dbError } = await sb
      .from('quests')
      .update({
        proof_urls: uploadedUrls,
        proof_url: uploadedUrls[0] || null, // Backwards compatibility hook
        status: 'submitted',
        appraisal_deadline: appraisalDeadline.toISOString()
      })
      .eq('id', currentQuest.id);

    if (dbError) {
      showAlert('Database update failed to record proof URLs.', 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Staged Deliverables';
      return;
    }

    stagedProofFiles = [];
    renderStagedFilesList();
    showAlert('Staged deliverables uploaded successfully!', 'success');
    setTimeout(() => refreshQuestData(), 1200);

  } catch (err) {
    showAlert(`Submission failed: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Staged Deliverables';
  }
};

function renderProofFileGrid() {
  const container = document.getElementById('multiProofViewer');
  const urls = currentQuest.proof_urls || [];
  
  // Backwards compatibility fallback to singular proof_url
  if (urls.length === 0 && currentQuest.proof_url) {
    urls.push(currentQuest.proof_url);
  }

  if (urls.length === 0) {
    container.innerHTML = '<p style="color: var(--error)">No files uploaded.</p>';
    return;
  }

  container.innerHTML = urls.map((url, i) => {
    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)/i);
    const isVideo = url.match(/\.(mp4|webm|ogg|mov)/i);
    let previewHtml = '';

    if (isImage) {
      previewHtml = `<img src="${url}" alt="Attachment">`;
    } else if (isVideo) {
      previewHtml = `<video src="${url}" controls muted></video>`;
    } else {
      previewHtml = `<div class="proof-tile-doc">📄</div>`;
    }

    return `
      <div class="proof-tile">
        ${previewHtml}
        <div class="proof-tile-info">
          <a href="${url}" target="_blank">🔗 View File ${i + 1}</a>
        </div>
      </div>
    `;
  }).join('');
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
      countdownEl.textContent = 'AUTO-APPROVING...';
      refreshQuestData();
      return;
    }

    const hours = Math.floor(distance / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
  }, 1000);
}

window.triggerAbandonQuest = async function() {
  const confirmed = await showCustomConfirm('Abandon Quest', 'Are you sure you want to abandon this quest? It will be put back on the public board for other members to accept.');
  if (!confirmed) return;

  try {
    const { error } = await sb.rpc('abandon_quest', { p_quest_id: currentQuest.id });
    if (error) {
      showAlert(`Action failed: ${error.message}`, 'error');
      return;
    }
    showAlert('Quest abandoned. Redirecting to board...', 'success');
    setTimeout(() => window.location.href = 'quest-board.html', 1500);
  } catch (err) {
    console.error(err);
  }
};

window.triggerRevisionRequest = async function() {
  const confirmed = await showCustomConfirm('Request Revision', 'Reject this proof and request revisions from the worker? The quest will move back to "Accepted" state.');
  if (!confirmed) return;

  try {
    const { error } = await sb.rpc('request_revision', { p_quest_id: currentQuest.id });
    if (error) {
      showAlert(`Action failed: ${error.message}`, 'error');
      return;
    }
    
    // Post system revision comment automatically
    await sb.from('quest_comments').insert({
      quest_id: currentQuest.id,
      user_id: currentUser.id,
      content: '🚨 REVISION REQUESTED: Poster has requested changes. Deliverables rejected. Reset to pending accepted.'
    });

    showAlert('Revision request sent successfully!', 'success');
    setTimeout(() => refreshQuestData(), 1200);
  } catch (err) {
    console.error(err);
  }
};

window.triggerApproval = async function() {
  clearAlert();
  let msg = 'Approve deliverables and disburse payments?';
  if (currentQuest.payment_type === 'free') msg = 'Confirm task completion?';
  
  const confirmed = await showCustomConfirm('Approve Deliverables', msg);
  if (!confirmed) return;

  try {
    const { error } = await sb.rpc('approve_quest', { p_quest_id: currentQuest.id });
    if (error) {
      showAlert(`Approve failed: ${error.message}`, 'error');
      return;
    }

    if (currentQuest.payment_type === 'free') {
      showAlert('Quest successfully completed!', 'success');
    } else {
      showAlert('Quest successfully approved! Payout completed.', 'success');
    }
    
    setTimeout(() => refreshQuestData(), 1500);
  } catch (err) {
    console.error(err);
  }
};

window.triggerDisputeLaunch = async function() {
  clearAlert();
  const confirmed = await showCustomConfirm('File Dispute', 'Lock funds and file an active arbitration dispute? The Guild Administration will assist in resolving the case.');
  if (!confirmed) return;

  try {
    const { error } = await sb
      .from('quests')
      .update({ status: 'disputed', appraisal_deadline: null })
      .eq('id', currentQuest.id);

    if (error) {
      showAlert(`Action failed: ${error.message}`, 'error');
      return;
    }

    await sb.from('quest_comments').insert({
      quest_id: currentQuest.id,
      user_id: currentUser.id,
      content: '🚨 DISPUTE LOGGED: An official dispute is raised. Settle amicably or await administration arbitration.'
    });

    showAlert('Arbitration log created successfully.', 'error');
    setTimeout(() => refreshQuestData(), 1200);
  } catch (err) {
    console.error(err);
  }
};

window.triggerDisputeResolution = async function(action) {
  let text = 'Choose resolve and disburse payouts?';
  if (action === 'refund') text = 'Agree to forfeit the dispute, cancel the quest, and issue a full refund to the poster?';
  
  const confirmed = await showCustomConfirm('Resolve Dispute', text);
  if (!confirmed) return;

  try {
    const { error } = await sb.rpc('resolve_dispute_jointly', {
      p_quest_id: currentQuest.id,
      p_action: action
    });

    if (error) {
      showAlert(`Resolution trigger failed: ${error.message}`, 'error');
      return;
    }

    await sb.from('quest_comments').insert({
      quest_id: currentQuest.id,
      user_id: currentUser.id,
      content: `🤝 DISPUTE RESOLVED: Joint compromise reached. Case closed with action: "${action}".`
    });

    showAlert('Dispute successfully resolved!', 'success');
    setTimeout(() => refreshQuestData(), 1500);
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

    // Build attachment HTML from both legacy content tags and new attachment_urls array
    let embedHtml = '';
    const allAttachments = [];
    
    // Collect from attachment_urls array (new method)
    if (c.attachment_urls && Array.isArray(c.attachment_urls)) {
      allAttachments.push(...c.attachment_urls);
    }
    
    // Also collect from legacy content tags for backwards compatibility
    if (c.content && c.content.includes('[ATTACHMENT:')) {
      const matches = c.content.match(/\\[ATTACHMENT:\\s*([^\\]\\s]+)\\]/g);
      if (matches) {
        matches.forEach(match => {
          const urlMatch = match.match(/\\[ATTACHMENT:\\s*([^\\]\\s]+)\\]/);
          if (urlMatch && urlMatch[1]) {
            allAttachments.push(urlMatch[1]);
          }
        });
      }
    }

    // Render all attachments
    if (allAttachments.length > 0) {
      embedHtml = '<div class="comment-attachments">';
      allAttachments.forEach((fileUrl, idx) => {
        const isImage = fileUrl.match(/\\.(jpeg|jpg|gif|png|webp)/i);
        const isVideo = fileUrl.match(/\\.(mp4|webm|ogg|mov)/i);
        
        if (isImage) {
          embedHtml += `
            <div class="comment-embed">
              <img src="${fileUrl}" alt="Attachment ${idx + 1}">
              <a href="${fileUrl}" target="_blank">🔗 View Image ${idx + 1}</a>
            </div>
          `;
        } else if (isVideo) {
          embedHtml += `
            <div class="comment-embed">
              <video src="${fileUrl}" controls muted></video>
              <a href="${fileUrl}" target="_blank">🎬 View Video ${idx + 1}</a>
            </div>
          `;
        } else {
          embedHtml += `
            <div class="comment-embed">
              <a href="${fileUrl}" target="_blank">📄 Download File ${idx + 1}</a>
            </div>
          `;
        }
      });
      embedHtml += '</div>';
    }

    // Clean bracket tags from textual display
    const cleanContent = c.content ? c.content.replace(/\\[ATTACHMENT:\\s*[^\\]\\s]+\\]/g, '').trim() : '';

    return `
      <div class="comment-card" style="${isSelf ? 'border-color: var(--accent);' : ''}">
        <div class="comment-meta">
          <strong>${sender} ${isSelf ? '(You)' : ''}</strong>
          <span>${timestamp}</span>
        </div>
        <div class="comment-content">${escapeHtml(cleanContent)}</div>
        ${embedHtml}
      </div>
    `;
  }).join('');
  
  box.scrollTop = box.scrollHeight;
}

window.handleCommentAttachment = async function(input) {
  if (input.files) {
    for (let i = 0; i < input.files.length; i++) {
      pendingCommentAttachments.push(input.files[i]);
    }
    input.value = ''; // Reset input to allow re-selecting same files
    renderPendingAttachmentsList();
  }
};

function renderPendingAttachmentsList() {
  const indicator = document.getElementById('commentAttachmentName');
  
  if (pendingCommentAttachments.length === 0) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'block';
  const fileNames = pendingCommentAttachments.map(f => f.name).join(', ');
  indicator.textContent = `📎 ${pendingCommentAttachments.length} attachment(s): ${fileNames}`;
}

window.removePendingAttachment = function(index) {
  pendingCommentAttachments.splice(index, 1);
  renderPendingAttachmentsList();
};

window.postCommentText = async function() {
  const input = document.getElementById('commentText');
  const text = input.value.trim();
  
  if (!text && pendingCommentAttachments.length === 0) return;

  const sendBtn = document.getElementById('sendCommentBtn');
  sendBtn.disabled = true;

  try {
    let finalContent = text;
    let attachmentUrls = [];

    if (pendingCommentAttachments.length > 0) {
      const uploadPromises = pendingCommentAttachments.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `comments/${currentQuest.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data, error } = await sb.storage
          .from('quest-images')
          .upload(fileName, file);

        if (error) throw error;

        const { data: publicData } = sb.storage
          .from('quest-images')
          .getPublicUrl(fileName);

        return publicData.publicUrl;
      });

      attachmentUrls = await Promise.all(uploadPromises);
      
      // Append attachment URLs to content for backwards compatibility
      attachmentUrls.forEach(url => {
        finalContent = `${finalContent} [ATTACHMENT:${url}]`.trim();
      });
    }

    input.value = '';
    pendingCommentAttachments = [];
    document.getElementById('commentAttachmentName').style.display = 'none';

    const { error } = await sb
      .from('quest_comments')
      .insert({
        quest_id: currentQuest.id,
        user_id: currentUser.id,
        content: finalContent,
        attachment_urls: attachmentUrls // Store as array in new column
      });

    if (error) {
      showAlert('Message posting failed.', 'error');
    }
  } catch (err) {
    console.error(err);
    showAlert(`Upload failed: ${err.message}`, 'error');
  } finally {
    sendBtn.disabled = false;
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
    showAlert('Select score rating stars first.', 'error');
    return;
  }

  try {
    const { error } = await sb.rpc('submit_rating', {
      p_quest_id: currentQuest.id,
      p_score: currentRatingValue
    });

    if (error) {
      showAlert('Failed to register review score: ' + error.message, 'error');
      return;
    }

    showAlert('Your review feedback is registered!', 'success');
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
