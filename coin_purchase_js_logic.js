// ============================================
// KINDRED GUILD — COIN PURCHASE CONTROLLER
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Uses shared window.sb from supabase-client.js
// ============================================

// UPI configuration is centralized in js/supabase-client.js as window.UPI_ID
// and window.PAYEE_NAME. Fall back to the historical values only if the
// shared client failed to load for some reason.
const UPI_ID = (window.UPI_ID || 'yashwanthrangaswamy72@okhdfcbank');
const PAYEE_NAME = (window.PAYEE_NAME || 'Kindred Guild');

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

  // NOTE: The PayPal SDK used to redirect back to ?paypal=return|cancel after
  // the popup closed. The manual QR flow doesn't redirect, so that handling
  // is gone. If an old cached link still points to ?paypal=return we just
  // clean the URL silently.
  if (params.get('paypal')) {
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

  // Keep the displayed UPI ID and QR code in sync with window.UPI_ID
  // (centralized in supabase-client.js) so changing it there flows here too.
  const upiIdEl = document.getElementById('upiIdDisplay');
  if (upiIdEl && window.UPI_ID) upiIdEl.textContent = window.UPI_ID;

  const upiLink = generateUpiLink(amount, currentPaymentNote);
  document.getElementById('upiLink').href = upiLink;

  document.getElementById('qrImage').src = generateQrUrl(amount, currentPaymentNote);

  // Update PayPal display (manual QR flow — no SDK, no smart buttons)
  const usdEl = document.getElementById('paypalAmountUsd');
  const fcEl = document.getElementById('paypalAmountFc');
  const dueEl = document.getElementById('paypalAmountDue');
  if (usdEl) usdEl.textContent = `$${usd.toFixed(2)}`;
  if (fcEl) fcEl.textContent = coins.toLocaleString('en-IN');
  if (dueEl) dueEl.textContent = `$${usd.toFixed(2)}`;

  // Update the fee breakdown (if those elements exist)
  const baseEl = document.getElementById('paypalBreakBase');
  const feeEl = document.getElementById('paypalBreakFee');
  const feePctEl = document.getElementById('paypalBreakFeePct');
  const marginEl = document.getElementById('paypalBreakMargin');
  const marginPctEl = document.getElementById('paypalBreakMarginPct');
  const totalEl = document.getElementById('paypalBreakTotal');
  if (baseEl) baseEl.textContent = `$${pricing.baseUsd.toFixed(2)}`;
  if (feeEl) feeEl.textContent = `$${pricing.paypalFee.toFixed(2)}`;
  if (feePctEl) feePctEl.textContent = `${pricing.paypalFeePercent.toFixed(2)}% + $${PAYPAL_FIXED_FEE_USD.toFixed(2)}`;
  if (marginEl) marginEl.textContent = `$${pricing.platformMargin.toFixed(2)}`;
  if (marginPctEl) marginPctEl.textContent = `${pricing.platformMarginPercent.toFixed(0)}%`;
  if (totalEl) totalEl.textContent = `$${pricing.charged.toFixed(2)}`;

  // Update the PayPal.me link, QR code, and payment note for the manual flow
  const paypalMeUrl = (typeof window.buildPayPalMeUrl === 'function')
    ? window.buildPayPalMeUrl(usd)
    : '';
  const paypalMeLink = document.getElementById('paypalMeLink');
  const paypalMeDisplay = document.getElementById('paypalMeLinkDisplay');
  const paypalQrImage = document.getElementById('paypalQrImage');
  const paypalNoteEl = document.getElementById('paypalPaymentNote');

  if (paypalMeLink) paypalMeLink.href = paypalMeUrl || '#';
  if (paypalMeDisplay) {
    paypalMeDisplay.textContent = window.PAYPAL_ME_USERNAME
      ? `paypal.me/${window.PAYPAL_ME_USERNAME}/${usd.toFixed(2)}`
      : 'PayPal.me not configured — see js/supabase-client.js';
  }
  if (paypalQrImage) {
    if (paypalMeUrl) {
      // Reuse the same QR generation service as UPI (api.qrserver.com)
      paypalQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paypalMeUrl)}`;
      paypalQrImage.style.opacity = '1';
    } else {
      // No PayPal.me username configured — show a placeholder so the page
      // doesn't look broken. Admin sees an actionable message in the link
      // display above.
      paypalQrImage.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f5f5f5"/><text x="100" y="100" font-family="sans-serif" font-size="12" fill="#888" text-anchor="middle">PayPal.me</text><text x="100" y="118" font-family="sans-serif" font-size="12" fill="#888" text-anchor="middle">not configured</text></svg>'
      );
      paypalQrImage.style.opacity = '0.6';
    }
  }
  if (paypalNoteEl) paypalNoteEl.textContent = currentPaymentNote;

  // Keep window.currentPaymentNote in sync (some external scripts may read it)
  window.currentPaymentNote = currentPaymentNote;
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
    // Manual flow — no SDK to render. The QR + link are kept up to date by
    // updatePaymentDetails() which fires on dropdown change. If the user
    // switches tabs without touching the dropdown, force a refresh so the
    // QR image always shows the correct amount.
    updatePaymentDetails();
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

// Copy the PayPal.me link to clipboard (manual flow — mirrors copyUpiLink)
window.copyPayPalLink = function() {
  const coins = parseInt(document.getElementById('coinPackage').value);
  const pricing = PACKAGE_PRICING[coins] || { charged: 0 };
  const usd = pricing.charged;
  const link = (typeof window.buildPayPalMeUrl === 'function')
    ? window.buildPayPalMeUrl(usd)
    : '';

  if (!link) {
    showAlert('PayPal.me is not configured yet. An admin needs to set window.PAYPAL_ME_USERNAME in js/supabase-client.js.', 'info');
    return;
  }

  navigator.clipboard.writeText(link).then(() => {
    showAlert('PayPal.me link copied! Open it in any browser or share it with the payer.', 'info');
  }).catch(() => {
    showAlert('Failed to copy. Please use the "Open PayPal.me to Pay" button instead.', 'info');
  });
};

// Log a PayPal purchase (manual flow — user clicked "I've Paid" after
// scanning the QR / opening the PayPal.me link). Mirrors submitPaymentReference
// for UPI but populates the PayPal-specific columns so admin can distinguish.
window.submitPayPalPaymentReference = async function() {
  const coins = parseInt(document.getElementById('coinPackage').value);
  const pricing = PACKAGE_PRICING[coins] || { charged: 0 };
  const usd = pricing.charged;
  const txnRef = (document.getElementById('paypalTxnRef')?.value || '').trim();

  const btn = document.getElementById('submitPaypalPaymentBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Logging...';
  }

  const { error } = await window.sb
    .from('coin_purchases')
    .insert({
      user_id: currentUser.id,
      coin_amount: coins,
      upi_transaction_ref: null,            // not applicable for PayPal
      payment_note: currentPaymentNote,
      payment_method: 'paypal',
      // For the manual flow we don't have a capture id — store the user-
      // supplied email/txn id in the payer email column so admin can match.
      paypal_payer_email: txnRef || null,
      foreign_currency: 'USD',
      foreign_amount: Number(usd) || null,
      status: 'pending',
    });

  if (error) {
    showAlert('Failed to submit: ' + error.message, 'info');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '✅ I\'ve Paid — Log My Purchase';
    }
    return;
  }

  showAlert(
    `✅ PayPal purchase logged!${txnRef ? ' Your reference has been recorded.' : ''} ` +
    `Please include payment note "${currentPaymentNote}" when you pay if you haven't already. ` +
    `Coins will be credited within 24 hours after admin verification.`,
    'success'
  );

  const txnInput = document.getElementById('paypalTxnRef');
  if (txnInput) txnInput.value = '';
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '✅ I\'ve Paid — Log My Purchase';
  }

  updatePaymentDetails();
  loadPendingPurchases();
};

// Legacy hook kept for backward compatibility — older versions of the page
// may still call window.logPayPalPurchase from cached HTML. It now delegates
// to the manual submit flow.
window.logPayPalPurchase = function() {
  if (typeof window.submitPayPalPaymentReference === 'function') {
    return window.submitPayPalPaymentReference();
  }
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
