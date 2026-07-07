// ============================================
// KINDRED GUILD — COIN PURCHASE CONTROLLER
// Uses shared window.sb from supabase-client.js
// ============================================

const UPI_ID = 'yashwanthrangaswamy72@okhdfcbank';
const PAYEE_NAME = 'Kindred Guild';

let currentUser = null;
let currentPaymentNote = '';

(async function init() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  const { data: balance } = await sb.rpc('get_coin_balance', { p_user_id: user.id });
  document.getElementById('currentBalanceDisplay').textContent = balance || 0;

  loadPendingPurchases();
  updatePaymentDetails();
})();

function generatePaymentNote(coins) {
  const shortId = currentUser.id.slice(0, 8).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `KINDRED-${shortId}-${coins}FC-${timestamp}`;
}

function generateUpiLink(amount, note) {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: PAYEE_NAME,
    am: amount,
    cu: 'INR',
    tn: note
  });
  return `upi://pay?${params.toString()}`;
}

function generateQrUrl(amount, note) {
  const upiLink = generateUpiLink(amount, note);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
}

window.updatePaymentDetails = function() {
  const coins = parseInt(document.getElementById('coinPackage').value);
  const amount = coins;

  document.getElementById('amountDueSpan').textContent = `₹${amount}`;
  currentPaymentNote = generatePaymentNote(coins);
  document.getElementById('paymentNote').textContent = currentPaymentNote;

  const upiLink = generateUpiLink(amount, currentPaymentNote);
  document.getElementById('upiLink').href = upiLink;

  document.getElementById('qrImage').src = generateQrUrl(amount, currentPaymentNote);
};

window.copyUpiLink = function() {
  const coins = parseInt(document.getElementById('coinPackage').value);
  const amount = coins;
  const upiLink = generateUpiLink(amount, currentPaymentNote);
  
  navigator.clipboard.writeText(upiLink).then(() => {
    showAlert('UPI payment link copied! Share it with any UPI app.', 'info');
  }).catch(() => {
    showAlert('Failed to copy. Please use the Pay button instead.', 'info');
  });
};

window.submitPaymentReference = async function() {
  const coins = parseInt(document.getElementById('coinPackage').value);
  const utr = document.getElementById('utrRef').value.trim();

  const btn = document.getElementById('submitPaymentBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging...';

  const { error } = await sb
    .from('coin_purchases')
    .insert({
      user_id: currentUser.id,
      coin_amount: coins,
      upi_transaction_ref: utr || null,
      payment_note: currentPaymentNote,
      status: 'pending'
    });

  if (error) {
    showAlert('Failed to submit: ' + error.message, 'info');
    btn.disabled = false;
    btn.innerHTML = '✅ I\'ve Paid — Log My Purchase';
    return;
  }

  showAlert(
    `✅ Purchase logged successfully!${utr ? ' Your UTR has been recorded.' : ''} ` +
    `Please include payment note "${currentPaymentNote}" in your UPI app if you haven't paid yet. ` +
    `Coins will be credited within 24 hours after admin verification.`,
    'success'
  );

  document.getElementById('utrRef').value = '';
  btn.disabled = false;
  btn.innerHTML = '✅ I\'ve Paid — Log My Purchase';

  updatePaymentDetails();
  loadPendingPurchases();
};

async function loadPendingPurchases() {
  const { data, error } = await sb
    .from('coin_purchases')
    .select('id, coin_amount, upi_transaction_ref, payment_note, status, created_at')
    .eq('user_id', currentUser.id)
    .in('status', ['pending', 'verified'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !data || data.length === 0) {
    document.getElementById('pendingList').style.display = 'none';
    return;
  }

  document.getElementById('pendingList').style.display = 'block';
  const container = document.getElementById('pendingItems');
  
  container.innerHTML = data.map(p => {
    const date = new Date(p.created_at).toLocaleString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const statusClass = p.status === 'verified' ? 'status-verified' : 'status-pending';
    const statusText = p.status === 'verified' ? 'Verified & Credited' : 'Pending Verification';
    
    return `
      <div class="pending-item">
        <div><strong>${p.coin_amount} FC</strong> — ₹${p.coin_amount}</div>
        <div class="time">${date}</div>
        ${p.payment_note ? `<div style="font-family: monospace; font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Note: ${p.payment_note}</div>` : ''}
        ${p.upi_transaction_ref ? `<div style="font-family: monospace; font-size: 0.75rem; color: var(--muted);">UTR: ${p.upi_transaction_ref}</div>` : ''}
        <span class="status ${statusClass}">${statusText}</span>
      </div>
    `;
  }).join('');
}

function showAlert(message, type) {
  const alertBox = document.getElementById('statusAlert');
  alertBox.textContent = message;
  alertBox.className = `status-alert ${type}`;
  
  if (type === 'info') {
    setTimeout(() => {
      alertBox.className = 'status-alert';
    }, 10000);
  }
}
