// ============================================
// KINDRED GUILD — EMAIL NOTIFICATION HELPER
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Calls the send-email Supabase Edge Function
// ============================================

window.sendNotification = async function (type, recipientId, questId, extra) {
  try {
    const { error } = await window.sb.functions.invoke('send-email', {
      body: {
        type: type,
        recipient_id: recipientId,
        quest_id: questId || null,
        extra: extra || {},
      },
    });
    if (error) console.warn('[Email] Notification failed:', error.message);
  } catch (err) {
    // Non-blocking — don't break the app if email fails
    console.warn('[Email] Notification error:', err);
  }
};
