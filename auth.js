const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const emailInput = document.getElementById('email');
const emailStep = document.getElementById('emailStep');
const checkStep = document.getElementById('checkStep');
const emailDisplay = document.getElementById('emailDisplay');
const messageEl = document.getElementById('message');
const sendBtn = document.getElementById('sendBtn');

function safeNavigate(target) {
  if (!target) return;
  try {
    const protocol = window.location.protocol;
    // Resolve relative path to window.location.href if on standard web schemes
    if (protocol === 'http:' || protocol === 'https:' || protocol === 'file:') {
      const resolved = new URL(target, window.location.href).href;
      window.location.href = resolved;
    } else {
      // In sandbox preview frames (e.g., about:srcdoc), try standard assignment directly
      window.location.href = target;
    }
  } catch (e) {
    console.warn("Navigation resolution failed to target: " + target + " under sandbox context.", e);
  }
}

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

  // Fix: Safe dynamic redirect fallback logic (replaces Vercel URLs to prevent null-origin exceptions)
  const dynamicRedirectUrl = (window.location.origin && window.location.origin !== 'null') 
    ? window.location.origin + '/auth.html' 
    : window.location.href.split('?')[0].split('#')[0];
    
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
    safeNavigate('quest-board.html');
  } else {
    safeNavigate('username-setup.html');
  }
}
