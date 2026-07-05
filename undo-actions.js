// ============================================
// KINDRED GUILD — UNDO/REVERSIBLE ACTIONS
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let actionHistory = [];

(async function init() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;

  loadActionHistory();
})();

async function loadActionHistory() {
  const { data, error } = await sb
    .from('action_log')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('can_undo', true)
    .gt('undo_until', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error loading action history:', error);
    return;
  }

  actionHistory = data || [];
  renderActionHistory();
}

function renderActionHistory() {
  const container = document.getElementById('actionHistoryContainer');
  
  if (!container) return;
  
  if (actionHistory.length === 0) {
    container.innerHTML = '<p>No recent actions to undo.</p>';
    return;
  }

  container.innerHTML = actionHistory.map(action => {
    const createdAt = new Date(action.created_at);
    const timeAgo = getTimeAgo(createdAt);
    const actionLabel = getActionLabel(action.action_type);
    const undoUntil = new Date(action.undo_until);
    const canStillUndo = undoUntil > new Date();

    return `
      <div class="action-item ${!canStillUndo ? 'expired' : ''}">
        <div class="action-info">
          <span class="action-type">${actionLabel}</span>
          <span class="action-time">${timeAgo}</span>
          ${!canStillUndo ? '<span class="expired-label">Undo window closed</span>' : ''}
        </div>
        ${canStillUndo ? `
          <button class="undo-btn" onclick="undoAction('${action.id}', '${action.action_type}')">
            Undo
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

function getActionLabel(actionType) {
  const labels = {
    'quest_created': 'Quest Created',
    'quest_edited': 'Quest Edited',
    'quest_deleted': 'Quest Deleted',
    'quest_cancelled': 'Quest Cancelled',
    'worker_post_created': 'Worker Post Created',
    'worker_post_deleted': 'Worker Post Deleted',
    'worker_post_edited': 'Worker Post Edited'
  };
  return labels[actionType] || actionType;
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

window.undoAction = async function(actionId, actionType) {
  if (!confirm('Are you sure you want to undo this action?')) {
    return;
  }

  try {
    // Find the action in history
    const action = actionHistory.find(a => a.id === actionId);
    if (!action) {
      alert('Action not found.');
      return;
    }

    // Handle different action types
    if (actionType === 'quest_deleted' && action.quest_id) {
      await restoreQuest(action.quest_id);
    } else if (actionType === 'worker_post_deleted' && action.worker_post_id) {
      await restoreWorkerPost(action.worker_post_id);
    } else if (actionType === 'quest_edited' && action.quest_id && action.old_data) {
      await revertQuestEdit(action.quest_id, action.old_data);
    } else {
      alert('This action cannot be undone.');
      return;
    }

    alert('Action undone successfully!');
    loadActionHistory();

  } catch (err) {
    console.error('Error undoing action:', err);
    alert('Failed to undo action: ' + err.message);
  }
};

async function restoreQuest(questId) {
  const { error } = await sb.rpc('restore_quest', {
    p_quest_id: questId
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function restoreWorkerPost(postId) {
  const { error } = await sb
    .from('worker_posts')
    .update({ is_deleted: false, deleted_at: null })
    .eq('id', postId);

  if (error) {
    throw new Error(error.message);
  }
}

async function revertQuestEdit(questId, oldData) {
  const { error } = await sb
    .from('quests')
    .update({
      title: oldData.title,
      description: oldData.description,
      tags: oldData.tags,
      coin_amount: oldData.coin_amount,
      upi_amount: oldData.upi_amount
    })
    .eq('id', questId);

  if (error) {
    throw new Error(error.message);
  }
}

// Export for use in other modules
window.UndoActions = {
  loadActionHistory,
  undoAction
};
