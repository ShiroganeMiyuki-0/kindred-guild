// ============================================
// KINDRED GUILD — WELCOME EMAIL TRIGGER
// Sends a welcome email via Resend Edge Function
// Include after auth.js on auth.html
// ============================================

(function () {
  // Hook into the signup flow
  const originalSignUp = window.sb?.auth?.signUp;

  // Listen for auth state changes (signup = SIGNED_IN event for new users)
  if (window.sb && window.sb.auth) {
    window.sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Check if this is a new user (created within last 60 seconds)
        const createdAt = new Date(session.user.created_at);
        const now = new Date();
        if (now - createdAt < 60000) {
          await sendWelcomeEmail(session.user);
        }
      }
    });
  }

  async function sendWelcomeEmail(user) {
    try {
      const profile = await window.getUserProfile(user.id);
      const username = profile?.display_name || profile?.username || 'Guild Member';

      // Call the Supabase Edge Function for email
      const { error } = await window.sb.functions.invoke('send-email', {
        body: {
          to: user.email,
          subject: 'Welcome to the Guild! Here\'s how to get started 🛡️',
          html: getWelcomeEmailHtml(username, user.email)
        }
      });

      if (error) {
        console.log('[Welcome Email] Could not send:', error.message);
        // Don't show error to user — email is nice-to-have
      } else {
        console.log('[Welcome Email] Sent to', user.email);
      }
    } catch (e) {
      console.log('[Welcome Email] Error:', e.message);
    }
  }

  function getWelcomeEmailHtml(username, email) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d0d0d;color:#e0e0e0;padding:40px 20px;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="color:#d4af37;font-size:1.8rem;margin-bottom:8px">Welcome to Kindred Guild! 🛡️</h1>
    <p style="color:#888;font-size:0.95rem">You just joined a community where people help each other out.</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px;margin-bottom:20px">
    <h2 style="color:#d4af37;font-size:1.2rem;margin-bottom:12px">🪙 You have 100 Fairy Coins</h2>
    <p style="color:#aaa;font-size:0.9rem;line-height:1.6">Every new member gets 100 coins to try out the platform. Use them to post a paid quest, or save them for later.</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px;margin-bottom:20px">
    <h2 style="color:#d4af37;font-size:1.2rem;margin-bottom:12px">📝 Post Your First Quest</h2>
    <p style="color:#aaa;font-size:0.9rem;line-height:1.6">Got something you need help with? Post a quest — it can be anything:</p>
    <ul style="color:#aaa;font-size:0.9rem;line-height:1.8;padding-left:20px">
      <li>Need a logo? Post it as a paid quest</li>
      <li>Need help moving? Post it as a free quest</li>
      <li>Need code review? Post it with coins or UPI</li>
    </ul>
  </div>

  <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px;margin-bottom:20px">
    <h2 style="color:#d4af37;font-size:1.2rem;margin-bottom:12px">🛡️ Offer Your Skills</h2>
    <p style="color:#aaa;font-size:0.9rem;line-height:1.6">Post your availability as a worker. Show what you can do, and quest posters will find you.</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px;margin-bottom:20px">
    <h2 style="color:#d4af37;font-size:1.2rem;margin-bottom:12px">🏰 Visit the Guild Hall</h2>
    <p style="color:#aaa;font-size:0.9rem;line-height:1.6">Chat with the community. Ask questions, share ideas, or just hang out. We have channels for everything — #general, #meetups, #skill-swap, #study-buddies, and more.</p>
  </div>

  <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #333">
    <a href="https://kindredguild.org/quest-board.html" style="display:inline-block;background:#d4af37;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;margin:0 8px">Browse Quests</a>
    <a href="https://kindredguild.org/quest-rules.html" style="display:inline-block;background:transparent;color:#d4af37;padding:12px 28px;border:1px solid #d4af37;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;margin:0 8px">Read the Rules</a>
  </div>

  <p style="color:#555;font-size:0.8rem;text-align:center;margin-top:32px">
    You're receiving this because you signed up at kindredguild.org.<br>
    Questions? Reply to this email or ask in the Guild Hall.
  </p>
</body>
</html>`;
  }
})();
