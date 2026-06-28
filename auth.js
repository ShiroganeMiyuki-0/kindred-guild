// ============================================
// KINDRED GUILD — AUTH LOGIC (Google + Magic Link)
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const emailInput = document.getElementById('email');
const methodStep = document.getElementById('methodStep');
const emailStep = document.getElementById('emailStep');
const emailDisplay = document.getElementById('emailDisplay');
const messageEl = document.getElementById('message');
const sendBtn = document.getElementById('sendOtpBtn');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || 'info');
  console.log('[' + (type || 'info') + ']', text);
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
}

async function signInWithGoogle() {
  clearMessage();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://kindred-guild.vercel.app/auth.html'
    }
  });

  if (error) {
    console.error('Google sign-in error:', error);
    showMessage(error.message, 'error');
  }
}

async function sendOTP() {
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
    methodStep.classList.add('hidden');
    emailStep.classList.remove('hidden');

  } catch (err) {
    console.error('Unexpected error:', err);
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Magic Link';
    showMessage('Something went wrong. Check console (F12).', 'error');
  }
}

function backToMethods() {
  methodStep.classList.remove('hidden');
  emailStep.classList.add('hidden');
  clearMessage();
}

// ============================================
// MAIN: Handle OAuth return + magic link return
// ============================================
(async function init() {
  try {
    // Check for active session
    const { data: { session }, error: sessionError } = await sb.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
    }

    if (session && session.user) {
      console.log('Session found:', session.user.id);
      await handleLoggedInUser(session.user);
      return;
    }

    // No session - show login form
    console.log('No session, showing login form');

  } catch (err) {
    console.error('Init error:', err);
  }
})();

async function handleLoggedInUser(user) {
  // Check if user has profile
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
