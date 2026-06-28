// ============================================
// KINDRED GUILD — AUTH LOGIC (OTP MODE)
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const emailInput = document.getElementById('email');
const otpInput = document.getElementById('otp');
const emailStep = document.getElementById('emailStep');
const otpStep = document.getElementById('otpStep');
const messageEl = document.getElementById('message');
const sendBtn = document.getElementById('sendOtpBtn');
const verifyBtn = document.getElementById('verifyOtpBtn');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || 'info');
  console.log('[' + (type || 'info') + ']', text);
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
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
    // Use OTP flow with channel: 'email' to get a 6-digit code
    const { error } = await sb.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: null  // Force OTP instead of magic link
      }
    });

    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Magic Code';

    if (error) {
      console.error('Send OTP error:', error);
      showMessage(error.message, 'error');
      return;
    }

    showMessage('Magic code sent! Check your email (and spam folder).', 'success');
    emailStep.classList.add('hidden');
    otpStep.classList.remove('hidden');
    otpInput.focus();

  } catch (err) {
    console.error('Unexpected error:', err);
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Magic Code';
    showMessage('Something went wrong. Check console (F12) for details.', 'error');
  }
}

async function verifyOTP() {
  const email = emailInput.value.trim().toLowerCase();
  const token = otpInput.value.trim();

  if (!token || token.length !== 6) {
    showMessage('Please enter the 6-digit code from your email.', 'error');
    return;
  }

  clearMessage();
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  try {
    const { data, error } = await sb.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email'
    });

    if (error) {
      console.error('Verify OTP error:', error);
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Enter the Guild';
      showMessage(error.message, 'error');
      return;
    }

    console.log('Login successful:', data.user.id);

    const { data: profile, error: profileError } = await sb
      .from('user_profiles')
      .select('username')
      .eq('user_id', data.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile check error:', profileError);
    }

    if (profile) {
      console.log('Returning user, redirecting to quest board');
      window.location.href = 'quest-board.html';
    } else {
      console.log('New user, redirecting to username setup');
      window.location.href = 'username-setup.html';
    }

  } catch (err) {
    console.error('Unexpected error:', err);
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Enter the Guild';
    showMessage('Something went wrong. Check console (F12) for details.', 'error');
  }
}

function backToEmail() {
  otpStep.classList.add('hidden');
  emailStep.classList.remove('hidden');
  clearMessage();
  otpInput.value = '';
}

(async function checkSession() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      console.log('Existing session found:', session.user.id);
      const { data: profile } = await sb
        .from('user_profiles')
        .select('username')
        .eq('user_id', session.user.id)
        .single();

      if (profile) {
        window.location.href = 'quest-board.html';
      } else {
        window.location.href = 'username-setup.html';
      }
    }
  } catch (err) {
    console.error('Session check error:', err);
  }
})();
