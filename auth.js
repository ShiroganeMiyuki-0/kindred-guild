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
    const { data: { session } } = await window.sb.auth.getSession();
    if (session?.user) {
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
