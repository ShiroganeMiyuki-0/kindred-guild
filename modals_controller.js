// ============================================
// KINDRED GUILD — MODAL AND TOAST UTILITIES
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
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
    title.textContent = '⚠️ UPI Direct — How It Works';
    body.textContent = "UPI payments happen directly between you and the other user — the platform never handles real money. We lock a 10% Fairy Coin deposit from the poster as a trust deposit (like a security deposit). The actual ₹ payment is between you two. Kindred Guild can't mediate UPI disputes — only reputation damage and suspension apply if someone misbehaves. Proceed if you trust the other party.";
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
// NOTE: showToast used to be redefined here, which shadowed the (better)
// implementation in js/supabase-client.js. That version is loaded on every
// page, includes its own inline styles + animation, and supports the
// 'warning' type used elsewhere in the codebase. The override here produced
// unstyled <div class="toast"> elements (no .toast CSS exists anywhere in
// the project). Deleted to avoid the inconsistency.
