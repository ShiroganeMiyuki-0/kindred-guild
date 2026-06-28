// ============================================
// KINDRED GUILD — AUTH LOGIC (Email Magic Link)
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
  console.log('[' + (type || 'info') + ']', text);
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
}

async function sendMagicLink() {
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }

  clearMessage();
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const { error } = await sb.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://kindred-guild.vercel.app/auth.html'
      }
    });

    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Magic Link';

    if (error) {
      console.error('Send error:', error);
      showMessage(error.message, 'error');
      return;
    }

    emailDisplay.textContent = email;
    emailStep.classList.add('hidden');
    checkStep.classList.remove('hidden');

  } catch (err) {
    console.error('Unexpected error:', err);
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Magic Link';
    showMessage('Something went wrong. Check console (F12).', 'error');
  }
}

function backToEmail() {
  emailStep.classList.remove('hidden');
  checkStep.classList.add('hidden');
  clearMessage();
}

// Handle OAuth return / magic link return / existing session
(async function init() {
  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
    }

    if (session && session.user) {
      console.log('Session found:', session.user.id);
      await handleLoggedInUser(session.user);
      return;
    }

    console.log('No session, showing login form');

  } catch (err) {
    console.error('Init error:', err);
  }
})();

async function handleLoggedInUser(user) {
  const { data: profile, error: profileError } = await sb
    .from('user_profiles')
    .select('username')
    .eq('user_id', user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Profile check error:', profileError);
  }

  if (profile) {
    console.log('Returning user, redirecting...');
    window.location.href = 'quest-board.html';
  } else {
    console.log('New user, redirecting to setup...');
    window.location.href = 'username-setup.html';
  }
}
