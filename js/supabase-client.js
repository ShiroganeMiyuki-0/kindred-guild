// ============================================
// KINDRED GUILD — SHARED SUPABASE CLIENT
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Include on EVERY page: <script src="js/supabase-client.js"></script>
// Must be loaded AFTER the Supabase CDN script.
// ============================================
(function () {
  const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

  if (window.supabase && window.supabase.createClient) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('[Kindred Guild] Supabase CDN not loaded. Add the CDN script before supabase-client.js');
  }

  // Expose Supabase URL + anon key on window so edge function calls can use them
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  // ---------------------------------------------------------------------
  // Centralized UPI configuration. Previously this was hardcoded in 4+
  // different places (coin_purchase_js_logic.js, coin_purchase_ui.html,
  // donation.html x3). If the UPI ID ever changes, you only need to update
  // it here — every page reads from window.UPI_ID / window.PAYEE_NAME.
  // ---------------------------------------------------------------------
  window.UPI_ID = 'yashwanthrangaswamy72@okhdfcbank';
  window.PAYEE_NAME = 'Kindred Guild';

  // ---------------------------------------------------------------------
  // PayPal.me username for MANUAL international payments.
  //
  // We deliberately removed the PayPal Smart Buttons SDK + server-side
  // capture flow in favour of a manual UPI-style flow: the user scans a
  // QR code that opens PayPal.me with the amount pre-filled, pays in their
  // PayPal app, then clicks "I've Paid — Log My Purchase" just like UPI.
  // The admin verifies manually in the dashboard.
  //
  // Set this to your PayPal.me username (the part after paypal.me/).
  //   Example: if your link is https://paypal.me/yashwanthrangaswamy72
  //            then PAYPAL_ME_USERNAME = 'yashwanthrangaswamy72'
  //
  // Resolution order (first non-empty wins):
  //   1. ?paypal_me=... URL param (for quick testing)
  //   2. localStorage.kg_paypal_me_username
  //   3. <meta name="paypal-me-username" content="..."> tag in the HTML head
  //   4. The hardcoded value below
  // ---------------------------------------------------------------------
  window.PAYPAL_ME_USERNAME = 'YashwanthR131'; // <-- PayPal.me username (paypal.me/YashwanthR131)

  (function resolvePayPalMeUsername() {
    const isValid = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{3,50}$/.test(v);
    try {
      const urlParam = new URLSearchParams(window.location.search).get('paypal_me');
      if (isValid(urlParam)) { window.PAYPAL_ME_USERNAME = urlParam; return; }
      const lsVal = window.localStorage && window.localStorage.getItem('kg_paypal_me_username');
      if (isValid(lsVal)) { window.PAYPAL_ME_USERNAME = lsVal; return; }
      const meta = document.querySelector('meta[name="paypal-me-username"]');
      if (isValid(meta?.content)) { window.PAYPAL_ME_USERNAME = meta.content; return; }
    } catch (_) { /* localStorage may throw in private mode — ignore */ }
  })();

  // Helper used by coin_purchase_js_logic.js to build a paypal.me link
  // for a given USD amount. Returns '' if the username is not configured.
  window.buildPayPalMeUrl = function (amountUsd) {
    if (!window.PAYPAL_ME_USERNAME) return '';
    // paypal.me/<username>/<amount> — PayPal.me accepts amounts with up to
    // 2 decimal places. Trailing zeros are fine.
    const amt = Number(amountUsd).toFixed(2);
    return `https://www.paypal.com/paypalme/${encodeURIComponent(window.PAYPAL_ME_USERNAME)}/${amt}`;
  };

  // Shared utility: escape HTML to prevent XSS
  window.escapeHtml = function (text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Shared utility: get URL search param
  window.getUrlParam = function (key) {
    return new URLSearchParams(window.location.search).get(key);
  };

  // Shared utility: validate UUID
  window.isValidUuid = function (id) {
    if (!id || id === 'null' || id === 'undefined') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  };

  // Shared utility: relative time string
  window.timeAgo = function (date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  };

  // Shared: require auth — redirects to auth.html if not logged in
  // Returns the user object or null
  window.requireAuth = async function () {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) {
      window.location.href = 'auth.html';
      return null;
    }
    return user;
  };

  // Shared: get current user profile
  window.getUserProfile = async function (userId) {
    const { data, error } = await window.sb
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    return error ? null : data;
  };

  // Shared: toast notification system
  window.showToast = function (message, type, durationMs) {
    type = type || 'info';
    durationMs = durationMs || 3000;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom, 0px) + 100px);right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;';
      document.body.appendChild(container);
    }
    const colors = {
      success: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#10b981' },
      error: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#ef4444' },
      info: { bg: 'rgba(212,175,55,0.15)', border: '#d4af37', text: '#d4af37' },
      warning: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#f59e0b' }
    };
    const c = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.style.cssText = `background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:12px 16px;color:${c.text};font-size:0.85rem;font-weight:600;box-shadow:0 4px 15px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;cursor:pointer;`;
    toast.textContent = message;
    toast.onclick = () => toast.remove();
    container.appendChild(toast);
    if (!document.getElementById('toast-anim-style')) {
      const s = document.createElement('style');
      s.id = 'toast-anim-style';
      s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(s);
    }
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, durationMs);
  };
})();
