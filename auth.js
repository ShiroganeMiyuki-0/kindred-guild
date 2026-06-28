// ============================================
// KINDRED GUILD — AUTH LOGIC (MAGIC LINK FLOW)
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const emailInput = document.getElementById('email');
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

    showMessage('Magic link sent! Click the link in your email to log in.', 'success');
    emailStep.classList.add('hidden');
    otpStep.classList.remove('hidden');
    // Change the OTP step UI to "check email" message
    otpStep.innerHTML = `
      <div class="divider">Check your inbox</div>
      <p style="color: var(--text-dim); text-align: center; margin: 20px 0; line-height: 1.6;">
        We sent a magic link to <strong style="color: var(--text);">${email}</strong>.<br>
        Click the link in your email to enter the guild.<br><br>
        <span style="font-size: 0.85rem;">Didn't receive it? Check your spam folder.</span>
      </p>
      <button onclick="backToEmail()" style="margin-top: 8px;">Use a different email</button>
    `;

  } catch (err) {
    console.error('Unexpected error:', err);
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Magic Link';
    showMessage('Something went wrong. Check console (F12).', 'error');
  }
}

function backToEmail() {
  emailStep.classList.remove('hidden');
  otpStep.classList.add('hidden');
  // Restore original OTP step HTML
  otpStep.innerHTML = `
    <div class="divider">Check your inbox</div>
    <div class="form-group">
      <label for="otp">Enter 6-digit Code</label>
      <input type="text" id="otp" placeholder="123456" maxlength="6" autocomplete="one-time-code" />
    </div>
    <button id="verifyOtpBtn" onclick="verifyOTP()">Enter the Guild</button>
    <a class="back-link" onclick="backToEmail()">← Use a different email</a>
  `;
  clearMessage();
}

// ============================================
// MAIN: Handle magic link return + session check
// ============================================
(async function init() {
  try {
    // Supabase automatically processes the token from URL hash when magic link is clicked
    const { data: { session }, error: sessionError } = await sb.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
    }

    if (session && session.user) {
      console.log('Session found:', session.user.id);
      
      // Check if user has profile
      const { data: profile, error: profileError } = await sb
        .from('user_profiles')
        .select('username')
        .eq('user_id', session.user.id)
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
      return;
    }

    // No session - show login form
    console.log('No session, showing login form');

  } catch (err) {
    console.error('Init error:', err);
  }
})();
