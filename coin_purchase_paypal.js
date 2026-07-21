// ============================================
// KINDRED GUILD — PAYPAL PAYMENT MODULE
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
//
// Wires PayPal Smart Buttons to the two Supabase Edge Functions:
//   - create-paypal-order  (returns orderId)
//   - capture-paypal-order (verifies + returns captureId)
//
// Renders the button lazily (only when the PayPal region is shown) and
// re-renders when the user changes the coin package, so the amount always
// matches what's in the dropdown.
// ============================================

(function () {
  'use strict';

  // ---- Configuration ----
  // Set this to your PayPal Client ID. For staging, set it in the
  // supabase-client.js bootstrap (window.PAYPAL_CLIENT_ID) so the SDK
  // script tag can pick it up before this file runs.
  const CLIENT_ID =
    (typeof window.PAYPAL_CLIENT_ID === 'string' && window.PAYPAL_CLIENT_ID) ||
    (window.__PAYPAL_CLIENT_ID__ || '');

  // Default currency. Matches what's sent to the create-order edge function.
  const CURRENCY = 'USD';

  function edgeUrl(fnName) {
    const base = (window.SUPABASE_URL || '').replace(/\/$/, '');
    return `${base}/functions/v1/${fnName}`;
  }

  // ---- State ----
  let paypalButtons = null;        // paypal.Buttons() instance
  let paypalSdkReady = false;      // SDK loaded?
  let paypalSdkLoading = null;     // in-flight loader
  let currentRendered = { coins: null, usd: null };

  // ---- Helpers ----
  function isPaypalRegionVisible() {
    const el = document.getElementById('paypalRegion');
    if (!el) return false;
    return el.style.display !== 'none';
  }

  function showPayPalError(msg) {
    const el = document.getElementById('paypal-error');
    if (!el) return;
    el.style.display = 'block';
    el.style.borderColor = 'var(--danger)';
    el.style.background = 'rgba(244, 67, 54, 0.1)';
    el.style.color = 'var(--danger)';
    el.textContent = '⚠️ ' + msg;
  }
  function showPayPalInfo(msg) {
    const el = document.getElementById('paypal-error');
    if (!el) return;
    el.style.display = 'block';
    el.style.borderColor = '#2196f3';
    el.style.background = 'rgba(33, 150, 243, 0.1)';
    el.style.color = '#2196f3';
    el.textContent = 'ℹ️ ' + msg;
  }
  function clearPayPalMessages() {
    const el = document.getElementById('paypal-error');
    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  // ---- SDK loader ----
  function injectSdk() {
    if (paypalSdkReady) return Promise.resolve();
    if (paypalSdkLoading) return paypalSdkLoading;

    // Re-read the client id at call time. supabase-client.js may have resolved
    // it from localStorage / URL param / <meta> AFTER this IIFE captured the
    // initial value (which could have been empty if no override was set).
    const resolvedClientId =
      (typeof window.PAYPAL_CLIENT_ID === 'string' && window.PAYPAL_CLIENT_ID) ||
      CLIENT_ID;

    if (!resolvedClientId) {
      return Promise.reject(new Error(
        'PayPal is not configured yet. An admin needs to set window.PAYPAL_CLIENT_ID ' +
        'in js/supabase-client.js (or via <meta name="paypal-client-id"> / ' +
        'localStorage.kg_paypal_client_id). See SETUP.md for the full guide.'
      ));
    }

    paypalSdkLoading = new Promise((resolve, reject) => {
      const url = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(resolvedClientId)}&currency=${CURRENCY}&intent=capture&components=buttons`;

      // Replace the placeholder tag from the HTML (or any stale tag) with a
      // tag pointing at the real client id.
      let tag = document.getElementById('paypal-sdk');
      if (!tag) {
        tag = document.createElement('script');
        tag.id = 'paypal-sdk';
        tag.src = url;
        tag.async = true;
        document.head.appendChild(tag);
      } else {
        tag.src = url;
      }

      tag.addEventListener('load', () => {
        paypalSdkReady = true;
        resolve();
      });
      tag.addEventListener('error', () => reject(new Error('PayPal SDK failed to load. Check your network connection and that the client id is valid.')));
    });

    return paypalSdkLoading;
  }

  // ---- Edge function call with the user's Supabase JWT ----
  async function callEdge(fnName, body) {
    const session = (await window.sb.auth.getSession()).data.session;
    const token = session?.access_token;
    if (!token) throw new Error('You must be signed in to use PayPal.');

    const res = await fetch(edgeUrl(fnName), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: window.SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify(body),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`PayPal service returned a non-JSON response (${res.status})`);
    }

    if (!res.ok) {
      throw new Error(data?.error || `PayPal service error (${res.status})`);
    }
    return data;
  }

  // ---- Button factory ----
  function buildButtons(coins, usdAmount) {
    return window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        tagline: false,
      },

      // Called when the user clicks the PayPal button
      createOrder: async () => {
        try {
          const paymentNote =
            (typeof window.currentPaymentNote === 'string' && window.currentPaymentNote) ||
            (document.getElementById('paymentNote')?.textContent || '').trim();

          const res = await callEdge('create-paypal-order', {
            coins,
            amount_usd: usdAmount,
            payment_note: paymentNote,
          });
          if (!res.orderId) throw new Error('No order id returned');
          return res.orderId;
        } catch (err) {
          showPayPalError(err.message || String(err));
          throw err;
        }
      },

      // Called when the user finishes the PayPal popup
      onApprove: async (data) => {
        try {
          showPayPalInfo('Verifying PayPal payment…');
          const capture = await callEdge('capture-paypal-order', {
            order_id: data.orderID,
          });

          if (typeof window.logPayPalPurchase !== 'function') {
            throw new Error('logPayPalPurchase is not defined on the page.');
          }

          await window.logPayPalPurchase({
            capture_id: capture.capture_id,
            payer_email: capture.payer_email,
            amount: capture.amount,
            currency: capture.currency,
            raw: capture.raw,
          });

          clearPayPalMessages();
        } catch (err) {
          console.error('PayPal onApprove error', err);
          showPayPalError(
            'Payment was captured but logging failed: ' + (err.message || err) +
            '. Please contact support with your PayPal receipt.'
          );
        }
      },

      onCancel: () => {
        showPayPalInfo('PayPal payment was cancelled. No charge was made.');
      },

      onError: (err) => {
        console.error('PayPal SDK error', err);
        showPayPalError('PayPal encountered an error. Please try again or use UPI.');
      },
    });
  }

  // ---- Render / re-render ----
  function renderButtons() {
    const container = document.getElementById('paypal-button-container');
    if (!container) return;

    const coins = parseInt(document.getElementById('coinPackage').value, 10);
    // PACKAGE_PRICING[coins] is the fee-aware breakdown object; `charged`
    // is what the user actually pays.
    const pricing = (window.PACKAGE_USD_PRICES || {})[coins] || {};
    const usdAmount = Number(pricing.charged || 0);

    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      container.innerHTML = '<div class="paypal-error">Invalid package price.</div>';
      return;
    }

    if (
      paypalButtons &&
      currentRendered.coins === coins &&
      currentRendered.usd === usdAmount
    ) {
      return;
    }

    container.innerHTML = '<div class="paypal-loading">Loading PayPal…</div>';

    injectSdk()
      .then(() => {
        container.innerHTML = '';
        if (paypalButtons && typeof paypalButtons.close === 'function') {
          try { paypalButtons.close(); } catch (_) {}
        }
        paypalButtons = buildButtons(coins, usdAmount);
        return paypalButtons.render('#paypal-button-container');
      })
      .then(() => {
        currentRendered = { coins, usd: usdAmount };
        clearPayPalMessages();
      })
      .catch((err) => {
        console.error('PayPal render failed', err);
        container.innerHTML = '';
        showPayPalError(
          err.message ||
          'PayPal could not be loaded. Make sure window.PAYPAL_CLIENT_ID is set and the create-paypal-order edge function is deployed.'
        );
      });
  }

  // ---- Public hooks ----
  window.ensurePayPalButtonsRendered = function () {
    if (!isPaypalRegionVisible()) return;
    renderButtons();
  };

  // Called by the main controller when the dropdown changes
  window.onCoinPackageChanged = function (coins, usd) {
    if (!isPaypalRegionVisible()) return;
    if (currentRendered.coins === coins && currentRendered.usd === usd) return;
    renderButtons();
  };
})();
