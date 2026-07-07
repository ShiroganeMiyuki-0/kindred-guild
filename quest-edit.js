// ============================================
// KINDRED GUILD — QUEST EDIT CONTROLLER
// Uses shared window.sb from supabase-client.js
// ============================================

let currentUser = null;
let currentQuest = null;

function getQuestId() {
  const rawId = getUrlParam('id');
  return isValidUuid(rawId) ? rawId : null;
}

function showMessage(text, type) {
  const box = document.getElementById('editMessage');
  if (box) { box.textContent = text; box.className = 'message ' + (type || 'error'); }
}

function clearMessage() {
  const box = document.getElementById('editMessage');
  if (box) box.className = 'message';
}

(async function init() {
  const questId = getQuestId();
  if (!questId) { showMessage('Invalid quest ID.', 'error'); return; }

  const user = await window.requireAuth();
  if (!user) return;
  currentUser = user;

  const { data: quest, error } = await window.sb.from('quests').select('*').eq('id', questId).single();
  if (error || !quest) { showMessage('Quest not found.', 'error'); return; }
  if (quest.poster_id !== currentUser.id) { showMessage('You can only edit your own quests.', 'error'); return; }
  if (!['open', 'accepted'].includes(quest.status)) { showMessage('This quest cannot be edited in its current status.', 'error'); return; }

  currentQuest = quest;
  document.getElementById('editTitle').value = quest.title || '';
  document.getElementById('editDescription').value = quest.description || '';
  document.getElementById('editTags').value = (quest.tags || []).join(', ');
  document.getElementById('editPaymentType').value = quest.payment_type || 'free';
  handlePaymentTypeChange();
  if (quest.payment_type === 'coins') document.getElementById('editCoinAmount').value = quest.coin_amount || 0;
  if (quest.payment_type === 'upi') document.getElementById('editUpiAmount').value = quest.upi_amount || 0;
})();

window.handlePaymentTypeChange = function () {
  const type = document.getElementById('editPaymentType').value;
  document.getElementById('coinInputGroup').style.display = type === 'coins' ? 'block' : 'none';
  document.getElementById('upiInputGroup').style.display = type === 'upi' ? 'block' : 'none';
};

window.saveQuestChanges = async function () {
  clearMessage();
  const title = document.getElementById('editTitle').value.trim();
  const description = document.getElementById('editDescription').value.trim();
  const rawTags = document.getElementById('editTags').value.trim();
  const paymentType = document.getElementById('editPaymentType').value;

  if (!title || !description) { showMessage('Title and description are required.', 'error'); return; }

  const tags = rawTags.split(/[,\s]+/).map(t => { t = t.trim(); if (!t) return null; if (!t.startsWith('#')) t = '#' + t; return t; }).filter(Boolean);

  let coinAmount = null, upiAmount = null;
  if (paymentType === 'coins') {
    coinAmount = parseInt(document.getElementById('editCoinAmount').value) || 0;
    if (coinAmount <= 0) { showMessage('Coin amount must be > 0.', 'error'); return; }
  } else if (paymentType === 'upi') {
    upiAmount = parseInt(document.getElementById('editUpiAmount').value) || 0;
    if (upiAmount <= 0) { showMessage('UPI amount must be > 0.', 'error'); return; }
  }

  const btn = document.getElementById('saveEditBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const { error } = await window.sb.rpc('edit_quest', {
      p_quest_id: currentQuest.id, p_title: title, p_description: description,
      p_tags: tags, p_payment_type: paymentType, p_coin_amount: coinAmount, p_upi_amount: upiAmount
    });
    if (error) { showMessage('Error: ' + error.message, 'error'); btn.disabled = false; btn.textContent = 'Save Changes'; return; }
    showMessage('Quest updated!', 'success');
    setTimeout(() => window.location.reload(), 1200);
  } catch (err) {
    showMessage('Something went wrong.', 'error');
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
};

window.cancelQuest = async function () {
  if (!confirm('Cancel this quest and get a refund?')) return;
  const btn = document.getElementById('cancelQuestBtn');
  btn.disabled = true; btn.textContent = 'Cancelling...';

  try {
    const { error } = await window.sb.rpc('soft_delete_quest', { p_quest_id: currentQuest.id });
    if (error) { showMessage('Error: ' + error.message, 'error'); btn.disabled = false; btn.textContent = 'Cancel Quest'; return; }
    showMessage('Quest cancelled and refunded!', 'success');
    setTimeout(() => window.location.href = 'quest-board.html', 1500);
  } catch (err) {
    showMessage('Something went wrong.', 'error');
    btn.disabled = false; btn.textContent = 'Cancel Quest';
  }
};
