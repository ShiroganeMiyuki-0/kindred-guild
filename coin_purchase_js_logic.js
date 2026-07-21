// ============================================
// KINDRED GUILD — COIN PURCHASE CONTROLLER
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Uses shared window.sb from supabase-client.js
// ============================================

const UPI_ID = 'yashwanthrangaswamy72@okhdfcbank';
const PAYEE_NAME = 'Kindred Guild';

// USD price per coin package. These are the BASE prices (= the INR value
// converted to USD at your chosen rate). The price the international user
// is actually charged is computed at runtime from BASE_PRICES via
// computeChargeUsd() so that you end up with PLATFORM_PROFIT_MARGIN
// (default 10%) of net profit AFTER PayPal's processing fee.
const BASE_USD_PRICES = {
  100: 1.20,
  200: 2.40,
  500: 6.00,
  1000: 12.00,
};

// PayPal India rates for international commercial transactions (2026):
//   4.4% + USD 0.30 fixed fee per transaction.
// Update these if PayPal changes their schedule, or if you want to
// over-/under-charge to absorb the fee yourself as a goodwill gesture.
const PAYPAL_FEE_PERCENT     = 0.044;   // 4.4%
const PAYPAL_FIXED_FEE_USD   = 0.30;

// How much NET profit you want to keep, expressed as a fraction of the
// base price. 0.10 = "I want to end up with 10% above the base price
// after PayPal takes their cut."
const PLATFORM_PROFIT_MARGIN = 0.10;

// Compute what to charge the user, broken down by line item.
//   baseUsd     — the fair USD value of the coins
//   paypalFee   — (charged * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE_USD
//   margin      — baseUsd * PLATFORM_PROFIT_MARGIN
//   charged     — baseUsd + paypalFee + margin (what the user pays)
//   netReceived — charged - paypalFee (what you keep after PayPal)
//   profit      — netReceived - baseUsd (should equal baseUsd * margin)
function computeChargeUsd(baseUsd) {
  // Solve for `charged` such that:
  //   charged - (charged * PAYPAL_FEE_PERCENT + PAYPAL_FIXED_FEE_USD) = baseUsd * (1 + PLATFORM_PROFIT_MARGIN)
  // => charged = (baseUsd * (1 + margin) + PAYPAL_FIXED_FEE_USD) / (1 - PAYPAL_FEE_PERCENT)
  const target = baseUsd * (1 + PLATFORM_PROFIT_MARGIN);
  const charged = (target + PAYPAL_FIXED_FEE_USD) / (1 - PAYPAL_FEE_PERCENT);
  const paypalFee = charged * PAYPAL_FEE_PERCENT + PAYPAL_FIXED_FEE_USD;
  const netReceived = charged - paypalFee;
  const margin = netReceived - baseUsd;
  return {
    baseUsd: round2(baseUsd),
    paypalFee: round2(paypalFee),
    paypalFeePercent: PAYPAL_FEE_PERCENT * 100,
    platformMargin: round2(margin),
    platformMarginPercent: PLATFORM_PROFIT_MARGIN * 100,
    charged: round2(charged),
    netReceived: round2(netReceived),
    profit: round2(margin),
  };
}
function round2(n) { return Math.round(n * 100) / 100; }

// Lookup table keyed by coin count, populated from BASE_USD_PRICES.
function buildPackagePricing() {
  const out = {};
  for (const coins of Object.keys(BASE_USD_PRICES)) {
    out[coins] = computeChargeUsd(BASE_USD_PRICES[coins]);
  }
  return out;
}
const PACKAGE_PRICING = buildPackagePricing();

// What the user actually pays in USD (the "headline" price). Exposed for
// the PayPal module so it charges the right amount.
function getChargedUsd(coins) {
  return PACKAGE_PRICING[coins]?.charged || 0;
}

// Expose on window so the PayPal module can read the same numbers
window.PACKAGE_USD_PRICES = PACKAGE_PRICING;  // backward-compat (now broken-down objects)
window.PACKAGE_CHARGED_USD = PACKAGE_PRICING; // explicit name
window.PAYPAL_FEE_PERCENT = PAYPAL_FEE_PERCENT;
window.PAYPAL_FIXED_FEE_USD = PAYPAL_FIXED_FEE_USD;
window.PLATFORM_PROFIT_MARGIN = PLATFORM_PROFIT_MARGIN;
window.currentPaymentNote = ''; // updated by updatePaymentDetails()

