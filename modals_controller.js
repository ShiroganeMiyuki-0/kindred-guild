// ============================================
// KINDRED GUILD — MODAL AND TOAST UTILITIES
// ============================================

const MODAL_HTML_STRUCTURE = `
  <div class="modal-overlay" id="guildGlobalModal">
    <div class="modal-box">
      <h3 id="globalModalTitle">Notification</h3>
      <p id="globalModalBody">Description text goes here.</p>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" id="globalModalCancelBtn">Cancel</button>
        <button class="modal-btn modal-btn-confirm" id="globalModalConfirmBtn">Proceed</button>
      </div>
    </div>
  </div>
`;

// Build containers on DOM initialization
document.addEventListener('DOMContentLoaded', () => {
  // Append standard overlays
  const modalWrapper = document.createElement('div');
  modalWrapper.innerHTML = MODAL_HTML_STRUCTURE;
  document.body.appendChild(modalWrapper.firstElementChild);

  // Append Toast wrapper
  const toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);

  // Support key bindings
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeGuildModal();
    }
  });
});

let modalConfirmCallback = null;
let modalCancelCallback = null;

function showGuildModal(type, onConfirm, onCancel) {
  const modal = document.getElementById('guildGlobalModal');
  const title = document.getElementById('globalModalTitle');
  const body = document.getElementById('globalModalBody');
  const cancelBtn = document.getElementById('globalModalCancelBtn');
  const confirmBtn = document.getElementById('globalModalConfirmBtn');

  // Load custom warnings text
  if (type === 'off-platform') {
    title.textContent = '⚠️ Heads Up — Risk Warning';
    body.textContent = "Off-platform transactions are not covered by Kindred Guild's dispute resolution or reputation system. If something goes wrong, we can't help. Proceed at your own risk — or use the platform and let us protect you.";
    cancelBtn.style.display = 'block';
    confirmBtn.textContent = 'Proceed at Own Risk';
  } else if (type === 'upi-warning') {
    title.textContent = '⚠️ UPI Direct — Know the Risks';
    body.textContent = "Kindred Guild cannot mediate disputes or verify completion for UPI quests. If payment is withheld, only reputation damage and eventual suspension apply. Proceed only if you trust the other party.";
    cancelBtn.style.display = 'block';
    confirmBtn.textContent = 'I understand, proceed';
  } else if (type === 'free-quest') {
    title.textContent = '🎁 Free Goodwill Quest';
    body.textContent = "No payments, no ratings, no reputation metrics involved here. You are performing this task purely out of genuine kindness. The Guild honors you for it.";
    cancelBtn.style.display = 'block';
    confirmBtn.textContent = 'Accept with Goodwill';
  }

  modalConfirmCallback = onConfirm;
  modalCancelCallback = onCancel;

  confirmBtn.onclick = () => {
    if (modalConfirmCallback) modalConfirmCallback();
    closeGuildModal();
  };

  cancelBtn.onclick = () => {
    if (modalCancelCallback) modalCancelCallback();
    closeGuildModal();
  };

  modal.classList.add('active');
}

function closeGuildModal() {
  document.getElementById('guildGlobalModal').classList.remove('active');
}

// -----------------------------
// TOAST NOTIFICATIONS
// -----------------------------
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toast.onclick = () => toast.remove();

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s reverse';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }
}