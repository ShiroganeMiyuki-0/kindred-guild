// ============================================
// KINDRED GUILD — DISPUTE & EVIDENCE ENHANCEMENTS
// Patch for quest_detail_controller.js
// Include AFTER quest_detail_controller.js
// ============================================

(function () {
  // ── 1. DISPUTE REASON SELECTOR ──
  const DISPUTE_REASONS = [
    { value: 'not_delivered', label: '🚫 Work not delivered', desc: 'Worker did not complete or submit the task.' },
    { value: 'poor_quality', label: '📉 Quality unacceptable', desc: 'Work was submitted but does not meet the agreed standards.' },
    { value: 'scope_changed', label: '🔄 Scope changed mid-quest', desc: 'The requirements changed after the quest was accepted.' },
    { value: 'poster_unresponsive', label: '👻 Poster not responding', desc: 'Poster has gone silent and won\'t respond to messages.' },
    { value: 'communication_breakdown', label: '💬 Communication breakdown', desc: 'Both sides can\'t agree on what was expected.' },
    { value: 'other', label: '📝 Other', desc: 'Something else entirely. Please explain in the notes.' },
  ];

  // Override the dispute launch function
  window.triggerDisputeLaunch = async function () {
    const reason = await showDisputeReasonModal();
    if (!reason) return; // user cancelled

    const { error } = await window.sb.rpc('file_dispute', {
      p_quest_id: currentQuest.id,
      p_reason: reason.label + (reason.note ? ': ' + reason.note : '')
    });

    if (error) {
      showAlert('Failed: ' + error.message, 'error');
      return;
    }

    // Log the reason as a comment for transparency
    await window.sb.from('quest_comments').insert({
      quest_id: currentQuest.id,
      user_id: currentUser.id,
      content: `🚨 Dispute filed.\nReason: ${reason.label}${reason.note ? '\nDetails: ' + reason.note : ''}`
    });

    showAlert('Dispute opened with reason: ' + reason.label, 'error');
    setTimeout(() => refreshQuestData(), 1200);
  };

  function showDisputeReasonModal() {
    return new Promise(resolve => {
      // Create modal
      const overlay = document.createElement('div');
      overlay.className = 'custom-modal-overlay';
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <div class="custom-modal" style="max-width:480px;text-align:left">
          <h4 style="color:var(--error);margin-bottom:6px">⚠️ File a Dispute</h4>
          <p style="color:var(--text-dim);font-size:0.85rem;margin-bottom:16px">
            Select a reason. This helps everyone understand what happened and speeds up resolution.
          </p>
          <div id="disputeReasonList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;max-height:260px;overflow-y:auto">
            ${DISPUTE_REASONS.map((r, i) => `
              <label class="dispute-reason-option" style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;transition:all 0.15s">
                <input type="radio" name="disputeReason" value="${r.value}" style="margin-top:3px;accent-color:var(--accent)">
                <div>
                  <div style="font-weight:600;font-size:0.9rem;color:var(--text)">${r.label}</div>
                  <div style="font-size:0.78rem;color:var(--text-dim);margin-top:2px">${r.desc}</div>
                </div>
              </label>
            `).join('')}
          </div>
          <div style="margin-bottom:16px">
            <label style="font-size:0.8rem;color:var(--text-dim);display:block;margin-bottom:4px">Additional details (optional):</label>
            <textarea id="disputeNoteInput" placeholder="Explain what happened..." style="width:100%;min-height:60px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:0.85rem;resize:vertical;box-sizing:border-box"></textarea>
          </div>
          <div class="custom-modal-actions">
            <button id="disputeModalCancel" class="btn btn-ghost">Cancel</button>
            <button id="disputeModalSubmit" class="btn btn-error">File Dispute</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Style radio options on select
      overlay.querySelectorAll('input[name="disputeReason"]').forEach(radio => {
        radio.addEventListener('change', () => {
          overlay.querySelectorAll('.dispute-reason-option').forEach(opt => {
            opt.style.borderColor = opt.querySelector('input').checked ? 'var(--error)' : 'var(--border)';
            opt.style.background = opt.querySelector('input').checked ? 'rgba(239,68,68,0.06)' : 'var(--bg)';
          });
        });
      });

      overlay.querySelector('#disputeModalCancel').onclick = () => {
        overlay.remove();
        resolve(null);
      };

      overlay.querySelector('#disputeModalSubmit').onclick = () => {
        const selected = overlay.querySelector('input[name="disputeReason"]:checked');
        if (!selected) {
          showToast('Please select a reason', 'warning');
          return;
        }
        const note = overlay.querySelector('#disputeNoteInput').value.trim();
        const reason = DISPUTE_REASONS.find(r => r.value === selected.value);
        overlay.remove();
        resolve({ ...reason, note });
      };

      // Close on backdrop click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(null);
        }
      });
    });
  }

  // ── 2. PROOF FILE REQUIREMENT (at least 1 file) ──
  const originalUploadProof = window.uploadProofFiles;
  window.uploadProofFiles = async function () {
    if (stagedProofFiles.length === 0) {
      showToast('⚠️ You must upload at least 1 proof file (screenshot, document, or link) before submitting.', 'warning', 5000);
      return;
    }
    // Call original
    return originalUploadProof.call(this);
  };

  // ── 3. ADD RULES LINK TO QUEST BOARD ──
  // Add a small rules reminder to the quest-post page
  if (window.location.pathname.includes('quest-post')) {
    const rulesReminder = document.createElement('div');
    rulesReminder.style.cssText = 'background:var(--accent-glow);border:1px solid var(--accent);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;font-size:0.85rem;color:var(--text-dim)';
    rulesReminder.innerHTML = '📜 <strong>New here?</strong> Read the <a href="quest-rules.html" style="color:var(--accent)">Quest Rules & Guidelines</a> before posting. It covers payment, disputes, and what\'s expected from both sides.';
    const form = document.querySelector('.post-form') || document.querySelector('form') || document.querySelector('.container');
    if (form) form.insertBefore(rulesReminder, form.firstChild);
  }

  // ── 4. ADD "RULES" LINK TO QUEST DETAIL PAGE ──
  if (window.location.pathname.includes('quest-detail')) {
    const nav = document.querySelector('.nav-bar');
    if (nav) {
      const rulesLink = document.createElement('a');
      rulesLink.href = 'quest-rules.html';
      rulesLink.textContent = '📜 Rules';
      rulesLink.style.cssText = 'color:var(--text-dim);font-size:0.85rem;text-decoration:none';
      nav.appendChild(rulesLink);
    }
  }

  // ── 5. ADD CSS FOR DISPUTE MODAL ──
  const style = document.createElement('style');
  style.textContent = `
    .dispute-reason-option:hover { border-color: var(--accent) !important; }
    .dispute-reason-option input:checked ~ div { color: var(--text); }
  `;
  document.head.appendChild(style);

})();
