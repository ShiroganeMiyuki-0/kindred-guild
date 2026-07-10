// ============================================
// KINDRED GUILD — AUTH CONTROLLER
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Uses shared window.sb from supabase-client.js
// ============================================

const emailInput = document.getElementById('email');
const emailStep = document.getElementById('emailStep');
const checkStep = document.getElementById('checkStep');
const emailDisplay = document.getElementById('emailDisplay');
const messageEl = document.getElementById('message');
const sendBtn = document.getElementById('sendBtn');
const refInput = document.getElementById('referralCode');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || 'info');
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
}

window.sendMagicLink = async function () {
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }

  clearMessage();
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  const redirectUrl = (window.location.origin && window.location.origin !== 'null')
    ? window.location.origin + '/auth.html'
    : window.location.href.split('?')[0].split('#')[0];

  try {
    const { error } = await window.sb.auth.signInWithOtp({
      email: email,
      options: { shouldCreateUser: true, emailRedirectTo: redirectUrl }
    });

    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Magic Link';

    if (error) {
      showMessage(error.message, 'error');
      return;
    }

    emailDisplay.textContent = email;
    emailStep.classList.add('hidden');
    checkStep.classList.remove('hidden');

    // Save referral code if provided
    const refCode = (refInput?.value || '').trim().toUpperCase();
    if (refCode) localStorage.setItem('kg_referral_code', refCode);
  } catch (err) {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Magic Link';
    showMessage('Something went wrong. Please try again.', 'error');
  }
};

window.backToEmail = function () {
  emailStep.classList.remove('hidden');
  checkStep.classList.add('hidden');
  clearMessage();
};

(async function init() {
  try {
    // Check for referral code in URL
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    if (urlRef && refInput) {
      refInput.value = urlRef.toUpperCase();
      localStorage.setItem('kg_referral_code', urlRef.toUpperCase());
    }

    const { data: { session } } = await window.sb.auth.getSession();
    if (session?.user) {
      // Apply referral code if stored
      const storedRef = localStorage.getItem('kg_referral_code');
      if (storedRef) {
        try {
          await window.sb.rpc('apply_referral_code', { p_code: storedRef, p_referred_id: session.user.id });
          localStorage.removeItem('kg_referral_code');
        } catch (e) { localStorage.removeItem('kg_referral_code'); }
      }

      const { data: profile } = await window.sb
        .from('user_profiles')
        .select('username')
        .eq('user_id', session.user.id)
        .single();

      window.location.href = profile ? 'quest-board.html' : 'username-setup.html';
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
})();
