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
    showMessage('Invalid quest parameters detected.', 'error');
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
    showMessage('Guild quest parameters could not be found.', 'error');
    return;
  }

  if (quest.poster_id !== currentUser.id) {
    showMessage('You are unauthorized to update external quest parameters.', 'error');
    return;
  }

  if (!['open', 'accepted'].includes(quest.status)) {
    showMessage('This quest is currently being audited and is no longer reversible.', 'error');
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
  
  document.getElementById('editPaymentType').value = q.payment_type || 'free';
  handlePaymentTypeChange();

  if (q.payment_type === 'coins') {
    document.getElementById('editCoinAmount').value = q.coin_amount || 0;
  } else if (q.payment_type === 'upi') {
    document.getElementById('editUpiAmount').value = q.upi_amount || 0;
  }
}

window.handlePaymentTypeChange = function() {
  const type = document.getElementById('editPaymentType').value;
  document.getElementById('coinInputGroup').style.display = type === 'coins' ? 'block' : 'none';
  document.getElementById('upiInputGroup').style.display = type === 'upi' ? 'block' : 'none';
};

window.saveQuestChanges = async function() {
  clearMessage();
  
  const title = document.getElementById('editTitle').value.trim();
  const description = document.getElementById('editDescription').value.trim();
  const rawTags = document.getElementById('editTags').value.trim();
  const paymentType = document.getElementById('editPaymentType').value;
  
  if (!title || !description) {
    showMessage('Title and parameters must not be empty.', 'error');
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

  if (paymentType === 'coins') {
    coinAmount = parseInt(document.getElementById('editCoinAmount').value) || 0;
    if (coinAmount <= 0) {
      showMessage('Appraisal coins reward must be positive.', 'error');
      return;
    }
  } else if (paymentType === 'upi') {
    upiAmount = parseInt(document.getElementById('editUpiAmount').value) || 0;
    if (upiAmount <= 0) {
      showMessage('Appraisal UPI valuation must be positive.', 'error');
      return;
    }
  }

  const btn = document.getElementById('saveEditBtn');
  btn.disabled = true;
  btn.textContent = 'Recording Appraisal...';

  try {
    const { error } = await sb.rpc('edit_quest', {
      p_quest_id: currentQuest.id,
      p_title: title,
      p_description: description,
      p_tags: tags,
      p_payment_type: paymentType,
      p_coin_amount: coinAmount,
      p_upi_amount: upiAmount
    });

    if (error) {
      showMessage('Appraisal Adjustment Failure: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save Changes';
      return;
    }

    showMessage('Quest appraised and updated successfully!', 'success');
    
    setTimeout(() => {
      window.location.href = 'quest-detail.html?id=' + currentQuest.id;
    }, 1500);

  } catch (err) {
    showMessage('Unexpected server alignment error.', 'error');
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
};

window.cancelQuest = async function() {
  if (!confirm('Cancel this quest? Locked rewards and platforms commissions will be instantly refunded to your ledger balance.')) {
    return;
  }

  const btn = document.getElementById('cancelQuestBtn');
  btn.disabled = true;
  btn.textContent = 'Cancelling Quest...';

  try {
    const { error } = await sb.rpc('soft_delete_quest', {
      p_quest_id: currentQuest.id
    });

    if (error) {
      showMessage('Quest Forfeit Error: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Cancel Quest';
      return;
    }

    showMessage('Quest successfully cancelled. Commissions and rewards refunded to ledger.', 'success');
    setTimeout(() => {
      window.location.href = 'quest-board.html';
    }, 1500);

  } catch (err) {
    showMessage('Unexpected server mapping error occurred.', 'error');
    btn.disabled = false;
    btn.textContent = 'Cancel Quest';
  }
};