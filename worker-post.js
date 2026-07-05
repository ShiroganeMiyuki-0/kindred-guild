// ============================================
// KINDRED GUILD — WORKER AVAILABILITY CONTROLLER
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || 'error');
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
}

(async function init() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  const { data: profile } = await sb
    .from('user_profiles')
    .select('username, display_name')
    .eq('user_id', user.id)
    .single();

  const name = profile?.display_name || profile?.username || 'Guild Member';
  document.getElementById('userName').textContent = name;

  loadWorkerPosts();
})();

function parseAndFormatTags(rawText) {
  if (!rawText) return [];
  const elements = rawText.split(/[,\s]+/);
  return elements
    .map(el => {
      let cleaned = el.trim();
      if (!cleaned) return null;
      if (!cleaned.startsWith('#')) {
        cleaned = '#' + cleaned;
      }
      return cleaned.charAt(0) + cleaned.slice(1);
    })
    .filter(el => el !== null);
}

function setWorkerFormMode(post) {
  editingWorkerPostId = post?.id || null;
  submitBtn.textContent = editingWorkerPostId ? 'Save Availability Changes' : 'Post Availability';
  titleInput.value = post?.title || '';
  descInput.value = post?.description || '';
  tagsInput.value = (post?.tags || []).join(', ');
  paymentInput.value = post?.preferred_payment || 'any';
  minRewardInput.value = post?.min_reward || '';
  document.querySelector('.post-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.handleSubmitWorkerPost = async function() {
  clearMessage();

  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  const rawTags = tagsInput.value.trim();
  const preferredPayment = paymentInput.value;
  const minReward = parseInt(minRewardInput.value) || 0;

  if (!title || !description) {
    showMessage('Please complete required fields.', 'error');
    return;
  }

  const formattedTags = parseAndFormatTags(rawTags);

  submitBtn.disabled = true;
  submitBtn.textContent = editingWorkerPostId ? 'Saving...' : 'Posting...';

  try {
    const rpcName = editingWorkerPostId ? 'edit_worker_availability' : 'post_worker_availability';
    const payload = {
      p_title: title,
      p_description: description,
      p_tags: formattedTags,
      p_preferred_payment: preferredPayment,
      p_min_reward: minReward
    };
    if (editingWorkerPostId) payload.p_post_id = editingWorkerPostId;

    const { data: postId, error } = await sb.rpc(rpcName, payload);

    if (error) {
      showMessage(error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = editingWorkerPostId ? 'Save Availability Changes' : 'Post Availability';
      return;
    }

    showMessage(editingWorkerPostId ? 'Your availability has been updated!' : 'Your availability has been posted!', 'success');
    titleInput.value = '';
    descInput.value = '';
    tagsInput.value = '';
    paymentInput.value = 'any';
    minRewardInput.value = '';
    editingWorkerPostId = null;
    submitBtn.textContent = 'Post Availability';

    setTimeout(() => {
      loadWorkerPosts();
    }, 1000);

  } catch (err) {
    showMessage('Unexpected error occurred.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = editingWorkerPostId ? 'Save Availability Changes' : 'Post Availability';
  }
};

async function loadWorkerPosts() {
  const { data, error } = await sb
    .from('worker_posts')
    .select(`
      id, title, description, tags, preferred_payment, min_reward, created_at, user_id,
      user:user_profiles!worker_posts_user_id_fkey(username, display_name, reputation_score)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch error:', error);
    workerGrid.innerHTML = '<div class="empty-state"><h2>Error loading posts</h2></div>';
    return;
  }

  workerPosts = data || [];
  renderWorkerPosts();
}

function renderWorkerPosts() {
  if (workerPosts.length === 0) {
    workerGrid.innerHTML = `
      <div class="empty-state">
        <h2>No Adventurers Available</h2>
        <p>Be the first to post your availability!</p>
      </div>
    `;
    return;
  }

  workerGrid.innerHTML = workerPosts.map(post => {
    const isOwn = post.user_id === currentUser?.id;
    const workerName = post.user?.display_name || post.user?.username || 'Unknown';
    const rep = post.user?.reputation_score ? (post.user.reputation_score / 10).toFixed(1) : '0.0';
    const paymentBadge = post.preferred_payment === 'coins' ? '🪙 Coins' :
                         post.preferred_payment === 'upi' ? '₹ UPI' :
                         post.preferred_payment === 'free' ? '🎁 Free' : 'Any';
    const minRewardText = post.min_reward > 0 ? `Min: ${post.min_reward}` : 'Flexible';

    const tagsHtml = post.tags && post.tags.length > 0 ? `
      <div class="card-tags">
        ${post.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
      </div>
    ` : '';

    let actionButtonHtml = '';
    if (isOwn) {
      actionButtonHtml = `
        <div style="display: flex; gap: 8px;">
          <button class="action-btn" onclick="editWorkerPost('${post.id}')">Edit</button>
          <button class="action-btn own" onclick="deleteWorkerPost('${post.id}')">Delete</button>
        </div>
      `;
    } else {
      actionButtonHtml = `
        <button class="action-btn" onclick="contactWorker('${post.id}', '${workerName}')">
          Contact Worker
        </button>
      `;
    }

    return `
      <div class="worker-card">
        <div class="card-body">
          <span class="badge badge-worker">${paymentBadge}</span>
          <h3>${escapeHtml(post.title)}</h3>
          <div class="worker-info">by <a href="profile.html?username=${post.user?.username}">${escapeHtml(workerName)}</a> ⭐ ${rep}/5</div>
          <div class="description">${escapeHtml(post.description)}</div>
          ${tagsHtml}
        </div>
        <div class="card-footer">
          <div class="meta">
            <span class="min-reward">${minRewardText}</span>
          </div>
          ${actionButtonHtml}
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.editWorkerPost = function(postId) {
  const post = workerPosts.find(item => item.id === postId);
  if (!post) return;
  clearMessage();
  setWorkerFormMode(post);
};

window.deleteWorkerPost = async function(postId) {
  if (!confirm('Delete this availability post?')) {
    return;
  }

  try {
    const { error } = await sb.rpc('soft_delete_worker_post', {
      p_post_id: postId
    });

    if (error) {
      showMessage('Error: ' + error.message, 'error');
      return;
    }

    showMessage('Post deleted!', 'success');
    loadWorkerPosts();

  } catch (err) {
    showMessage('Unexpected error occurred.', 'error');
  }
};

window.contactWorker = function(postId, workerName) {
  alert(`Feature coming soon! You would contact ${workerName} here.`);
};
