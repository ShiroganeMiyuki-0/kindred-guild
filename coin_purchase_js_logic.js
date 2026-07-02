// ============================================
// KINDRED GUILD — COIN PURCHASE CONTROLLER
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

(async function init() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  const { data: balance } = await sb.rpc('get_coin_balance', { p_user_id: user.id });
  document.getElementById('currentBalanceDisplay').textContent = balance || 0;
})();

window.updateQRValue = function() {
  const coins = document.getElementById('coinPackage').value;
  document.getElementById('amountDueSpan').textContent = `₹${coins}`;
};

window.submitPaymentReference = async function() {
  const coins = parseInt(document.getElementById('coinPackage').value);
  const utr = document.getElementById('utrRef').value.trim();

  if (!utr || utr.length < 6) {
    alert('Please insert a valid UPI reference ID.');
    return;
  }

  const btn = document.getElementById('submitPaymentBtn');
  btn.disabled = true;

  const { error } = await sb
    .from('coin_purchases')
    .insert({
      user_id: currentUser.id,
      coin_amount: coins,
      upi_transaction_ref: utr,
      status: 'pending'
    });

  if (error) {
    alert('Failed to submit: ' + error.message);
    btn.disabled = false;
    return;
  }

  const alertBox = document.getElementById('statusAlert');
  alertBox.textContent = "UTR Logged. Coins will be verified and credited within 24 hours.";
  alertBox.style.display = 'block';

  document.getElementById('utrRef').value = '';
};
