// ============================================
// KINDRED GUILD — QUEST EDIT CONTROLLER
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentQuest = null;
let editMode = false;

function getQuestId() {
  const params = new URLSearchParams(window.location.search);
  const rawId = params.get('id');
  if (!rawId || rawId === 'null' || rawId === 'undefined') return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(rawId) ? rawId : null;
}

function showMessage(text, type) {
  const box = document.getElementById('editMessage');
  if (box) {
    box.textContent = text;
    box.className = 'message ' + (type || 'error');
  }
}

function clearMessage() {
  const box = document.getElementById('editMessage');
  if (box) box.className = 'message';
}

(async function init() {
  const questId = getQuestId();
  if (!questId) {
    showMessage('Invalid quest ID.', 'error');
    return;
  }

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  await loadQuestForEdit(questId);
})();

async function loadQuestForEdit(questId) {
  const { data: quest, error } = await sb
    .from('quests')
    .select('*')
    .eq('id', questId)
    .single();

  if (error || !quest) {
    showMessage('Quest not found.', 'error');
    return;
  }

  if (quest.poster_id !== currentUser.id) {
    showMessage('You can only edit your own quests.', 'error');
    return;
  }

  if (!['open', 'accepted'].includes(quest.status)) {
    showMessage('This quest cannot be edited in its current status.', 'error');
    return;
  }

  currentQuest = quest;
  populateEditForm();
}

function populateEditForm() {
  const q = currentQuest;
  document.getElementById('editTitle').value = q.title || '';
  document.getElementById('editDescription').value = q.description || '';
  document.getElementById('editTags').value = (q.tags || []).join(', ');
  
  if (q.payment_type === 'coins') {
    document.getElementById('editCoinAmount').value = q.coin_amount || 0;
  } else if (q.payment_type === 'upi') {
    document.getElementById('editUpiAmount').value = q.upi_amount || 0;
  }
}

window.toggleEditMode = function() {
  editMode = !editMode;
  const form = document.getElementById('editForm');
  const btn = document.getElementById('toggleEditBtn');
  
  if (editMode) {
    form.style.display = 'block';
    btn.textContent = 'Cancel Editing';
  } else {
    form.style.display = 'none';
    btn.textContent = 'Edit Quest';
    clearMessage();
  }
};

window.saveQuestChanges = async function() {
  clearMessage();
  
  const title = document.getElementById('editTitle').value.trim();
  const description = document.getElementById('editDescription').value.trim();
  const rawTags = document.getElementById('editTags').value.trim();
  
  if (!title || !description) {
    showMessage('Title and description are required.', 'error');
    return;
  }

  const tags = rawTags
    .split(/[,\s]+/)
    .map(t => {
      t = t.trim();
      if (!t) return null;
      if (!t.startsWith('#')) t = '#' + t;
      return t;
    })
    .filter(t => t !== null);

  let coinAmount = null;
  let upiAmount = null;

  if (currentQuest.payment_type === 'coins') {
    coinAmount = parseInt(document.getElementById('editCoinAmount').value) || 0;
    if (coinAmount <= 0) {
      showMessage('Coin amount must be greater than 0.', 'error');
      return;
    }
  } else if (currentQuest.payment_type === 'upi') {
    upiAmount = parseInt(document.getElementById('editUpiAmount').value) || 0;
    if (upiAmount <= 0) {
      showMessage('UPI amount must be greater than 0.', 'error');
      return;
    }
  }

  const btn = document.getElementById('saveEditBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const { error } = await sb.rpc('edit_quest', {
      p_quest_id: currentQuest.id,
      p_title: title,
      p_description: description,
      p_tags: tags,
      p_coin_amount: coinAmount,
      p_upi_amount: upiAmount
    });

    if (error) {
      showMessage('Error: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save Changes';
      return;
    }

    showMessage('Quest updated successfully!', 'success');
    editMode = false;
    document.getElementById('editForm').style.display = 'none';
    document.getElementById('toggleEditBtn').textContent = 'Edit Quest';
    
    // Refresh the quest data
    await loadQuestForEdit(currentQuest.id);
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (err) {
    showMessage('Unexpected error occurred.', 'error');
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
};

window.cancelQuest = async function() {
  if (!confirm('Are you sure? This will refund your reward and commission.')) {
    return;
  }

  const btn = document.getElementById('cancelQuestBtn');
  btn.disabled = true;
  btn.textContent = 'Cancelling...';

  try {
    const { error } = await sb.rpc('soft_delete_quest', {
      p_quest_id: currentQuest.id
    });

    if (error) {
      showMessage('Error: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Cancel Quest';
      return;
    }

    showMessage('Quest cancelled and refunded!', 'success');
    setTimeout(() => {
      window.location.href = 'quest-board.html';
    }, 1500);

  } catch (err) {
    showMessage('Unexpected error occurred.', 'error');
    btn.disabled = false;
    btn.textContent = 'Cancel Quest';
  }
};
