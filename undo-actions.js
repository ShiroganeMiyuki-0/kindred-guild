// ============================================
// KINDRED GUILD — UNDO/REVERSIBLE ACTIONS
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Uses shared window.sb from supabase-client.js
// ============================================

let currentUser = null;
let actionHistory = [];

(async function init() {
  const user = await window.requireAuth();
  if (!user) return;
  currentUser = user;
  loadActionHistory();
})();

async function loadActionHistory() {
  const { data, error } = await window.sb
    .from('action_log')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('can_undo', true)
    .gt('undo_until', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.error('Error loading history:', error); return; }
  actionHistory = data || [];
  renderActionHistory();
}

function renderActionHistory() {
  const container = document.getElementById('actionHistoryContainer');
  if (!container) return;

  if (actionHistory.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px">No recent actions to undo.</p>';
    return;
  }

  const labels = {
    quest_created: 'Quest Created', quest_edited: 'Quest Edited',
    quest_deleted: 'Quest Deleted', quest_cancelled: 'Quest Cancelled',
    worker_post_created: 'Worker Post Created', worker_post_deleted: 'Worker Post Deleted',
    worker_post_edited: 'Worker Post Edited'
  };

  container.innerHTML = actionHistory.map(action => {
    const createdAt = new Date(action.created_at);
    const undoUntil = new Date(action.undo_until);
    const canUndo = undoUntil > new Date();
    const label = labels[action.action_type] || action.action_type;

    return `
      <div class="card" style="margin-bottom:12px;opacity:${canUndo ? 1 : 0.5}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${label}</strong>
            <div style="font-size:0.8rem;color:var(--text-dim)">${window.timeAgo(createdAt)}</div>
            ${!canUndo ? '<span style="font-size:0.75rem;color:var(--error)">Undo window closed</span>' : ''}
          </div>
          ${canUndo ? `<button class="btn btn-ghost btn-sm" onclick="undoAction('${action.id}','${action.action_type}')">Undo</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

window.undoAction = async function (actionId, actionType) {
  if (!confirm('Undo this action?')) return;

  const action = actionHistory.find(a => a.id === actionId);
  if (!action) { window.showToast('Action not found.', 'error'); return; }

  try {
    if (actionType === 'quest_deleted' && action.quest_id) {
      await window.sb.rpc('restore_quest', { p_quest_id: action.quest_id });
    } else if (actionType === 'worker_post_deleted' && action.worker_post_id) {
      await window.sb.from('worker_posts').update({ is_deleted: false, deleted_at: null }).eq('id', action.worker_post_id);
    } else if (actionType === 'quest_edited' && action.quest_id) {
      const { error } = await window.sb.rpc('undo_quest_edit', { p_action_log_id: actionId });
      if (error) throw error;
    } else { window.showToast('This action cannot be undone.', 'warning'); return; }

    window.showToast('Action undone successfully!', 'success');
    loadActionHistory();
  } catch (err) { window.showToast('Failed: ' + err.message, 'error'); }
};
