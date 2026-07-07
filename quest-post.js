// ============================================
// KINDRED GUILD — QUEST POSTING CONTROLLER
// Uses shared window.sb from supabase-client.js
// ============================================

let currentUser = null;
let coinBalance = 0;
let selectedType = 'coins';
let pendingFormData = null;

const titleInput = document.getElementById('title');
const descInput = document.getElementById('description');
const tagsInput = document.getElementById('tags');
const coinAmountInput = document.getElementById('coinAmount');
const upiAmountInput = document.getElementById('upiAmount');
const deadlineDateInput = document.getElementById('deadlineDate');
const deadlineTimeInput = document.getElementById('deadlineTime');
const submitBtn = document.getElementById('submitBtn');
const messageEl = document.getElementById('message');
const commissionCoinsEl = document.getElementById('commissionCoins');
const commissionUpiEl = document.getElementById('commissionUpi');
const upiModal = document.getElementById('upiModal');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || 'error');
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
}

(async function init() {
  const user = await window.requireAuth();
  if (!user) return;
  currentUser = user;

  const profile = await window.getUserProfile(user.id);
  const name = profile?.display_name || profile?.username || 'Guild Member';
  document.getElementById('userName').textContent = name;

  const { data: balanceData } = await window.sb.rpc('get_coin_balance', { p_user_id: user.id });
  coinBalance = balanceData || 0;
  document.getElementById('coinBalance').textContent = coinBalance;
  document.getElementById('coinBalance2').textContent = coinBalance;
  document.getElementById('coinBalance3').textContent = coinBalance;

  const now = new Date();
  now.setHours(now.getHours() + 1);
  deadlineDateInput.min = now.toISOString().slice(0, 10);
  deadlineDateInput.value = now.toISOString().slice(0, 10);
  deadlineTimeInput.value = now.toTimeString().slice(0, 5);
})();

window.selectPayment = function (type) {
  selectedType = type;
  document.querySelectorAll('.payment-type').forEach(el => el.classList.remove('selected'));
  document.querySelector('[data-type="' + type + '"]').classList.add('selected');
  document.getElementById('coinsInput').classList.toggle('active', type === 'coins');
  document.getElementById('upiInput').classList.toggle('active', type === 'upi');
  coinAmountInput.required = (type === 'coins');
  upiAmountInput.required = (type === 'upi');
  updateCommission();
};

function updateCommission() {
  if (selectedType === 'coins') {
    commissionCoinsEl.textContent = Math.ceil((parseInt(coinAmountInput.value) || 0) * 0.1);
  } else if (selectedType === 'upi') {
    commissionUpiEl.textContent = Math.ceil((parseInt(upiAmountInput.value) || 0) * 0.1);
  }
}

coinAmountInput.addEventListener('input', updateCommission);
upiAmountInput.addEventListener('input', updateCommission);

function parseAndFormatTags(rawText) {
  if (!rawText) return [];
  return rawText.split(/[,\s]+/)
    .map(el => { let c = el.trim(); if (!c) return null; if (!c.startsWith('#')) c = '#' + c; return c; })
    .filter(Boolean);
}

window.handleSubmit = async function () {
  clearMessage();
  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  const rawTags = tagsInput.value.trim();
  const datePart = deadlineDateInput.value;
  const timePart = deadlineTimeInput.value;

  if (!title || !description || !datePart || !timePart) {
    showMessage('Please fill in all required fields.', 'error');
    return;
  }

  const deadlineDate = new Date(`${datePart}T${timePart}`);
  if (deadlineDate <= new Date()) {
    showMessage('Deadline must be in the future.', 'error');
    return;
  }

  const formattedTags = parseAndFormatTags(rawTags);
  let coinAmount = 0, upiAmount = 0, commissionCoins = 0;

  if (selectedType === 'coins') {
    coinAmount = parseInt(coinAmountInput.value) || 0;
    if (coinAmount <= 0) { showMessage('Enter a valid coin amount.', 'error'); return; }
    commissionCoins = Math.ceil(coinAmount * 0.1);
    if (coinBalance < coinAmount + commissionCoins) {
      showMessage('Insufficient balance. Need ' + (coinAmount + commissionCoins) + ' FC.', 'error');
      return;
    }
  } else if (selectedType === 'upi') {
    upiAmount = parseInt(upiAmountInput.value) || 0;
    if (upiAmount <= 0) { showMessage('Enter a valid UPI amount.', 'error'); return; }
    commissionCoins = Math.ceil(upiAmount * 0.1);
    if (coinBalance < commissionCoins) {
      showMessage('Insufficient balance. Need ' + commissionCoins + ' FC commission.', 'error');
      return;
    }
    pendingFormData = { title, description, deadlineDate, coinAmount, upiAmount, commissionCoins, tags: formattedTags };
    upiModal.classList.add('active');
    return;
  }

  await postQuest({ title, description, deadlineDate, coinAmount, upiAmount, commissionCoins, tags: formattedTags });
};

window.confirmUpiPost = async function () {
  if (!pendingFormData) { upiModal.classList.remove('active'); return; }
  const data = pendingFormData;
  pendingFormData = null;
  upiModal.classList.remove('active');
  await postQuest(data);
};

window.closeUpiModal = function () {
  pendingFormData = null;
  upiModal.classList.remove('active');
};

async function postQuest({ title, description, deadlineDate, coinAmount, upiAmount, commissionCoins, tags }) {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting...';

  try {
    const { data: questId, error } = await window.sb.rpc('post_quest_with_commission', {
      p_title: title, p_description: description, p_payment_type: selectedType,
      p_coin_amount: coinAmount, p_upi_amount: upiAmount,
      p_commission_coins: commissionCoins, p_deadline: deadlineDate.toISOString()
    });

    if (error) {
      showMessage(error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Task';
      return;
    }

    if (tags?.length) {
      await window.sb.from('quests').update({ tags }).eq('id', questId);
    }

    showMessage('Task posted! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'quest-board.html', 1200);
  } catch (err) {
    showMessage('Something went wrong. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Task';
  }
}