let currentUser = null;
let currentPaymentNote = '';
let currentRegion = 'upi'; // 'upi' | 'paypal'

(async function init() {
  const { data: { user } } = await window.sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  const { data: balance } = await window.sb.rpc('get_coin_balance', { p_user_id: user.id });
  document.getElementById('currentBalanceDisplay').textContent = balance || 0;

  loadPendingPurchases();
  updatePaymentDetails();

  // Region tab listeners
  const upiTab = document.getElementById('regionUpiTab');
  const ppTab = document.getElementById('regionPaypalTab');
  if (upiTab) upiTab.addEventListener('click', () => window.switchPaymentRegion('upi'));
  if (ppTab) ppTab.addEventListener('click', () => window.switchPaymentRegion('paypal'));

  // Auto-pick region based on URL query (?region=paypal) for deep-linking
  const params = new URLSearchParams(window.location.search);
  const region = params.get('region');
  if (region === 'paypal' || region === 'upi') {
    window.switchPaymentRegion(region);
  }

  // Handle return from PayPal popup (close enough — capture usually already done)
  if (params.get('paypal') === 'return' || params.get('paypal') === 'cancel') {
    if (params.get('paypal') === 'cancel') {
      showAlert('PayPal payment was cancelled. No charge was made.', 'info');
    }
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
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
  const pricing = PACKAGE_PRICING[coins] || { charged: 0, baseUsd: 0, paypalFee: 0, platformMargin: 0, netReceived: 0, paypalFeePercent: 4.4, platformMarginPercent: 10 };
  const usd = pricing.charged;

  document.getElementById('amountDueSpan').textContent = `₹${amount}`;
  currentPaymentNote = generatePaymentNote(coins);
  document.getElementById('paymentNote').textContent = currentPaymentNote;

  const upiLink = generateUpiLink(amount, currentPaymentNote);
  document.getElementById('upiLink').href = upiLink;

  document.getElementById('qrImage').src = generateQrUrl(amount, currentPaymentNote);

  // Update PayPal display
  const usdEl = document.getElementById('paypalAmountUsd');
  const fcEl = document.getElementById('paypalAmountFc');
  if (usdEl) usdEl.textContent = `$${usd.toFixed(2)}`;
  if (fcEl) fcEl.textContent = coins.toLocaleString('en-IN');

  // Update the fee breakdown (if those elements exist)
  const baseEl = document.getElementById('paypalBreakBase');
  const feeEl = document.getElementById('paypalBreakFee');
  const feePctEl = document.getElementById('paypalBreakFeePct');
  const marginEl = document.getElementById('paypalBreakMargin');
  const marginPctEl = document.getElementById('paypalBreakMarginPct');
  const totalEl = document.getElementById('paypalBreakTotal');
  const netEl = document.getElementById('paypalBreakNet');
  if (baseEl) baseEl.textContent = `$${pricing.baseUsd.toFixed(2)}`;
  if (feeEl) feeEl.textContent = `$${pricing.paypalFee.toFixed(2)}`;
  if (feePctEl) feePctEl.textContent = `${pricing.paypalFeePercent.toFixed(2)}% + $${PAYPAL_FIXED_FEE_USD.toFixed(2)}`;
  if (marginEl) marginEl.textContent = `$${pricing.platformMargin.toFixed(2)}`;
  if (marginPctEl) marginPctEl.textContent = `${pricing.platformMarginPercent.toFixed(0)}%`;
  if (totalEl) totalEl.textContent = `$${pricing.charged.toFixed(2)}`;
  if (netEl) netEl.textContent = `$${pricing.netReceived.toFixed(2)}`;

  // Keep window.currentPaymentNote in sync for the PayPal module
  window.currentPaymentNote = currentPaymentNote;

  // Notify the PayPal module (if loaded) so it can refresh its buttons
  if (typeof window.onCoinPackageChanged === 'function') {
    window.onCoinPackageChanged(coins, usd);
  }
};

// ---- Region tabs (UPI / PayPal) ----
window.switchPaymentRegion = function(region) {
  if (region !== 'upi' && region !== 'paypal') return;
  currentRegion = region;

  const upiRegion = document.getElementById('upiRegion');
  const paypalRegion = document.getElementById('paypalRegion');
  const upiTab = document.getElementById('regionUpiTab');
  const ppTab = document.getElementById('regionPaypalTab');
  const hint = document.getElementById('regionHint');

  if (region === 'upi') {
    upiRegion.style.display = '';
    paypalRegion.style.display = 'none';
    upiTab.classList.add('active');
    ppTab.classList.remove('active');
    upiTab.setAttribute('aria-selected', 'true');
    ppTab.setAttribute('aria-selected', 'false');
    hint.textContent = 'UPI works only inside India. Switch to PayPal for international payments.';
  } else {
    upiRegion.style.display = 'none';
    paypalRegion.style.display = '';
    upiTab.classList.remove('active');
    ppTab.classList.add('active');
    upiTab.setAttribute('aria-selected', 'false');
    ppTab.setAttribute('aria-selected', 'true');
    hint.textContent = 'PayPal supports cards and local payment methods in 200+ countries.';
    if (typeof window.ensurePayPalButtonsRendered === 'function') {
      window.ensurePayPalButtonsRendered();
    }
  }
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

  const { error } = await window.sb
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

// Log a PayPal purchase (called from coin_purchase_paypal.js after capture)
window.logPayPalPurchase = async function({ capture_id, payer_email, amount, currency, raw }) {
  const coins = parseInt(document.getElementById('coinPackage').value);
  const utrInput = document.getElementById('utrRef');
  if (utrInput) utrInput.value = ''; // not applicable for PayPal

  // Build a useful reference for the admin to identify the txn
  const ref = `PayPal#${capture_id}`;

  const { data, error } = await window.sb
    .from('coin_purchases')
    .insert({
      user_id: currentUser.id,
      coin_amount: coins,
      upi_transaction_ref: null,           // not applicable
      payment_note: currentPaymentNote,
      payment_method: 'paypal',
      paypal_order_id: raw?.order_id || null,
      paypal_capture_id: capture_id,
      paypal_payer_email: payer_email || null,
      foreign_currency: currency || 'USD',
      foreign_amount: amount ? Number(amount) : null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    // Idempotent case: capture was already logged
    if (error.code === '23505') {
      showAlert(
        '✅ This PayPal payment was already recorded. Coins will be credited after admin verification.',
        'success'
      );
      loadPendingPurchases();
      return { ok: true, duplicate: true };
    }
    throw error;
  }

  showAlert(
    `✅ PayPal payment of ${currency || 'USD'} ${amount} captured! ` +
    `Transaction reference: ${ref}. ` +
    `Coins will be credited within 24 hours after admin verification.`,
    'success'
  );

  updatePaymentDetails();
  loadPendingPurchases();
  return { ok: true, purchase_id: data?.id };
};

async function loadPendingPurchases() {
  const { data, error } = await window.sb
    .from('coin_purchases')
    .select('id, coin_amount, upi_transaction_ref, payment_note, status, created_at, payment_method, paypal_capture_id, foreign_currency, foreign_amount')
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
    const isPaypal = p.payment_method === 'paypal';
    const methodBadge = isPaypal
      ? '<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.65rem;font-weight:700;background:rgba(0,112,186,0.15);color:#4a90c4;text-transform:uppercase;margin-left:6px;vertical-align:middle;">PayPal</span>'
      : '<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.65rem;font-weight:700;background:rgba(76,175,80,0.15);color:#4caf50;text-transform:uppercase;margin-left:6px;vertical-align:middle;">UPI</span>';

    const priceLine = isPaypal
      ? `<div><strong>${p.coin_amount} FC</strong> — ${p.foreign_amount || '?'} ${p.foreign_currency || 'USD'}</div>`
      : `<div><strong>${p.coin_amount} FC</strong> — ₹${p.coin_amount}</div>`;

    return `
      <div class="pending-item">
        ${priceLine}
        <div class="time">${date}${methodBadge}</div>
        ${p.payment_note ? `<div style="font-family: monospace; font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Note: ${p.payment_note}</div>` : ''}
        ${p.upi_transaction_ref ? `<div style="font-family: monospace; font-size: 0.75rem; color: var(--muted);">UTR: ${p.upi_transaction_ref}</div>` : ''}
        ${p.paypal_capture_id ? `<div style="font-family: monospace; font-size: 0.75rem; color: var(--muted);">PayPal: ${p.paypal_capture_id.slice(0, 14)}…</div>` : ''}
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
