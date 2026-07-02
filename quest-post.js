// ============================================
// KINDRED GUILD — QUEST POSTING CONTROLLER
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let coinBalance = 0;
let selectedType = 'coins';
let pendingFormData = null;

const titleInput = document.getElementById('title');
const descInput = document.getElementById('description');
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

  const { data: balanceData } = await sb.rpc('get_coin_balance', { p_user_id: user.id });
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

window.selectPayment = function(type) {
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
    const amount = parseInt(coinAmountInput.value) || 0;
    const commission = Math.ceil(amount * 0.1);
    commissionCoinsEl.textContent = commission;
  } else if (selectedType === 'upi') {
    const amount = parseInt(upiAmountInput.value) || 0;
    const commission = Math.ceil(amount * 0.1);
    commissionUpiEl.textContent = commission;
  }
}

coinAmountInput.addEventListener('input', updateCommission);
upiAmountInput.addEventListener('input', updateCommission);

window.handleSubmit = async function() {
  clearMessage();

  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  const datePart = deadlineDateInput.value;
  const timePart = deadlineTimeInput.value;

  if (!title || !description || !datePart || !timePart) {
    showMessage('Please fill in all fields.', 'error');
    return;
  }

  const deadlineDate = new Date(`${datePart}T${timePart}`);
  if (deadlineDate <= new Date()) {
    showMessage('Deadline must be in the future.', 'error');
    return;
  }

  let coinAmount = 0;
  let upiAmount = 0;
  let commissionCoins = 0;

  if (selectedType === 'coins') {
    coinAmount = parseInt(coinAmountInput.value) || 0;
    if (coinAmount <= 0) {
      showMessage('Enter a valid coin amount.', 'error');
      return;
    }
    commissionCoins = Math.ceil(coinAmount * 0.1);
    if (coinBalance < coinAmount + commissionCoins) {
      showMessage('Insufficient Coins. You need ' + (coinAmount + commissionCoins) + ' FC.', 'error');
      return;
    }
  } else if (selectedType === 'upi') {
    upiAmount = parseInt(upiAmountInput.value) || 0;
    if (upiAmount <= 0) {
      showMessage('Enter a valid UPI amount.', 'error');
      return;
    }
    commissionCoins = Math.ceil(upiAmount * 0.1);
    if (coinBalance < commissionCoins) {
      showMessage('Insufficient Coins. You need ' + commissionCoins + ' FC safety commission.', 'error');
      return;
    }
    pendingFormData = { title, description, deadlineDate, coinAmount, upiAmount, commissionCoins };
    upiModal.classList.add('active');
    return;
  }

  await postQuest({ title, description, deadlineDate, coinAmount, upiAmount, commissionCoins });
};

window.confirmUpiPost = async function() {
  if (!pendingFormData) {
    upiModal.classList.remove('active');
    return;
  }
  const data = pendingFormData;
  pendingFormData = null;
  upiModal.classList.remove('active');
  await postQuest(data);
};

window.closeUpiModal = function() {
  pendingFormData = null;
  upiModal.classList.remove('active');
};

async function postQuest({ title, description, deadlineDate, coinAmount, upiAmount, commissionCoins }) {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting...';

  try {
    const { data: questId, error } = await sb.rpc('post_quest_with_commission', {
      p_title: title,
      p_description: description,
      p_payment_type: selectedType,
      p_coin_amount: coinAmount,
      p_upi_amount: upiAmount,
      p_commission_coins: commissionCoins,
      p_deadline: deadlineDate.toISOString()
    });

    if (error) {
      showMessage(error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Quest';
      return;
    }

    showMessage('Quest posted successfully! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'quest-board.html', 1500);

  } catch (err) {
    showMessage('Unexpected error occured.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Quest';
  }
}
