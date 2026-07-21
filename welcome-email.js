// ============================================
// KINDRED GUILD — WELCOME EMAIL TRIGGER
// Sends a welcome email via the send-email Supabase Edge Function.
// Include after supabase-client.js on auth.html.
// ============================================

(function () {
  if (!window.sb || !window.sb.auth) return;

  // Listen for auth state changes. A new-account signup fires SIGNED_IN
  // with a session whose user.created_at is within the last ~60s.
  window.sb.auth.onAuthStateChange(async (event, session) => {
    if (event !== 'SIGNED_IN' || !session?.user) return;

    const createdAt = new Date(session.user.created_at);
    const now = new Date();
    if (now - createdAt > 60000) return; // not a brand-new account

    try {
      // The send-email edge function expects { type, recipient_id, ... }.
      // (Previously this file was passing { to, subject, html } which the
      //  edge function silently rejected with "Unknown email type".)
      const { error } = await window.sb.functions.invoke('send-email', {
        body: {
          type: 'welcome',
          recipient_id: session.user.id,
        },
      });
      if (error) {
        console.warn('[Welcome Email] Could not send:', error.message);
      } else {
        console.log('[Welcome Email] Sent to', session.user.email);
      }
    } catch (e) {
      // Non-blocking — don't break signup just because the welcome email failed.
      console.warn('[Welcome Email] Error:', e?.message || e);
    }
  });
})();
