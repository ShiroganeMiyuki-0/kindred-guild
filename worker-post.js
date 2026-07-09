// ============================================
// KINDRED GUILD — WORKER AVAILABILITY CONTROLLER
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Uses shared window.sb from supabase-client.js
// ============================================

let currentUser = null;
let workerPosts = [];
let editingWorkerPostId = null;

const titleInput = document.getElementById('workerTitle');
const descInput = document.getElementById('workerDescription');
const tagsInput = document.getElementById('workerTags');
const paymentInput = document.getElementById('preferredPayment');
const minRewardInput = document.getElementById('minReward');
const submitBtn = document.getElementById('submitWorkerPostBtn');
const messageEl = document.getElementById('workerMessage');
const workerGrid = document.getElementById('workerGrid');

function showMessage(text, type) { messageEl.textContent = text; messageEl.className = 'message ' + (type || 'error'); }
function clearMessage() { messageEl.className = 'message'; messageEl.textContent = ''; }

(async function init() {
  const user = await window.requireAuth();
  if (!user) return;
  currentUser = user;

  const profile = await window.getUserProfile(user.id);
  document.getElementById('userName').textContent = profile?.display_name || profile?.username || 'Member';
  loadWorkerPosts();
})();

function parseAndFormatTags(raw) {
  if (!raw) return [];
  return raw.split(/[,\s]+/).map(t => { t = t.trim(); if (!t) return null; if (!t.startsWith('#')) t = '#' + t; return t; }).filter(Boolean);
}

function setFormMode(post) {
  editingWorkerPostId = post?.id || null;
  submitBtn.textContent = editingWorkerPostId ? 'Save Changes' : 'Post Availability';
  titleInput.value = post?.title || '';
  descInput.value = post?.description || '';
  tagsInput.value = (post?.tags || []).join(', ');
  paymentInput.value = post?.preferred_payment || 'any';
  minRewardInput.value = post?.min_reward || '';
  document.querySelector('.post-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.handleSubmitWorkerPost = async function () {
  clearMessage();
  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  if (!title || !description) { showMessage('Please fill in title and description.', 'error'); return; }

  const formattedTags = parseAndFormatTags(tagsInput.value.trim());
  const preferredPayment = paymentInput.value;
  const minReward = parseInt(minRewardInput.value) || 0;

  submitBtn.disabled = true;
  submitBtn.textContent = editingWorkerPostId ? 'Saving...' : 'Posting...';

  try {
    const rpcName = editingWorkerPostId ? 'edit_worker_availability' : 'post_worker_availability';
    const payload = { p_title: title, p_description: description, p_tags: formattedTags, p_preferred_payment: preferredPayment, p_min_reward: minReward };
    if (editingWorkerPostId) payload.p_post_id = editingWorkerPostId;

    const { error } = await window.sb.rpc(rpcName, payload);
    if (error) { showMessage(error.message, 'error'); submitBtn.disabled = false; submitBtn.textContent = editingWorkerPostId ? 'Save Changes' : 'Post Availability'; return; }

    showMessage(editingWorkerPostId ? 'Updated!' : 'Posted!', 'success');
    titleInput.value = ''; descInput.value = ''; tagsInput.value = ''; paymentInput.value = 'any'; minRewardInput.value = '';
    editingWorkerPostId = null; submitBtn.textContent = 'Post Availability';
    setTimeout(() => loadWorkerPosts(), 1000);
  } catch (err) {
    showMessage('Something went wrong.', 'error');
    submitBtn.disabled = false; submitBtn.textContent = editingWorkerPostId ? 'Save Changes' : 'Post Availability';
  }
};

async function loadWorkerPosts() {
  const { data, error } = await window.sb
    .from('worker_posts')
    .select('id, title, description, tags, preferred_payment, min_reward, created_at, user_id, user:user_profiles!worker_posts_user_id_fkey(username, display_name, reputation_score)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) { workerGrid.innerHTML = '<div class="empty-state"><h2>Error loading posts</h2></div>'; return; }
  workerPosts = data || [];
  renderWorkerPosts();
}

function renderWorkerPosts() {
  if (workerPosts.length === 0) {
    workerGrid.innerHTML = '<div class="empty-state"><h2>No Adventurers Yet</h2><p>Be the first to post your availability!</p></div>';
    return;
  }

  workerGrid.innerHTML = workerPosts.map(post => {
    const isOwn = post.user_id === currentUser?.id;
    const name = post.user?.display_name || post.user?.username || 'Unknown';
    const rep = post.user?.reputation_score ? (post.user.reputation_score / 10).toFixed(1) : '—';
    const payBadge = post.preferred_payment === 'coins' ? '🪙 Coins' : post.preferred_payment === 'upi' ? '₹ UPI' : post.preferred_payment === 'free' ? '🎁 Free' : 'Any';
    const minText = post.min_reward > 0 ? `Min: ${post.min_reward}` : 'Flexible';
    const tagsHtml = post.tags?.length ? `<div class="card-tags">${post.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>` : '';

    const btn = isOwn
      ? `<div style="display:flex;gap:8px"><button class="btn btn-primary btn-sm" onclick="editWorkerPost('${post.id}')">Edit</button><button class="btn btn-error btn-sm" onclick="deleteWorkerPost('${post.id}')">Delete</button></div>`
      : `<button class="btn btn-primary btn-sm" onclick="contactWorker('${post.id}','${escapeHtml(name)}')">Contact</button>`;

    return `
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <span class="badge badge-coins">${payBadge}</span>
          <h3 style="margin:8px 0 4px">${escapeHtml(post.title)}</h3>
          <div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:8px">by <a href="profile.html?username=${post.user?.username}">${escapeHtml(name)}</a> ⭐ ${rep}</div>
          <div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px">${escapeHtml(post.description)}</div>
          ${tagsHtml}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <span style="font-size:0.85rem;color:var(--accent)">${minText}</span>
          ${btn}
        </div>
      </div>`;
  }).join('');
}

window.editWorkerPost = function (postId) {
  const post = workerPosts.find(p => p.id === postId);
  if (post) { clearMessage(); setFormMode(post); }
};

window.deleteWorkerPost = async function (postId) {
  if (!confirm('Delete this post?')) return;
  const { error } = await window.sb.rpc('soft_delete_worker_post', { p_post_id: postId });
  if (error) { showMessage('Error: ' + error.message, 'error'); return; }
  showMessage('Deleted!', 'success');
  loadWorkerPosts();
};

window.contactWorker = function (postId, name) {
  // Open quest-post with pre-filled context
  window.location.href = 'quest-post.html?worker=' + encodeURIComponent(postId);
};
