// ============================================
// KINDRED GUILD — AUTH LOGIC
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

window.sendMagicLink = async function() {
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }

  clearMessage();
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  // Fix: Dynamic redirect fallback guarantees URL compatibility across localhost, stages and custom domains
  const dynamicRedirectUrl = window.location.origin + '/auth.html';
  console.log('Target dynamic authentication redirect set to:', dynamicRedirectUrl);

  try {
    const { error } = await sb.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: dynamicRedirectUrl
      }
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
    showMessage('Something went wrong. Check browser console logs.', 'error');
  }
};

window.backToEmail = function() {
  emailStep.classList.remove('hidden');
  checkStep.classList.add('hidden');
  clearMessage();
};

// Handle return redirects
(async function init() {
  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();

    if (session && session.user) {
      await handleLoggedInUser(session.user);
      return;
    }
  } catch (err) {
    console.error('Session initializing failure:', err);
  }
})();

async function handleLoggedInUser(user) {
  const { data: profile, error: profileError } = await sb
    .from('user_profiles')
    .select('username')
    .eq('user_id', user.id)
    .single();

  if (profile) {
    window.location.href = 'quest-board.html';
  } else {
    window.location.href = 'username-setup.html';
  }
}
